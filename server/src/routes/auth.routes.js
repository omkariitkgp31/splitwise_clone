const express = require('express');
const passport = require('../config/passport');
const authMiddleware = require('../middleware/auth');
const {
  register,
  login,
  logout,
  googleCallback,
  me,
  refresh,
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// router.get(
//   '/google',
// //   passport.authenticate('google', {
// //     scope: ['profile', 'email'],
// //     session: false,
// //   }),
// // );

// router.get(
//   '/google/callback',
//   passport.authenticate('google', {
//     failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
//     session: false,
//   }),
//   googleCallback,
// );

router.get('/me', authMiddleware, me);
router.post('/refresh', refresh);

module.exports = router;
