import React from 'react';
import { Link } from 'react-router-dom';

export default function GroupCard({ group }) {
  const balance = group.balance || 0;

  return (
    <Link
      to={`/groups/${group.id}`}
      className="block p-6 bg-slate-900/40 hover:bg-slate-800/40 border border-white/5 rounded-2xl transition-all hover:scale-[1.01] hover:border-white/10 group cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {group.imageURI ? (
            <img
              src={group.imageURI}
              alt={group.title}
              className="h-12 w-12 rounded-xl object-cover border border-white/10"
            />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-lg font-sans">
              {group.title ? group.title[0].toUpperCase() : 'G'}
            </div>
          )}
          <div className="text-left">
            <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
              {group.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>
        </div>

        {/* Balance Status */}
        <div className="text-right">
          {balance > 0 ? (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">you are owed</p>
              <p className="text-base font-bold text-emerald-400">${balance.toFixed(2)}</p>
            </div>
          ) : balance < 0 ? (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">you owe</p>
              <p className="text-base font-bold text-rose-400">${Math.abs(balance).toFixed(2)}</p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">status</p>
              <p className="text-sm font-semibold text-slate-400">settled up</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
