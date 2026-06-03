const prisma = require('../config/db');
const { emitToGroup, emitToUser } = require('../socket/socketHandler');

const createSettlement = async (req, res, next) => {
  try {
    const { groupId, payeeId, amount, note } = req.body;
    const payerId = req.user.id;

    if (!groupId || !payeeId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid settlement data' });
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        payerId,
        payeeId,
        amount: Math.round(amount),
        note,
        status: 'PENDING_CONFIRMATION',
      },
    });

    return res.status(201).json({ settlement });
  } catch (error) {
    return next(error);
  }
};

const confirmSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payeeId = req.user.id; // The payee confirms receipt

    const settlement = await prisma.settlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    if (settlement.payeeId !== payeeId) {
      return res.status(403).json({ message: 'Only the payee can confirm this settlement' });
    }

    if (settlement.status !== 'PENDING_CONFIRMATION') {
      return res.status(400).json({ message: 'Settlement is not pending confirmation' });
    }

    const updatedSettlement = await prisma.settlement.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Emit socket events
    emitToGroup(settlement.groupId, 'balance:updated', { groupId: settlement.groupId });
    emitToUser(settlement.payerId, 'settlement:confirmed', updatedSettlement);

    return res.status(200).json({ settlement: updatedSettlement });
  } catch (error) {
    return next(error);
  }
};

const rejectSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payeeId = req.user.id; // The payee rejects the claim

    const settlement = await prisma.settlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    if (settlement.payeeId !== payeeId) {
      return res.status(403).json({ message: 'Only the payee can reject this settlement' });
    }

    if (settlement.status !== 'PENDING_CONFIRMATION') {
      return res.status(400).json({ message: 'Settlement is not pending confirmation' });
    }

    const updatedSettlement = await prisma.settlement.update({
      where: { id },
      data: {
        status: 'REJECTED',
      },
    });

    // Emit socket event
    emitToUser(settlement.payerId, 'settlement:rejected', updatedSettlement);

    return res.status(200).json({ settlement: updatedSettlement });
  } catch (error) {
    return next(error);
  }
};

const getGroupSettlements = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, name: true, imageURI: true } },
        payee: { select: { id: true, name: true, imageURI: true } },
      },
      orderBy: { initiatedAt: 'desc' },
    });
    return res.status(200).json({ settlements });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createSettlement,
  confirmSettlement,
  rejectSettlement,
  getGroupSettlements,
};
