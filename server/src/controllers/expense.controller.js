const prisma = require('../config/db');
const { calculateSplits, splitEqual } = require('../services/splitService');
const { invalidateBalanceCache } = require('../services/balanceService');
const { emitToGroup, emitToExpense } = require('../socket/socketHandler');

const createExpense = async (req, res, next) => {
  try {
    const groupId = req.params.id || req.params.groupId;
    const {
      description,
      totalAmount,
      paidBy,
      participants,
      splitMethod,
      category,
      expenseDate,
    } = req.body;

    // Validate presence
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid total amount' });
    }
    if (!paidBy) {
      return res.status(400).json({ message: 'PaidBy user is required' });
    }
    let parsedParticipants = participants;
    if (typeof participants === 'string') {
      try {
        parsedParticipants = JSON.parse(participants);
      } catch (e) {
        parsedParticipants = participants.split(',').map((p) => p.trim());
      }
    }
    const participantsList = Array.isArray(parsedParticipants)
      ? parsedParticipants
      : parsedParticipants
      ? [parsedParticipants]
      : [];

    if (participantsList.length === 0) {
      return res.status(400).json({ message: 'Participants array is required and cannot be empty' });
    }
    if (!['EQUAL', 'EXACT', 'PERCENT', 'SHARES'].includes(splitMethod)) {
      return res.status(400).json({ message: 'Invalid split method' });
    }

    // Validate paidBy and participants are group members
    const uniqueUsers = Array.from(new Set([paidBy, ...participantsList]));
    const memberCount = await prisma.groupMember.count({
      where: {
        groupId,
        userId: { in: uniqueUsers },
      },
    });

    if (memberCount !== uniqueUsers.length) {
      return res.status(400).json({ message: 'Payer and all participants must be members of the group' });
    }

    // Handle file upload to Azure Blob if present
    let imageURI = null;
    if (req.file) {
      try {
        const blobService = require('../services/blobService');
        imageURI = await blobService.uploadFile(req.file.buffer, req.file.mimetype, 'expenses');
      } catch (err) {
        console.error('Failed to upload image to Azure Blob, skipping...', err);
      }
    }

    const baseExpenseData = {
      groupId,
      title: description.trim(),
      totalAmount: Math.round(amount), // store in DB as integer
      paidBy,
      splitMethod,
      category: category || 'General',
      imageURI,
      createdBy: req.user.id,
      timestamp: expenseDate ? new Date(expenseDate) : new Date(),
    };

    let expense;
    if (splitMethod === 'EQUAL') {
      const calculatedSplits = splitEqual(amount, participantsList);
      
      expense = await prisma.$transaction(async (tx) => {
        const createdExpense = await tx.expense.create({
          data: {
            ...baseExpenseData,
            isSettled: true,
            splits: {
              create: calculatedSplits.map((s) => ({
                userId: s.userId,
                owedAmount: Math.round(s.owedAmount),
                percentage: 100 / participantsList.length,
              })),
            },
          },
          include: {
            payer: {
              select: { id: true, name: true, imageURI: true },
            },
            splits: {
              include: {
                user: {
                  select: { id: true, name: true, imageURI: true },
                },
              },
            },
          },
        });
        return createdExpense;
      });

      await invalidateBalanceCache(groupId);
    } else {
      // EXACT or PERCENT splits are set later via setExpenseShares
      expense = await prisma.expense.create({
        data: {
          ...baseExpenseData,
          isSettled: false,
        },
        include: {
          payer: {
            select: { id: true, name: true, imageURI: true },
          },
        },
      });
      // Attach an status indicator
      expense.status = 'awaiting_shares';
    }

    // Emit Socket.io events to group room
    emitToGroup(groupId, 'expense:created', expense);
    emitToGroup(groupId, 'balance:updated', { groupId });

    return res.status(201).json({ expense });
  } catch (error) {
    return next(error);
  }
};

