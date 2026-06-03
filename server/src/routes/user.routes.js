const express = require('express');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/search', authMiddleware, async (req, res, next) => {
  const query = String(req.query.q || '').trim();

  if (!query) {
    return res.json([]);
  }

  try {
    const likeQuery = `%${query}%`;
    const users = await prisma.$queryRaw`
      SELECT id, name, email, imageURI
      FROM \`User\`
      WHERE id <> ${req.user.id}
        AND (
          LOWER(name) LIKE LOWER(${likeQuery})
          OR LOWER(email) LIKE LOWER(${likeQuery})
        )
      ORDER BY name ASC
      LIMIT 20
    `;

    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
