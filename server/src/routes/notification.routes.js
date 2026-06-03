const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getNotifications, readNotification, readAllNotifications } = require('../controllers/notification.controller');

const router = express.Router();

router.get('/notifications', authMiddleware, getNotifications);
router.patch('/notifications/read-all', authMiddleware, readAllNotifications);
router.patch('/notifications/:id/read', authMiddleware, readNotification);

module.exports = router;
