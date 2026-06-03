import React, { useState } from 'react';
import api from '../../api/axios';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageURI, setImageURI] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title || !title.trim()) {
      setError('Group title is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/groups', {
        title: title.trim(),
        description: description.trim(),
        imageURI: imageURI.trim() || null,
      });
      onGroupCreated(res.data.group);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group.');
    } finally {
      setSubmitting(false);
    }
  };

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

        <h3 className="text-xl font-bold text-white mb-2">Create New Group</h3>
        <p className="text-sm text-slate-400 mb-4">Start sharing expenses with friends, roommates, or family.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Group Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="e.g. Ski Trip 2026, Roommates"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="Short description of the group..."
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Group Image URL (Optional)</label>
            <input
              type="url"
              value={imageURI}
              onChange={(e) => setImageURI(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="https://example.com/image.png"
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
              disabled={submitting}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-purple-600/20 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
