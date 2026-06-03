import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function SettleUpModal({ isOpen, onClose, onSettlementCreated, group }) {
  const { user } = useAuth();
  const groupId = group?.id;
  const members = group?.members || [];

  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Default selection to the first member who isn't the logged-in user
  useEffect(() => {
    if (isOpen) {
      const otherMembers = members.filter((m) => m.user.id !== user?.id);
      setPayeeId(otherMembers[0]?.user?.id || '');
      setAmount('');
      setNote('');
      setError('');
    }
  }, [isOpen, group, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount) || 0;
    if (!payeeId) {
      setError('Please select a recipient.');
      return;
    }
    if (parsedAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/settlements', {
        groupId,
        payeeId,
        amount: parsedAmount,
        note: note.trim() || null,
      });

      onSettlementCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit settlement payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const otherMembers = members.filter((m) => m.user.id !== user?.id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-xl font-bold text-white mb-2">Record a Payment</h3>
        <p className="text-sm text-slate-400 mb-4">Log a payment made outside Splitwise (e.g. via Cash, Venmo, bank transfer).</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 mb-4 text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Recipient (Payee)</label>
            <select
              value={payeeId}
              onChange={(e) => setPayeeId(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
              required
            >
              {otherMembers.length === 0 ? (
                <option value="">No other members in group</option>
              ) : (
                otherMembers.map((member) => (
                  <option key={member.user.id} value={member.user.id} className="bg-slate-900 text-white">
                    {member.user.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount Paid (USD)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => {
                if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                  setAmount(e.target.value);
                }
              }}
              placeholder="0.00"
              className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Note / Memo</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sent via Venmo, Cash handed over"
              rows="3"
              className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold"
            />
          </div>

          <div className="flex space-x-3 pt-4 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-white/5 text-sm font-semibold text-slate-300 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || otherMembers.length === 0}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-semibold text-white rounded-xl shadow-lg shadow-purple-600/20 transition-colors cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
