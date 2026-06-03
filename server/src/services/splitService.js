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

function splitShares(totalAmount, splits) {
  // splits = [{ userId, shareValue }]
  // shareValue = number of shares assigned to this user (integer, e.g. 2, 1, 1)

  // Validate: at least one participant
  if (!splits || splits.length === 0) {
    throw new Error('At least one participant required for shares split.');
  }

  // Validate: all shareValues are positive numbers
  for (const s of splits) {
    if (!s.shareValue || s.shareValue <= 0) {
      throw new Error('Share value must be a positive number for user: ' + s.userId);
    }
  }

  // Calculate total shares
  const totalShares = splits.reduce((acc, s) => acc + s.shareValue, 0);
  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than 0.');
  }

  // Calculate owedAmount per participant using floor division
  let allocated = 0;
  const result = splits.map(s => {
    const owedAmount = Math.floor(totalAmount * s.shareValue / totalShares);
    allocated += owedAmount;
    return {
      userId:     s.userId,
      owedAmount: owedAmount,
      shareValue: s.shareValue,
    };
  });

  // Remainder goes to first participant (payer handles this in controller)
  // Return result as-is; controller will adjust payer's owedAmount for remainder
  const remainder = totalAmount - allocated;
  if (remainder !== 0) {
    // Add remainder to first entry — controller will re-assign to payer if needed
    result[0].owedAmount += remainder;
  }

  return result;
}

const calculateSplits = (expense) => {
  // Router — mirrors C++ constructor logic:
  // if (type == ExpenseType::EQUAL) → calculateEqualShares()
  // if (type == ExpenseType::EXACT or PERCENT) → setShares() called separately
  switch (expense.splitMethod) {
    case 'EQUAL':   return splitEqual(expense.totalAmount, expense.participants);
    case 'EXACT':   return splitExact(expense.totalAmount, expense.splits);
    case 'PERCENT': return splitPercent(expense.totalAmount, expense.splits);
    case 'SHARES':  return splitShares(expense.totalAmount, expense.splits);
    default: throw new Error('Unknown split method: ' + expense.splitMethod);
  }
};

module.exports = { calculateSplits, splitEqual, splitExact, splitPercent, splitShares };
