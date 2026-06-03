const express = require('express');
const authMiddleware = require('../middleware/auth');
const groupMemberMiddleware = require('../middleware/groupMember');
const { getGroupBalances, getUserBalanceInGroup } = require('../controllers/balance.controller');

const router = express.Router();

router.get('/groups/:id/balances', authMiddleware, groupMemberMiddleware, getGroupBalances);
router.get('/groups/:id/balances/me', authMiddleware, groupMemberMiddleware, getUserBalanceInGroup);

module.exports = router;
