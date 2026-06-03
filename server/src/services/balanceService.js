const prisma = require('../config/db');
const redis = require('../config/redis');

const computeRawBalances = async (groupId) => {
  const expenses = await prisma.expense.findMany({
    where: { groupId, isDeleted: false, isSettled: true },
    include: { splits: true }
  });
  const settlements = await prisma.settlement.findMany({
    where: { groupId, status: 'CONFIRMED' }
  });

  const net = {};
  const add = (id, amt) => { net[id] = (net[id] || 0) + amt; };

  for (const expense of expenses) {
    add(expense.paidBy, expense.totalAmount);          // payer fronted full amount
    for (const split of expense.splits) {
      add(split.userId, -split.owedAmount);            // each participant owes their share
    }
  }
  for (const s of settlements) {
    add(s.payerId,  s.amount);   // payer paid → credit
    add(s.payeeId, -s.amount);   // payee received → debit
  }

  // Remove zero balances (mirrors C++ showing only non-zero balances)
  Object.keys(net).forEach(id => { if (net[id] === 0) delete net[id]; });
  return net;
};

const computeSimplifiedBalances = async (groupId) => {
  // Greedy min-transactions algorithm
  // Mirrors the intent of C++ showAllBalances() but minimizes transactions
  const net = await computeRawBalances(groupId);
  const creditors = [];  // net > 0
  const debtors   = [];  // net < 0

  for (const [userId, amount] of Object.entries(net)) {
    if (amount > 0) creditors.push({ userId, amount });
    else            debtors.push({ userId, amount: -amount });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b)   => b.amount - a.amount);

  const transactions = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].amount, debtors[di].amount);
    transactions.push({
      from: debtors[di].userId,
      to:   creditors[ci].userId,
      amount,
      currency: 'USD'
    });
    creditors[ci].amount -= amount;
    debtors[di].amount   -= amount;
    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount   === 0) di++;
  }

  return { groupId, transactions, computedAt: new Date().toISOString() };
};

const getGroupBalances = async (groupId) => {
  const key = 'group:' + groupId + ':balances';
  
  if (redis.status === 'ready') {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error('Failed to get from Redis cache:', err);
    }
  }
  
  const result = await computeSimplifiedBalances(groupId);
  
  if (redis.status === 'ready') {
    try {
      await redis.setex(key, 3600, JSON.stringify(result));
    } catch (err) {
      console.error('Failed to set Redis cache:', err);
    }
  }
  
  return result;
};

const getUserBalanceInGroup = async (groupId, userId) => {
  const net = await computeRawBalances(groupId);
  return { userId, amount: net[userId] || 0, currency: 'USD' };
};

const invalidateBalanceCache = async (groupId) => {
  const key = 'group:' + groupId + ':balances';
  if (redis.status === 'ready') {
    try {
      await redis.del(key);
      console.log(`Balance cache invalidated for group: ${groupId}`);
    } catch (err) {
      console.error(`Failed to delete Redis key ${key}:`, err);
    }
  } else {
    console.warn(`Redis is offline (status: ${redis.status}). Invalidation skipped for group: ${groupId}`);
  }
};

module.exports = {
  getGroupBalances,
  getUserBalanceInGroup,
  invalidateBalanceCache,
  computeRawBalances,
};
