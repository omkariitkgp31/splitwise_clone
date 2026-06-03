const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

let ioInstance = null;

const parseCookies = (cookieString) => {
  if (!cookieString) return {};
  return cookieString.split(';').reduce((acc, pair) => {
    const parts = pair.split('=');
    if (parts.length >= 1) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      acc[key] = val;
    }
    return acc;
  }, {});
};

const emitToGroup = (groupId, event, data) => {
  if (ioInstance) {
    ioInstance.to('group:' + groupId).emit(event, data);
  }
};

const emitToUser = (userId, event, data) => {
  if (ioInstance) {
    ioInstance.to('user:' + userId).emit(event, data);
  }
};

const socketHandler = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    const cookieHeader = socket.handshake.headers.cookie;
    console.log(`[Socket] Connection attempt. ID: ${socket.id}, Cookies present: ${!!cookieHeader}`);
    const cookies = parseCookies(cookieHeader);
    const token = cookies['access_token'];

    if (!token) {
      console.log(`[Socket] Connection rejected: No access token found. ID: ${socket.id}`);
      socket.disconnect(true);
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    } catch (err) {
      console.log(`[Socket] Connection rejected: Token verification failed (${err.message}). ID: ${socket.id}`);
      socket.disconnect(true);
      return;
    }

    socket.userId = decoded.id;
    console.log(`[Socket] User ${socket.userId} authenticated and joined user:${socket.userId}. ID: ${socket.id}`);
    socket.join(`user:${socket.userId}`);

    // Join Group Room
    socket.on('join:group', async ({ groupId }) => {
      try {
        const membership = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: socket.userId,
            },
          },
        });
        if (membership) {
          socket.join('group:' + groupId);
        } else {
          socket.emit('error', { message: 'Not a member of this group' });
        }
      } catch (err) {
        console.error('Error joining group room:', err);
      }
    });

    // Leave Group Room
    socket.on('leave:group', ({ groupId }) => {
      socket.leave('group:' + groupId);
    });

    // Join Expense Room
    socket.on('join:expense', ({ expenseId }) => {
      console.log(`[Socket] User ${socket.userId} joining room expense:${expenseId}`);
      socket.join('expense:' + expenseId);
    });

    // Leave Expense Room
    socket.on('leave:expense', ({ expenseId }) => {
      socket.leave('expense:' + expenseId);
    });

    // Send Group Message
    socket.on('send:group-message', async ({ groupId, message }) => {
      try {
        if (!message || !message.trim()) return;

        const membership = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: socket.userId,
            },
          },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this group' });
          return;
        }

        const msg = await prisma.groupMessage.create({
          data: {
            groupId,
            userId: socket.userId,
            message: message.trim(),
          },
          include: {
            user: {
              select: { id: true, name: true, imageURI: true },
            },
          },
        });

        io.to('group:' + groupId).emit('new:group-message', {
          id: msg.id,
          message: msg.message,
          user: msg.user,
          timestamp: msg.createdAt,
        });
      } catch (err) {
        console.error('Error handling group message:', err);
      }
    });

    // Send Expense Comment
    socket.on('send:expense-comment', async ({ expenseId, message }) => {
      console.log(`[Socket] Received send:expense-comment from user ${socket.userId} for expense ${expenseId}: "${message}"`);
      try {
        if (!message || !message.trim()) {
          console.log(`[Socket] Ignored empty message`);
          return;
        }

        const expense = await prisma.expense.findUnique({
          where: { id: expenseId },
          select: { groupId: true },
        });

        if (!expense) {
          console.log(`[Socket] Expense not found: ${expenseId}`);
          socket.emit('error', { message: 'Expense not found' });
          return;
        }

        const membership = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId: expense.groupId,
              userId: socket.userId,
            },
          },
        });

        if (!membership) {
          console.log(`[Socket] User ${socket.userId} is not member of group ${expense.groupId}`);
          socket.emit('error', { message: 'Not a member of this group' });
          return;
        }

        const comment = await prisma.expenseComment.create({
          data: {
            expenseId,
            userId: socket.userId,
            message: message.trim(),
          },
          include: {
            user: {
              select: { id: true, name: true, imageURI: true },
            },
          },
        });

        console.log(`[Socket] Created comment ${comment.id} in DB. Broadcasting new:expense-comment to room expense:${expenseId}`);
        io.to('expense:' + expenseId).emit('new:expense-comment', {
          id: comment.id,
          message: comment.message,
          user: comment.user,
          timestamp: comment.createdAt,
        });
      } catch (err) {
        console.error('Error handling expense comment:', err);
      }
    });
  });
};

const emitToExpense = (expenseId, event, data) => {
  if (ioInstance) {
    ioInstance.to('expense:' + expenseId).emit(event, data);
  }
};

module.exports = {
  socketHandler,
  emitToGroup,
  emitToUser,
  emitToExpense,
};
