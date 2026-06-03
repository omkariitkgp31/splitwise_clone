const express = require('express');
const authMiddleware = require('../middleware/auth');
const groupMemberMiddleware = require('../middleware/groupMember');
const {
  createGroup,
  getGroups,
  getGroup,
  addMember,
  removeMember,
  inviteByEmail,
  getInvite,
  acceptInvite,
  getGroupMessages,
} = require('../controllers/group.controller');

const router = express.Router();

router.get('/groups', authMiddleware, getGroups);
router.post('/groups', authMiddleware, createGroup);
router.get('/groups/:id', authMiddleware, groupMemberMiddleware, getGroup);
router.post('/groups/:id/members', authMiddleware, groupMemberMiddleware, addMember);
router.delete('/groups/:id/members/:userId', authMiddleware, groupMemberMiddleware, removeMember);
router.post('/groups/:id/invite', authMiddleware, groupMemberMiddleware, inviteByEmail);
router.get('/groups/:id/messages', authMiddleware, groupMemberMiddleware, getGroupMessages);

router.get('/invite/:token', getInvite);
router.post('/invite/:token/accept', authMiddleware, acceptInvite);

module.exports = router;
