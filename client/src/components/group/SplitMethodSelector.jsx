import React, { useEffect } from 'react';

export default function SplitMethodSelector({
  splitMethod,
  setSplitMethod,
  totalAmount,
  participants,
  shares,
  setShares,
  members,
}) {
  // Sync shares state when participants or split method changes
  useEffect(() => {
    const updatedShares = { ...shares };
    let changed = false;

    // Remove any user not in participants
    Object.keys(updatedShares).forEach((userId) => {
      if (!participants.includes(userId)) {
        delete updatedShares[userId];
        changed = true;
      }
    });

    // Add any missing participant with default empty string
    participants.forEach((userId) => {
      if (updatedShares[userId] === undefined) {
        updatedShares[userId] = '';
        changed = true;
      }
    });

    if (changed) {
      setShares(updatedShares);
    }
  }, [participants]);

  // When split method changes, it's nice to clear inputs to avoid conflicts
  const handleMethodChange = (method) => {
    setSplitMethod(method);
    const cleared = {};
    participants.forEach((userId) => {
      cleared[userId] = method === 'SHARES' ? '1' : '';
    });
    setShares(cleared);
  };

  const getMemberName = (userId) => {
    const member = members.find((m) => m.user.id === userId);
    return member?.user?.name || 'Group Member';
  };

  const handleShareChange = (userId, value) => {
    // Only allow numbers and decimal dots
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setShares((prev) => ({
        ...prev,
        [userId]: value,
      }));
    }
  };

  // Calculations for validations
  const numParticipants = participants.length;
  const parsedAmount = parseFloat(totalAmount) || 0;

  let totalAllocated = 0;
  let remaining = 0;
  let isValid = true;

  if (splitMethod === 'EQUAL') {
    totalAllocated = parsedAmount;
    remaining = 0;
    isValid = numParticipants > 0 && parsedAmount > 0;
  } else if (splitMethod === 'EXACT') {
    totalAllocated = Object.values(shares).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
    remaining = parsedAmount - totalAllocated;
    isValid = Math.abs(remaining) < 0.01 && numParticipants > 0 && parsedAmount > 0;
  } else if (splitMethod === 'PERCENT') {
    totalAllocated = Object.values(shares).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
    remaining = 100 - totalAllocated;
    isValid = Math.abs(remaining) < 0.01 && numParticipants > 0 && parsedAmount > 0;
  } else if (splitMethod === 'SHARES') {
    totalAllocated = Object.values(shares).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
    remaining = 0;
    const allPositive = Object.values(shares).every(
      (val) => parseFloat(val) > 0
    );
    isValid = allPositive && numParticipants > 0 && parsedAmount > 0;
  }

  return (
    <div className="space-y-4 bg-slate-950/40 p-4 border border-white/5 rounded-xl text-left">
      <div className="flex justify-between items-center">
        <label className="text-sm font-semibold text-slate-300">Split Method</label>
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-white/5">
          {['EQUAL', 'EXACT', 'PERCENT', 'SHARES'].map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => handleMethodChange(method)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                splitMethod === method
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {method === 'SHARES' ? 'By Shares' : method}
            </button>
          ))}
        </div>
      </div>

      {numParticipants === 0 ? (
        <p className="text-xs text-rose-400 font-medium">Please select at least one participant to split the expense.</p>
      ) : (
        <div className="space-y-3">
          {/* Member Inputs list */}
          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {participants.map((userId) => {
              const val = shares[userId] || '';
              let calculatedAmount = 0;

              if (splitMethod === 'EQUAL') {
                calculatedAmount = parsedAmount / numParticipants;
              } else if (splitMethod === 'EXACT') {
                calculatedAmount = parseFloat(val) || 0;
              } else if (splitMethod === 'PERCENT') {
                calculatedAmount = (parsedAmount * (parseFloat(val) || 0)) / 100;
              } else if (splitMethod === 'SHARES') {
                const totalShares = Object.values(shares).reduce(
                  (sum, v) => sum + (parseFloat(v) || 0),
                  0
                );
                calculatedAmount = totalShares > 0
                  ? Math.floor(parsedAmount * (parseFloat(val) || 0) / totalShares)
                  : 0;
              }

              return (
                <div key={userId} className="flex items-center justify-between p-2 bg-slate-900/30 border border-white/5 rounded-lg">
                  <span className="text-xs font-semibold text-slate-300 truncate max-w-[150px]">
                    {getMemberName(userId)}
                  </span>

                  <div className="flex items-center space-x-2">
                    {splitMethod === 'EQUAL' && (
                      <span className="text-xs font-bold text-slate-400">
                        ${calculatedAmount.toFixed(2)}
                      </span>
                    )}

                    {splitMethod === 'EXACT' && (
                      <div className="flex items-center bg-slate-950 border border-white/5 focus-within:ring-1 focus-within:ring-purple-500 rounded-lg px-2 py-1 max-w-[100px]">
                        <span className="text-slate-500 text-xs mr-1 font-bold">$</span>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleShareChange(userId, e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-transparent focus:outline-none text-white text-xs font-bold text-right"
                        />
                      </div>
                    )}

                    {splitMethod === 'PERCENT' && (
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-500 font-bold">
                          (${calculatedAmount.toFixed(2)})
                        </span>
                        <div className="flex items-center bg-slate-950 border border-white/5 focus-within:ring-1 focus-within:ring-purple-500 rounded-lg px-2 py-1 max-w-[80px]">
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleShareChange(userId, e.target.value)}
                            placeholder="0"
                            className="w-full bg-transparent focus:outline-none text-white text-xs font-bold text-right"
                          />
                          <span className="text-slate-500 text-xs ml-1 font-bold">%</span>
                        </div>
                      </div>
                    )}

                    {splitMethod === 'SHARES' && (
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-500 font-bold">
                          (${calculatedAmount.toFixed(2)})
                        </span>
                        <div className="flex items-center bg-slate-950 border border-white/5 focus-within:ring-1 focus-within:ring-purple-500 rounded-lg px-2 py-1 max-w-[80px]">
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleShareChange(userId, e.target.value)}
                            placeholder="1"
                            className="w-full bg-transparent focus:outline-none text-white text-xs font-bold text-right"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Validation indicators */}
          <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
            {splitMethod === 'EQUAL' && (
              <span className="text-slate-400 font-medium">Split evenly among {numParticipants} members.</span>
            )}

            {splitMethod === 'EXACT' && (
              <>
                <span className="text-slate-400 font-medium">
                  Total allocated: <span className="font-bold text-white">${totalAllocated.toFixed(2)}</span> of ${parsedAmount.toFixed(2)}
                </span>
                {Math.abs(remaining) < 0.01 ? (
                  <span className="text-emerald-400 font-bold flex items-center">
                    <svg className="h-4 w-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    Balanced
                  </span>
                ) : remaining > 0 ? (
                  <span className="text-amber-400 font-bold">
                    Need ${remaining.toFixed(2)} more
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold">
                    Over by ${Math.abs(remaining).toFixed(2)}
                  </span>
                )}
              </>
            )}

            {splitMethod === 'PERCENT' && (
              <>
                <span className="text-slate-400 font-medium">
                  Total percent: <span className="font-bold text-white">{totalAllocated.toFixed(1)}%</span> of 100%
                </span>
                {Math.abs(remaining) < 0.01 ? (
                  <span className="text-emerald-400 font-bold flex items-center">
                    <svg className="h-4 w-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    100%
                  </span>
                ) : remaining > 0 ? (
                  <span className="text-amber-400 font-bold">
                    Need {remaining.toFixed(1)}% more
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold">
                    Over by {Math.abs(remaining).toFixed(1)}%
                  </span>
                )}
              </>
            )}

            {splitMethod === 'SHARES' && (() => {
              const allocatedSum = participants.reduce((sum, uid) => {
                const sv = parseFloat(shares[uid]) || 0;
                return sum + (totalAllocated > 0 ? Math.floor(parsedAmount * sv / totalAllocated) : 0);
              }, 0);
              const rem = parsedAmount - allocatedSum;
              const totalSharesDisplay = Number.isInteger(totalAllocated)
                ? totalAllocated.toString()
                : totalAllocated.toFixed(2);
              return (
                <>
                  <span className="text-slate-400 font-medium">
                    Total shares: <span className="font-bold text-white">{totalSharesDisplay}</span>
                  </span>
                  {rem !== 0 ? (
                    <span className="text-amber-400 font-bold">
                      Remainder of ${rem.toFixed(2)} goes to first participant
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold flex items-center">
                      <svg className="h-4 w-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                      Balanced
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
