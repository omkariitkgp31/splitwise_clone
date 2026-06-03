const { getGroupBalances, getUserBalanceInGroup } = require('../services/balanceService');

const getGroupBalancesHandler = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const balances = await getGroupBalances(groupId);
    return res.status(200).json(balances);
  } catch (error) {
    return next(error);
  }
};

const getUserBalanceInGroupHandler = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const balance = await getUserBalanceInGroup(groupId, userId);
    return res.status(200).json(balance);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getGroupBalances: getGroupBalancesHandler,
  getUserBalanceInGroup: getUserBalanceInGroupHandler,
};
