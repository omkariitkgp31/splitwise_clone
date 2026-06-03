const { randomUUID } = require('crypto');
const prisma = require('../config/db');

const MEMBER_SELECT = {
  id: true,
  role: true,
  joinedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      imageURI: true,
    },
  },
};

const GROUP_WITH_MEMBERS_INCLUDE = {
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
      imageURI: true,
    },
  },
  members: {
    select: MEMBER_SELECT,
    orderBy: {
      joinedAt: 'asc',
    },
  },
};

const getGroupId = (req) => req.params.groupId || req.params.id;

const requireAdmin = (req, res) => {
  if (req.groupMember?.role !== 'ADMIN') {
    res.status(403).json({ message: 'Group admin permission required' });
    return false;
  }

  return true;
};

const getPendingInvite = async (token) => {
  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: {
      group: {
        select: {
          id: true,
          title: true,
        },
      },
      inviter: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite || invite.status !== 'PENDING') {
    return null;
  }

  if (invite.expiresAt <= new Date()) {
    await prisma.groupInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    });
    return null;
  }

  return invite;
};

const sendInviteEmail = async (to, inviterName, groupName, token) => {
  const emailService = require('../services/emailService');
  return emailService.sendInviteEmail(to, inviterName, groupName, token);
};

const createGroup = async (req, res, next) => {
  try {
    const { title, description, imageURI } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const group = await prisma.$transaction(async (tx) => {
      const createdGroup = await tx.group.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          imageURI: imageURI || null,
          createdBy: req.user.id,
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: createdGroup.id,
          userId: req.user.id,
          role: 'ADMIN',
        },
      });

      return tx.group.findUnique({
        where: { id: createdGroup.id },
        include: GROUP_WITH_MEMBERS_INCLUDE,
      });
    });

    return res.status(201).json({ group });
  } catch (error) {
    return next(error);
  }
};

const getGroups = async (req, res, next) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        group: {
          include: {
            _count: {
              select: {
                members: true,
              },
            },
            expenses: {
              where: {
                isDeleted: false,
              },
              orderBy: {
                timestamp: 'desc',
              },
              take: 1,
              select: {
                timestamp: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    const groups = memberships.map((membership) => ({
      id: membership.group.id,
      title: membership.group.title,
      description: membership.group.description,
      imageURI: membership.group.imageURI,
      createdBy: membership.group.createdBy,
      createdAt: membership.group.createdAt,
      updatedAt: membership.group.updatedAt,
      role: membership.role,
      memberCount: membership.group._count.members,
      lastExpenseDate: membership.group.expenses[0]?.timestamp || null,
    }));

    return res.status(200).json({ groups });
  } catch (error) {
    return next(error);
  }
};

const getGroup = async (req, res, next) => {
  try {
    const groupId = getGroupId(req);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        title: true,
        description: true,
        imageURI: true,
        createdAt: true,
        updatedAt: true,
        members: {
          select: MEMBER_SELECT,
          orderBy: {
            joinedAt: 'asc',
          },
        },
        expenses: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 5,
          select: {
            id: true,
            title: true,
            totalAmount: true,
            paidBy: true,
            splitMethod: true,
            category: true,
            imageURI: true,
            isSettled: true,
            timestamp: true,
            createdBy: true,
            updatedAt: true,
            payer: {
              select: {
                id: true,
                name: true,
                imageURI: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    return res.status(200).json({ group });
  } catch (error) {
    return next(error);
  }
};

const addMember = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) {
      return null;
    }

    const groupId = getGroupId(req);
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User id is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        imageURI: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: { id: true },
    });

    if (existingMembership) {
      return res.status(409).json({ message: 'User is already a group member' });
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: 'MEMBER',
      },
      select: MEMBER_SELECT,
    });

    return res.status(201).json({ member });
  } catch (error) {
    return next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) {
      return null;
    }

    const groupId = getGroupId(req);
    const { userId } = req.params;

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership) {
      return res.status(404).json({ message: 'Group member not found' });
    }

    if (userId === req.user.id && membership.role === 'ADMIN') {
      const adminCount = await prisma.groupMember.count({
        where: {
          groupId,
          role: 'ADMIN',
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot remove yourself as the only admin' });
      }
    }

    await prisma.groupMember.delete({
      where: {
        id: membership.id,
      },
    });

    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    return next(error);
  }
};

const inviteByEmail = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) {
      return null;
    }

    const groupId = getGroupId(req);
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        imageURI: true,
      },
    });

    if (existingUser) {
      const existingMembership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: existingUser.id,
          },
        },
        select: { id: true },
      });

      if (existingMembership) {
        return res.status(409).json({ message: 'User is already a group member' });
      }

      await prisma.groupMember.create({
        data: {
          groupId,
          userId: existingUser.id,
          role: 'MEMBER',
        },
      });

      return res.status(201).json({ invited: true, method: 'direct' });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.groupInvite.create({
      data: {
        groupId,
        invitedBy: req.user.id,
        email,
        token,
        expiresAt,
      },
    });

    try {
      await sendInviteEmail(email, req.user.name, group.title, token);
      return res.status(201).json({ invited: true, method: 'email' });
    } catch (emailError) {
      console.warn('Failed to send invitation email, providing local link fallback:', emailError.message);
      const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
      return res.status(201).json({
        invited: true,
        method: 'email',
        message: 'Invitation registered, but email sending failed.',
        inviteLink: `${frontendUrl}/invite/${token}`,
      });
    }
  } catch (error) {
    return next(error);
  }
};

const getInvite = async (req, res, next) => {
  try {
    const invite = await getPendingInvite(req.params.token);

    if (!invite) {
      return res.status(404).json({ message: 'Invite not found or expired' });
    }

    return res.status(200).json({
      invite: {
        groupName: invite.group.title,
        inviterName: invite.inviter.name,
        email: invite.email,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const acceptInvite = async (req, res, next) => {
  try {
    const invite = await getPendingInvite(req.params.token);

    if (!invite) {
      return res.status(404).json({ message: 'Invite not found or expired' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ message: 'This invite was sent to a different email' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.upsert({
        where: {
          groupId_userId: {
            groupId: invite.groupId,
            userId: user.id,
          },
        },
        create: {
          groupId: invite.groupId,
          userId: user.id,
          role: 'MEMBER',
        },
        update: {},
      });

      await tx.groupInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
    });

    return res.status(200).json({ accepted: true, groupId: invite.groupId });
  } catch (error) {
    return next(error);
  }
};

const getGroupMessages = async (req, res, next) => {
  try {
    const groupId = req.params.id || req.params.groupId;
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, imageURI: true },
        },
      },
    });

    return res.status(200).json({ messages: messages.reverse() });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  addMember,
  removeMember,
  inviteByEmail,
  getInvite,
  acceptInvite,
  getGroupMessages,
};
