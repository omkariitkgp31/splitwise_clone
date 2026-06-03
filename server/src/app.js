const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const groupRoutes = require('./routes/group.routes');
const expenseRoutes = require('./routes/expense.routes');
const balanceRoutes = require('./routes/balance.routes');
const settlementRoutes = require('./routes/settlement.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();
const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', groupRoutes);
app.use('/api/v1', expenseRoutes);
app.use('/api/v1', balanceRoutes);
app.use('/api/v1', settlementRoutes);
app.use('/api/v1', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500;

  res.status(statusCode).json({
    message: error.message || 'Internal server error',
  });
});

module.exports = app;
