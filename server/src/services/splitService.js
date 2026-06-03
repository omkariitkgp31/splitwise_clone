const splitEqual = (totalAmount, participants) => {
  // C++: double equalShare = totalAmount / participants.size();
  // C++: for each participant → shares[participant] = equalShare;
  // JS uses doubles (floats), same as C++ double. No integer rounding here.
  const equalShare = totalAmount / participants.length;
  return participants.map(userId => ({ userId, owedAmount: equalShare }));
};

const splitExact = (totalAmount, splits) => {
  // splits = [{ userId, owedAmount }]
  // Mirrors C++ setShares() with EXACT type
  // C++: validates totalShares === expense.getTotalAmount() (±0.01 tolerance)
  const sum = splits.reduce((acc, s) => acc + s.owedAmount, 0);
  if (Math.abs(sum - totalAmount) > 0.01)
    throw new Error(`Exact splits sum to ${sum}, must equal ${totalAmount}`);
  return splits;
};

const splitPercent = (totalAmount, splits) => {
  // splits = [{ userId, percentage }]
  // Mirrors C++ PERCENT type via setShares()
  // C++: validates totalShares (percentages) sum to 100 (±0.01)
  const totalPct = splits.reduce((acc, s) => acc + s.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01)
    throw new Error(`Percentages sum to ${totalPct}, must equal 100`);
  return splits.map(s => ({
    userId: s.userId,
    owedAmount: (totalAmount * s.percentage) / 100,
    percentage: s.percentage,
  }));
};

const calculateSplits = (expense) => {
  // Router — mirrors C++ constructor logic:
  // if (type == ExpenseType::EQUAL) → calculateEqualShares()
  // if (type == ExpenseType::EXACT or PERCENT) → setShares() called separately
  switch (expense.splitMethod) {
    case 'EQUAL':   return splitEqual(expense.totalAmount, expense.participants);
    case 'EXACT':   return splitExact(expense.totalAmount, expense.splits);
    case 'PERCENT': return splitPercent(expense.totalAmount, expense.splits);
    default: throw new Error('Unknown split method: ' + expense.splitMethod);
  }
};

module.exports = { calculateSplits, splitEqual, splitExact, splitPercent };
