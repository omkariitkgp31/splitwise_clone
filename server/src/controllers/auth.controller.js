const bcrypt = require('bcryptjs'); //encrypt password
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const prisma = require('../config/db');

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure: process.env.NODE_ENV === 'production',
};

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  googleId: true,
  imageURI: true,
  bio: true,
  createdAt: true,
  updatedAt: true,
};

const signAccessToken = (user) => {
  const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;

  console.log('\n========== TOKEN CREATION ==========');
  console.log('LOGIN SECRET:', secret);
  console.log('USER ID:', user.id);
  console.log('EMAIL:', user.email);

  if (!secret) {
    throw new Error('JWT_SECRET or JWT_ACCESS_SECRET is not configured');
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    {
      expiresIn: '15m',
    }
  );

  console.log('GENERATED TOKEN:', token);
  console.log('====================================\n');

  return token;
};

const createRefreshToken = async (userId) => {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);

  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
};

const setAuthCookies = async (res, user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions);
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Email is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      },
      select: publicUserSelect,
    });

    await setAuthCookies(res, user);

    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await setAuthCookies(res, user);

    const { password: _password, ...safeUser } = user;
    return res.status(200).json({ user: safeUser });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    clearAuthCookies(res);

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
};

const googleCallback = async (req, res, next) => {
  try {
    await setAuthCookies(res, req.user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/dashboard`);
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: publicUserSelect,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const storedRefreshToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedRefreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (storedRefreshToken.expiresAt <= new Date()) {
      await prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
      clearAuthCookies(res);
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    const accessToken = signAccessToken(storedRefreshToken.user);

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    return res.status(200).json({ message: 'Access token refreshed' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  googleCallback,
  me,
  refresh,
};
