import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import SplitMethodSelector from './SplitMethodSelector';

export default function CreateExpenseModal({ isOpen, onClose, onExpenseCreated, group }) {
  const { user } = useAuth();
  const groupId = group?.id;
  const members = group?.members || [];

  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [paidBy, setPaidBy] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [expenseDate, setExpenseDate] = useState('');
  const [imageFile, setImageFile] = useState(null);

  // Split details state
  const [splitMethod, setSplitMethod] = useState('EQUAL');
  const [shares, setShares] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Set default values when modal opens or group details load
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setTotalAmount('');
      setCategory('General');
      setPaidBy(user?.id || '');
      setSelectedParticipants(members.map((m) => m.user.id));
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setImageFile(null);
      setSplitMethod('EQUAL');
      setShares({});
      setError('');
    }
  }, [isOpen, group, user]);

  if (!isOpen) return null;

  const handleParticipantToggle = (userId) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  // Perform client-side split calculations and validation
  const parsedAmount = parseFloat(totalAmount) || 0;
  const numParticipants = selectedParticipants.length;

  let splitValidationPassed = true;
  let validationMessage = '';

  if (parsedAmount <= 0) {
    splitValidationPassed = false;
    validationMessage = 'Please enter a valid total amount.';
  } else if (numParticipants === 0) {
    splitValidationPassed = false;
    validationMessage = 'Please select at least one participant.';
  } else if (splitMethod === 'EXACT') {
    const totalAllocated = Object.values(shares).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
    const diff = parsedAmount - totalAllocated;
    splitValidationPassed = Math.abs(diff) < 0.01;
    if (!splitValidationPassed) {
      validationMessage = `Exact split shares must sum to $${parsedAmount.toFixed(2)}. Current total: $${totalAllocated.toFixed(2)} (diff: $${diff.toFixed(2)})`;
    }
  } else if (splitMethod === 'PERCENT') {
    const totalPct = Object.values(shares).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
    const diff = 100 - totalPct;
    splitValidationPassed = Math.abs(diff) < 0.01;
    if (!splitValidationPassed) {
      validationMessage = `Percent splits must sum to exactly 100%. Current total: ${totalPct.toFixed(1)}%`;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (parsedAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (numParticipants === 0) {
      setError('At least one participant must be selected.');
      return;
    }
    if (!splitValidationPassed) {
      setError(validationMessage);
      return;
    }

    setSubmitting(true);
    try {
      let res;
      // Step 1: Create the base expense
      if (imageFile) {
        const formData = new FormData();
        formData.append('description', description.trim());
        formData.append('totalAmount', parsedAmount);
        formData.append('paidBy', paidBy);
        formData.append('participants', selectedParticipants.join(','));
        formData.append('splitMethod', splitMethod);
        formData.append('category', category);
        formData.append('expenseDate', expenseDate);
        formData.append('image', imageFile);

        res = await api.post(`/groups/${groupId}/expenses`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        res = await api.post(`/groups/${groupId}/expenses`, {
          description: description.trim(),
          totalAmount: parsedAmount,
          paidBy,
          participants: selectedParticipants,
          splitMethod,
          category,
          expenseDate,
        });
      }

      const createdExpense = res.data.expense;

      // Step 2: For EXACT and PERCENT split methods, send the shares PATCH
      if (splitMethod === 'EXACT' || splitMethod === 'PERCENT') {
        const splitPayload = selectedParticipants.map((userId) => {
          const payload = { userId };
          if (splitMethod === 'EXACT') {
            payload.owedAmount = parseFloat(shares[userId]) || 0;
          } else if (splitMethod === 'PERCENT') {
            payload.percentage = parseFloat(shares[userId]) || 0;
          }
          return payload;
        });

        await api.patch(`/expenses/${createdExpense.id}/shares`, {
          splits: splitPayload,
        });
      }

      onExpenseCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative animate-scale-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 text-left">
          <h3 className="text-xl font-bold text-white">Add an Expense</h3>
          <p className="text-sm text-slate-400 mt-1">Split bills and keep track of group expenses.</p>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 text-left">
              {error}
            </div>
          )}

          {/* Row 1: Description & Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Flight ticket, Dinner"
                className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount (USD)</label>
              <input
                type="text"
                value={totalAmount}
                onChange={(e) => {
                  // Only allow digits and dot
                  if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                    setTotalAmount(e.target.value);
                  }
                }}
                placeholder="0.00"
                className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
                required
              />
            </div>
          </div>

          {/* Row 2: Category & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
              >
                {['General', 'Food', 'Travel', 'Entertainment', 'Utilities', 'Shopping', 'Other'].map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Expense Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
                required
              />
            </div>
          </div>

          {/* Row 3: Paid By */}
          <div className="text-left">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Paid By</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
            >
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id} className="bg-slate-900 text-white">
                  {member.user.id === user?.id ? `You (${member.user.name})` : member.user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Split checklist (Participants) */}
          <div className="text-left">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Split With (Participants)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950/40 p-3 border border-white/5 rounded-xl max-h-[120px] overflow-y-auto">
              {members.map((member) => {
                const isChecked = selectedParticipants.includes(member.user.id);
                return (
                  <label
                    key={member.user.id}
                    className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      isChecked ? 'bg-purple-600/10 border border-purple-500/10' : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleParticipantToggle(member.user.id)}
                      className="rounded border-white/10 text-purple-600 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-300 truncate">
                      {member.user.id === user?.id ? 'You' : member.user.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* File Upload (Receipt image) */}
          <div className="text-left">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Receipt Picture (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 cursor-pointer"
            />
            {imageFile && (
              <p className="text-[10px] text-purple-400 mt-1 font-semibold">Selected: {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>

          {/* Split Selector Section */}
          <SplitMethodSelector
            splitMethod={splitMethod}
            setSplitMethod={setSplitMethod}
            totalAmount={totalAmount}
            participants={selectedParticipants}
            shares={shares}
            setShares={setShares}
            members={members}
          />
        </form>

        {/* Modal Footer */}
        <div className="p-6 border-t border-white/5 flex space-x-3 justify-end bg-slate-950/20">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-white/5 text-sm font-semibold text-slate-300 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !splitValidationPassed}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-semibold text-white rounded-xl shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
          >
            {submitting ? 'Adding...' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
