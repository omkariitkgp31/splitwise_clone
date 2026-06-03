const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.cookies?.access_token;

  console.log('\n========== AUTH MIDDLEWARE ==========');
  console.log('COOKIES:', req.cookies);
  console.log('ACCESS TOKEN:', token);

  if (!token) {
    console.log('❌ No access_token cookie found');
    return res.status(401).json({ message: 'Authentication required' });
  }

  const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;

  console.log('VERIFY SECRET:', secret);

  if (!secret) {
    console.error(
      'JWT configuration error: Neither JWT_SECRET nor JWT_ACCESS_SECRET is configured.'
    );
    return res.status(500).json({
      message: 'Authentication configuration error',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    console.log('✅ TOKEN VERIFIED');
    console.log('DECODED TOKEN:', decoded);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };

    return next();
  } catch (error) {
    console.log('❌ TOKEN VERIFICATION FAILED');
    console.log('ERROR:', error.message);

    return res.status(401).json({
      message: 'Invalid or expired token',
    });
  }
};

module.exports = authMiddleware;