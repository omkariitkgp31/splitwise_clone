import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function ExpenseDetailPage() {
  const { id, expId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [expense, setExpense] = useState(null);
  const [group, setGroup] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState('');

  const commentsEndRef = useRef(null);

  const fetchExpenseAndGroup = async () => {
    setLoading(true);
    try {
      const [expenseRes, groupRes, commentsRes] = await Promise.all([
        api.get(`/expenses/${expId}`),
        api.get(`/groups/${id}`),
        api.get(`/expenses/${expId}/comments`),
      ]);
      setExpense(expenseRes.data.expense);
      setGroup(groupRes.data.group);
      setComments(commentsRes.data.comments || []);
    } catch (err) {
      console.error('Failed to fetch details:', err);
      setError(err.response?.data?.message || 'Failed to load expense details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseAndGroup();
  }, [id, expId]);

  // Socket room connection & comment listener
  useEffect(() => {
    if (!socket || !expId) return;

    // Join Expense Room
    socket.emit('join:expense', { expenseId: expId });

    const handleNewComment = (comment) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
    };

    socket.on('new:expense-comment', handleNewComment);

    return () => {
      socket.emit('leave:expense', { expenseId: expId });
      socket.off('new:expense-comment', handleNewComment);
    };
  }, [socket, expId]);

  // Auto scroll comments
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!newComment.trim() || !socket) return;
    
    socket.emit('send:expense-comment', {
      expenseId: expId,
      message: newComment.trim(),
    });
    setNewComment('');
  };

  const handleDeleteExpense = async () => {
    if (!window.confirm('Are you sure you want to delete this expense? This will revert balance splits.')) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/expenses/${expId}`);
      navigate(`/groups/${id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  const isAdmin = group?.members?.some(
    (m) => m.user.id === user?.id && m.role === 'ADMIN'
  );
  
  const canDelete = expense?.createdBy === user?.id || isAdmin;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="text-center py-20 bg-slate-900/20 border border-white/5 rounded-3xl p-8 max-w-lg mx-auto">
        <h3 className="text-xl font-bold text-white">Expense not found</h3>
        <p className="text-sm text-slate-400 mt-2">{error || 'This expense does not exist or has been deleted.'}</p>
        <button
          onClick={() => navigate(`/groups/${id}`)}
          className="mt-6 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-xl transition-all cursor-pointer"
        >
          Back to Group
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto animate-fade-in">
      {/* Navigation Header */}
      <div>
        <Link
          to={`/groups/${id}`}
          className="inline-flex items-center space-x-2 text-sm text-purple-400 hover:text-purple-300 font-semibold transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to {group?.title || 'Group'}</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Main details & Receipt */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Card */}
          <div className="p-6 md:p-8 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-xs font-black text-purple-400 rounded-lg tracking-wider uppercase">
                  {expense.category}
                </span>
                <h1 className="text-2xl md:text-3xl font-black text-white mt-3 m-0 leading-tight">
                  {expense.title}
                </h1>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Added on {new Date(expense.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Large Dollar Figure */}
              <div className="bg-slate-950/60 p-4 border border-white/5 rounded-2xl text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Cost</p>
                <p className="text-2xl md:text-3xl font-black text-white mt-1">${expense.totalAmount.toFixed(2)}</p>
              </div>
            </div>

            {/* Payer & Status metadata */}
            <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-center space-x-3.5">
                {expense.payer?.imageURI ? (
                  <img
                    src={expense.payer.imageURI}
                    alt={expense.payer.name}
                    className="h-10 w-10 rounded-xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-sm font-bold text-slate-400">
                    {expense.payer?.name[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Paid By</p>
                  <p className="text-sm font-bold text-white mt-0.5">{expense.payer?.name}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3.5">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                  expense.isSettled 
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                }`}>
                  {expense.isSettled ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Split Mode Status</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {expense.splitMethod} Split • {expense.isSettled ? 'Settled Share' : 'Awaiting shares'}
                  </p>
                </div>
              </div>
            </div>

            {/* Delete button option */}
            {canDelete && (
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                <button
                  onClick={handleDeleteExpense}
                  disabled={deleting}
                  className="px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>{deleting ? 'Deleting...' : 'Delete Expense'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Receipt Image Frame */}
          {expense.imageURI && (
            <div className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white">Attached Receipt</h3>
                <a
                  href={expense.imageURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  View full image
                </a>
              </div>
              <div className="border border-white/5 rounded-xl overflow-hidden bg-slate-950/30 flex justify-center p-4">
                <img
                  src={expense.imageURI}
                  alt="Receipt attachment"
                  className="max-h-[300px] w-auto rounded-lg object-contain shadow-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Splits Breakdown & Comments */}
        <div className="space-y-6">
          {/* Split shares breakdown list */}
          <div className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-4">Split Breakdown</h3>
            <div className="space-y-3.5">
              {expense.splits?.map((split) => {
                const isUserMe = split.user?.id === user?.id;
                return (
                  <div
                    key={split.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      isUserMe 
                        ? 'bg-purple-600/10 border-purple-500/25' 
                        : 'bg-slate-950/30 border-white/5'
                    }`}
                  >
                    <div className="flex items-center space-x-3 truncate">
                      {split.user?.imageURI ? (
                        <img
                          src={split.user.imageURI}
                          alt={split.user.name}
                          className="h-8 w-8 rounded-lg object-cover border border-white/5"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                          {split.user?.name[0].toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <p className={`text-xs font-bold truncate ${isUserMe ? 'text-purple-300' : 'text-white'}`}>
                          {isUserMe ? 'You' : split.user?.name}
                        </p>
                        {split.percentage && (
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">{parseFloat(split.percentage).toFixed(1)}% share</p>
                        )}
                      </div>
                    </div>

                    <span className="text-sm font-black text-white">${split.owedAmount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity / Comments Panel */}
          <div className="flex flex-col h-[400px] bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-white">Comments & Activity</h3>
            </div>

            {/* Comments list container */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                  <svg className="h-6 w-6 text-slate-700 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <p className="font-semibold">No comments yet. Leave a note!</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const isMe = comment.user.id === user.id;
                  return (
                    <div
                      key={comment.id}
                      className={`flex items-start gap-2.5 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                    >
                      {/* Avatar */}
                      {comment.user.imageURI ? (
                        <img
                          src={comment.user.imageURI}
                          alt={comment.user.name}
                          className="h-7 w-7 rounded-full object-cover border border-white/5 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">
                          {comment.user.name[0].toUpperCase()}
                        </div>
                      )}

                      <div>
                        {/* Meta metadata details */}
                        <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] font-bold text-slate-300">{comment.user.name}</span>
                          <span className="text-[9px] text-slate-500">
                            {new Date(comment.timestamp || comment.createdAt).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Comment text bubble */}
                        <div
                          className={`p-2.5 text-xs rounded-xl ${
                            isMe
                              ? 'bg-purple-600 text-white rounded-tr-none'
                              : 'bg-slate-900 border border-white/5 text-slate-200 rounded-tl-none'
                          }`}
                        >
                          <p className="leading-normal whitespace-pre-wrap">{comment.message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment inputs footer */}
            <form onSubmit={handlePostComment} className="p-3 border-t border-white/5 bg-slate-950/20 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-slate-950 border border-white/5 focus:outline-none focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-semibold"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
