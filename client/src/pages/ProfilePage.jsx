import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [groupCount, setGroupCount] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const res = await api.get('/groups');
        const groupsList = res.data.groups || [];
        setGroupCount(groupsList.length);

        // Fetch balances for each group to compute overall net balance
        const promises = groupsList.map(async (group) => {
          try {
            const balanceRes = await api.get(`/groups/${group.id}/balances/me`);
            return balanceRes.data.amount || 0;
          } catch (err) {
            return 0;
          }
        });

        const balances = await Promise.all(promises);
        const total = balances.reduce((sum, b) => sum + b, 0);
        setNetBalance(total);
      } catch (err) {
        console.error('Failed to load profile stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-white m-0">Profile Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account information and view statistics.</p>
      </div>

      {/* Account Info Card */}
      <div className="p-6 md:p-8 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md flex flex-col sm:flex-row items-center gap-6">
        {/* Avatar */}
        {user?.imageURI ? (
          <img
            src={user.imageURI}
            alt={user.name}
            className="h-20 w-20 md:h-24 md:w-24 rounded-3xl object-cover border border-white/10"
          />
        ) : (
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-3xl border border-white/10 font-sans shadow-lg shadow-purple-500/10 flex-shrink-0">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
        )}

        <div className="text-center sm:text-left flex-1 space-y-1">
          <h2 className="text-xl font-bold text-white leading-snug">{user?.name}</h2>
          <p className="text-sm text-slate-400 font-semibold">{user?.email}</p>
          <div className="pt-2">
            <span className="px-2.5 py-1 bg-slate-950/60 border border-white/5 rounded-lg text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">
              Member ID: {user?.id}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Groups */}
        <div className="p-5 bg-slate-950/30 border border-white/5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Active Groups</p>
            <p className="text-3xl font-black text-white mt-1.5">{groupCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-lg">
            👥
          </div>
        </div>

        {/* Overall Net Balance */}
        <div className="p-5 bg-slate-950/30 border border-white/5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Net Position</p>
            {netBalance > 0 ? (
              <p className="text-2xl font-black text-emerald-400 mt-1.5">+${netBalance.toFixed(2)}</p>
            ) : netBalance < 0 ? (
              <p className="text-2xl font-black text-rose-400 mt-1.5">-${Math.abs(netBalance).toFixed(2)}</p>
            ) : (
              <p className="text-2xl font-black text-slate-400 mt-1.5">$0.00</p>
            )}
          </div>
          <div className={`h-10 w-10 rounded-xl border flex items-center justify-center font-bold text-lg ${
            netBalance > 0 
              ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400' 
              : netBalance < 0 
              ? 'bg-rose-500/10 border-rose-500/10 text-rose-400' 
              : 'bg-slate-800 border-white/5 text-slate-400'
          }`}>
            💵
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Log Out Account</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">Sign out of your session on this browser.</p>
        </div>
        <button
          onClick={logout}
          className="px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-rose-950/20"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