const setExpenseShares = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { splits } = req.body;

    if (!splits || !Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ message: 'Splits array is required' });
    }

    // Find expense by id and verify not already settled
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.isSettled) {
      return res.status(400).json({ message: 'Expense is already settled' });
    }

    if (expense.splitMethod === 'SHARES') {
      // Validate all splits have shareValue field
      for (const s of splits) {
        if (s.shareValue === undefined || s.shareValue === null) {
          return res.status(400).json({ message: 'shareValue required for SHARES split method' });
        }
      }
    }

    // Prepare structure to run calculateSplits
    const calculationInput = {
      totalAmount: expense.totalAmount,
      splitMethod: expense.splitMethod,
      splits: splits.map((s) => ({
        userId: s.userId,
        owedAmount: s.owedAmount !== undefined ? parseFloat(s.owedAmount) : undefined,
        percentage: s.percentage !== undefined ? parseFloat(s.percentage) : undefined,
        shareValue: s.shareValue !== undefined ? parseFloat(s.shareValue) : undefined,
      })),
      participants: splits.map((s) => s.userId),
    };

    let calculatedSplits;
    try {
      calculatedSplits = calculateSplits(calculationInput);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const updatedExpense = await prisma.$transaction(async (tx) => {
      // 1. Create splits
      await tx.expenseSplit.createMany({
        data: calculatedSplits.map((s) => ({
          expenseId: id,
          userId: s.userId,
          owedAmount: Math.round(s.owedAmount),
          percentage: s.percentage !== undefined ? s.percentage : null,
          shareValue: s.shareValue !== undefined ? s.shareValue : null,
        })),
      });

      // 2. Set isSettled = true
      return tx.expense.update({
        where: { id },
        data: { isSettled: true },
        include: {
          payer: {
            select: { id: true, name: true, imageURI: true },
          },
          splits: {
            include: {
              user: {
                select: { id: true, name: true, imageURI: true },
              },
            },
          },
        },
      });
    });

    await invalidateBalanceCache(expense.groupId);

    // Emit socket events
    emitToGroup(expense.groupId, 'balance:updated', { groupId: expense.groupId });

    return res.status(200).json({ expense: updatedExpense });
  } catch (error) {
    return next(error);
  }
};

const getExpenses = async (req, res, next) => {
  try {
    const groupId = req.params.id || req.params.groupId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const expenses = await prisma.expense.findMany({
      where: {
        groupId,
        isDeleted: false,
      },
      include: {
        payer: {
          select: { id: true, name: true, imageURI: true },
        },
        splits: {
          include: {
            user: {
              select: { id: true, name: true, imageURI: true },
            },
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip,
      take: limit,
    });

    const totalCount = await prisma.expense.count({
      where: {
        groupId,
        isDeleted: false,
      },
    });

    return res.status(200).json({
      expenses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getUserExpenses = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        OR: [
          { paidBy: userId },
          {
            splits: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        group: {
          select: { id: true, title: true },
        },
        payer: {
          select: { id: true, name: true, imageURI: true },
        },
        splits: {
          include: {
            user: {
              select: { id: true, name: true, imageURI: true },
            },
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return res.status(200).json({ expenses });
  } catch (error) {
    return next(error);
  }
};

const getExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        payer: {
          select: { id: true, name: true, imageURI: true },
        },
        splits: {
          include: {
            user: {
              select: { id: true, name: true, imageURI: true },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, imageURI: true },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!expense || expense.isDeleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    return res.status(200).json({ expense });
  } catch (error) {
    return next(error);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense || expense.isDeleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: expense.groupId,
          userId,
        },
      },
      select: { role: true },
    });

    const isCreator = expense.createdBy === userId;
    const isAdmin = membership?.role === 'ADMIN';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only the creator or a group admin can delete this expense' });
    }

    await prisma.expense.update({
      where: { id },
      data: { isDeleted: true },
    });

    await invalidateBalanceCache(expense.groupId);

    // Emit socket event
    emitToGroup(expense.groupId, 'balance:updated', { groupId: expense.groupId });

    return res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

const getExpenseComments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { groupId: true },
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: expense.groupId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    const comments = await prisma.expenseComment.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, imageURI: true },
        },
      },
    });

    return res.status(200).json({ comments });
  } catch (error) {
    return next(error);
  }
};

const createExpenseComment = async (req, res, next) => {
  try {
    const { id: expenseId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Comment message is required' });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { groupId: true },
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: expense.groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ message: 'You must be a member of the group to comment' });
    }

    const comment = await prisma.expenseComment.create({
      data: {
        expenseId,
        userId,
        message: message.trim(),
      },
      include: {
        user: {
          select: { id: true, name: true, imageURI: true },
        },
      },
    });

    // Broadcast new comment to all sockets in the expense room
    emitToExpense(expenseId, 'new:expense-comment', {
      id: comment.id,
      message: comment.message,
      user: comment.user,
      timestamp: comment.createdAt,
    });

    return res.status(201).json({ comment });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createExpense,
  setExpenseShares,
  getExpenses,
  getUserExpenses,
  getExpense,
  deleteExpense,
  getExpenseComments,
  createExpenseComment,
};
