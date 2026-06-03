const prisma = require('../config/db');

const groupMemberMiddleware = async (req, res, next) => {
  const groupId = req.params.groupId || req.params.id;
  const userId = req.user?.id;

  if (!groupId || !userId) {
    return res.status(403).json({ message: 'Group membership required' });
  }

  try {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    req.groupMember = {
      role: membership.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = groupMemberMiddleware;
