const prisma = require('../config/db');

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ notifications });
  } catch (error) {
    return next(error);
  }
};

const readNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.status(200).json({ notification: updatedNotification });
  } catch (error) {
    return next(error);
  }
};

const readAllNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getNotifications,
  readNotification,
  readAllNotifications,
};
