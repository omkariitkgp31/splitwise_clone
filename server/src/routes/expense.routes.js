const express = require('express');
const authMiddleware = require('../middleware/auth');
const groupMemberMiddleware = require('../middleware/groupMember');
const multer = require('multer');

const {
  createExpense,
  setExpenseShares,
  getExpenses,
  getExpense,
  deleteExpense,
  getUserExpenses,
  getExpenseComments,
} = require('../controllers/expense.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Group expense routes
router.post('/groups/:id/expenses', authMiddleware, groupMemberMiddleware, upload.single('image'), createExpense);
router.get('/groups/:id/expenses', authMiddleware, groupMemberMiddleware, getExpenses);

// User specific expenses (must be declared BEFORE general /expenses/:id to avoid conflict)
router.get('/users/me/expenses', authMiddleware, getUserExpenses);

// Individual expense routes
router.patch('/expenses/:id/shares', authMiddleware, setExpenseShares);
router.get('/expenses/:id/comments', authMiddleware, getExpenseComments);
router.get('/expenses/:id', authMiddleware, getExpense);
router.delete('/expenses/:id', authMiddleware, deleteExpense);

module.exports = router;
