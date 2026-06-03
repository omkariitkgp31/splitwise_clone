import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import SettleUpModal from '../components/group/SettleUpModal';

export default function SettlementsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  const fetchDetailsAndSettlements = async () => {
    setLoading(true);
    try {
      const [groupRes, settlementsRes] = await Promise.all([
        api.get(`/groups/${id}`),
        api.get(`/groups/${id}/settlements`),
      ]);
      setGroup(groupRes.data.group);
      setSettlements(settlementsRes.data.settlements || []);
    } catch (err) {
      console.error('Failed to load settlements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetailsAndSettlements();
    }
  }, [id]);

  const handleConfirm = async (settlementId) => {
    setActioningId(settlementId);
    try {
      await api.patch(`/settlements/${settlementId}/confirm`);
      await fetchDetailsAndSettlements();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm settlement.');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (settlementId) => {
    setActioningId(settlementId);
    try {
      await api.patch(`/settlements/${settlementId}/reject`);
      await fetchDetailsAndSettlements();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject settlement.');
    } finally {
      setActioningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20 bg-slate-900/20 border border-white/5 rounded-3xl p-8 max-w-lg mx-auto">
        <h3 className="text-xl font-bold text-white">Group not found</h3>
        <p className="text-sm text-slate-400 mt-2">The group settlements you are trying to access do not exist.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-xl transition-all cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto animate-fade-in">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link
          to={`/groups/${id}`}
          className="inline-flex items-center space-x-2 text-sm text-purple-400 hover:text-purple-300 font-semibold transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to {group.title}</span>
        </Link>
        
        <button
          onClick={() => setModalOpen(true)}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.01] cursor-pointer"
        >
          Record a Payment
        </button>
      </div>

      <div className="p-6 md:p-8 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md">
        <h1 className="text-2xl font-black text-white mb-1">Settlement Transactions</h1>
        <p className="text-sm text-slate-400 mb-6 font-medium">Verify direct transfers and verify outstanding balances.</p>

        {settlements.length === 0 ? (
          <div className="text-center py-20 bg-slate-950/20 border border-dashed border-white/5 rounded-2xl p-6">
            <svg className="h-10 w-10 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <h3 className="text-base font-bold text-white">No settlements found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              No payments have been recorded for this group yet. Click "Record a Payment" to settle debts.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {settlements.map((s) => {
              const isPayer = s.payerId === user?.id;
              const isPayee = s.payeeId === user?.id;
              const isPending = s.status === 'PENDING_CONFIRMATION';

              let statusColorClass = 'bg-slate-800 text-slate-400 border-white/5';
              let statusText = s.status;

              if (s.status === 'CONFIRMED') {
                statusColorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                statusText = 'Confirmed';
              } else if (s.status === 'REJECTED') {
                statusColorClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                statusText = 'Rejected';
              } else if (isPending) {
                statusColorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                statusText = 'Pending Approval';
              }

              return (
                <div
                  key={s.id}
                  className="p-5 bg-slate-950/20 border border-white/5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                >
                  {/* Settlement Core details */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                    {/* Visual flow layout */}
                    <div className="flex items-center space-x-3">
                      {/* Payer */}
                      <div className="text-center">
                        {s.payer?.imageURI ? (
                          <img
                            src={s.payer.imageURI}
                            alt={s.payer.name}
                            className="h-10 w-10 rounded-xl object-cover border border-white/10"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-sm font-bold text-slate-400">
                            {s.payer?.name[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 font-bold block mt-1 truncate max-w-[80px]">{s.payer?.name}</span>
                      </div>

                      {/* Direction arrow */}
                      <div className="flex flex-col items-center px-1">
                        <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>

                      {/* Payee */}
                      <div className="text-center">
                        {s.payee?.imageURI ? (
                          <img
                            src={s.payee.imageURI}
                            alt={s.payee.name}
                            className="h-10 w-10 rounded-xl object-cover border border-white/10"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-sm font-bold text-slate-400">
                            {s.payee?.name[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 font-bold block mt-1 truncate max-w-[80px]">{s.payee?.name}</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <p className="text-xs text-slate-500 font-medium">
                        Log date: {new Date(s.initiatedAt).toLocaleDateString()} at {new Date(s.initiatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {s.note && (
                        <p className="text-sm text-slate-300 mt-1 italic">
                          "{s.note}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount, status and action buttons */}
                  <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl font-black text-white">${s.amount.toFixed(2)}</span>
                      <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase tracking-wider ${statusColorClass}`}>
                        {statusText}
                      </span>
                    </div>

                    {/* Pending confirm/reject actions */}
                    {isPending && isPayee && (
                      <div className="flex space-x-2 w-full justify-end">
                        <button
                          onClick={() => handleReject(s.id)}
                          disabled={actioningId !== null}
                          className="px-3.5 py-1.5 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleConfirm(s.id)}
                          disabled={actioningId !== null}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg shadow-md cursor-pointer transition-colors"
                        >
                          Confirm Receipt
                        </button>
                      </div>
                    )}

                    {isPending && isPayer && (
                      <span className="text-[10px] text-slate-500 font-semibold italic">Awaiting confirmation from recipient</span>
                    )}

                    {isPending && !isPayer && !isPayee && (
                      <span className="text-[10px] text-slate-500 font-semibold italic">Pending confirmation</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SettleUpModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSettlementCreated={fetchDetailsAndSettlements}
        group={group}
      />
    </div>
  );
}
