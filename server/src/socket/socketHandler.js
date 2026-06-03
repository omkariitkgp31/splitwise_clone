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
    const cookies = parseCookies(cookieHeader);
    const token = cookies['access_token'];

    if (!token) {
      socket.disconnect(true);
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    } catch (err) {
      socket.disconnect(true);
      return;
    }

    socket.userId = decoded.id;
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
      try {
        if (!message || !message.trim()) return;

        const expense = await prisma.expense.findUnique({
          where: { id: expenseId },
          select: { groupId: true },
        });

        if (!expense) {
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

module.exports = {
  socketHandler,
  emitToGroup,
  emitToUser,
};
