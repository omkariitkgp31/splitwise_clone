const express = require('express');
const authMiddleware = require('../middleware/auth');
const { createSettlement, confirmSettlement, rejectSettlement, getGroupSettlements } = require('../controllers/settlement.controller');
const groupMemberMiddleware = require('../middleware/groupMember');

const router = express.Router();

router.post('/settlements', authMiddleware, createSettlement);
router.patch('/settlements/:id/confirm', authMiddleware, confirmSettlement);
router.patch('/settlements/:id/reject', authMiddleware, rejectSettlement);
router.get('/groups/:id/settlements', authMiddleware, groupMemberMiddleware, getGroupSettlements);

module.exports = router;
