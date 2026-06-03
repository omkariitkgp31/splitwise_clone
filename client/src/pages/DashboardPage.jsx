import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import GroupCard from '../components/dashboard/GroupCard';
import CreateGroupModal from '../components/dashboard/CreateGroupModal';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchGroupsAndBalances = async () => {
    setLoading(true);
    try {
      const res = await api.get('/groups');
      const groupsList = res.data.groups || [];

      // Fetch balances for each group concurrently
      const promises = groupsList.map(async (group) => {
        try {
          const balanceRes = await api.get(`/groups/${group.id}/balances/me`);
          return { ...group, balance: balanceRes.data.amount };
        } catch (err) {
          console.error(`Failed to fetch balance for group ${group.id}:`, err);
          return { ...group, balance: 0 };
        }
      });

      const updatedGroups = await Promise.all(promises);
      setGroups(updatedGroups);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupsAndBalances();
  }, []);

  const handleGroupCreated = (newGroup) => {
    navigate(`/groups/${newGroup.id}`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white m-0">Dashboard</h1>
          <p className="text-slate-400 mt-1 font-medium">Welcome back! Manage your shared expenses here.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-purple-600/20 hover:scale-[1.01] transition-all cursor-pointer focus:outline-none"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Group</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-slate-900/20 border border-dashed border-white/5 rounded-3xl p-8">
          <div className="h-16 w-16 bg-slate-900/60 rounded-2xl flex items-center justify-center border border-white/5 text-slate-400 mb-4">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">No groups found</h3>
          <p className="text-sm text-slate-400 text-center max-w-sm mt-1 font-medium">
            You are not part of any expense sharing groups yet. Create one to start tracking splits.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-6 px-5 py-2.5 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-400 text-sm font-semibold rounded-xl transition-all cursor-pointer focus:outline-none"
          >
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      <CreateGroupModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
}
