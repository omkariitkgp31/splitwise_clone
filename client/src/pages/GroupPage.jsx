import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CreateExpenseModal from '../components/group/CreateExpenseModal';

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, emitJoinGroup, emitLeaveGroup } = useSocket();

  const [activeTab, setActiveTab] = useState('expenses');
  const [group, setGroup] = useState(null);
  const [myBalance, setMyBalance] = useState(0);

  // Paginated Expenses state
  const [expenses, setExpenses] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  // Balances state
  const [balances, setBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Chat/Messages state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Loading group details
  const [loadingGroup, setLoadingGroup] = useState(true);

  // Invite states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Scroll ref for chat
  const messagesEndRef = useRef(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  // Fetch Group Details & Net Balance
  const fetchGroupDetails = async () => {
    try {
      const res = await api.get(`/groups/${id}`);
      setGroup(res.data.group);
      
      const balRes = await api.get(`/groups/${id}/balances/me`);
      setMyBalance(balRes.data.amount || 0);
    } catch (err) {
      console.error('Failed to fetch group details:', err);
    } finally {
      setLoadingGroup(false);
    }
  };

  // Fetch Paginated Expenses
  const fetchExpenses = async (targetPage) => {
    setLoadingExpenses(true);
    try {
      const res = await api.get(`/groups/${id}/expenses?page=${targetPage}&limit=10`);
      setExpenses(res.data.expenses || []);
      setPage(res.data.pagination.page);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  // Fetch Simplified Balances
  const fetchBalances = async () => {
    setLoadingBalances(true);
    try {
      const res = await api.get(`/groups/${id}/balances`);
      setBalances(res.data.transactions || []);
    } catch (err) {
      console.error('Failed to fetch group balances:', err);
    } finally {
      setLoadingBalances(false);
    }
  };

  // Fetch Chat Messages
  const fetchMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/groups/${id}/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Initial group fetch and socket joins
  useEffect(() => {
    if (!id) return;
    setLoadingGroup(true);
    setPage(1);
    setGroup(null);
    setExpenses([]);
    setBalances([]);
    setMessages([]);
    
    fetchGroupDetails();
    emitJoinGroup(id);

    return () => {
      emitLeaveGroup(id);
    };
  }, [id]);

  // Tab Data Fetcher
  useEffect(() => {
    if (!group) return;
    if (activeTab === 'expenses') {
      fetchExpenses(page);
    } else if (activeTab === 'balances') {
      fetchBalances();
    } else if (activeTab === 'chat') {
      fetchMessages();
    }
  }, [activeTab, id, group]);

  // Socket event handler for messaging & balances
  useEffect(() => {
    if (!socket || !id) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleBalanceUpdate = (data) => {
      if (data.groupId === id) {
        fetchGroupDetails();
        if (activeTab === 'expenses') {
          fetchExpenses(page);
        } else if (activeTab === 'balances') {
          fetchBalances();
        }
      }
    };

    socket.on('new:group-message', handleNewMessage);
    socket.on('balance:updated', handleBalanceUpdate);

    return () => {
      socket.off('new:group-message', handleNewMessage);
      socket.off('balance:updated', handleBalanceUpdate);
    };
  }, [socket, id, activeTab, page]);

  // Auto scroll chat list
  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    socket.emit('send:group-message', {
      groupId: id,
      message: newMessage.trim(),
    });
    setNewMessage('');
  };

  // Invite member by email
  const handleInviteMember = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      const res = await api.post(`/groups/${id}/invite`, {
        email: inviteEmail.trim(),
      });
      if (res.data.method === 'direct') {
        setInviteSuccess('User added directly to the group!');
        fetchGroupDetails();
      } else {
        setInviteSuccess('Invitation email sent successfully!');
      }
      setInviteEmail('');
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Failed to send invite.');
    } finally {
      setInviting(false);
    }
  };

  // Helper: Get member info
  const getMemberInfo = (userId) => {
    const member = group?.members?.find((m) => m.user.id === userId);
    return member?.user || { id: userId, name: 'Group Member', imageURI: null };
  };

  const isAdmin = group?.members?.some(
    (m) => m.user.id === user?.id && m.role === 'ADMIN'
  );

  if (loadingGroup) {
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
        <p className="text-sm text-slate-400 mt-2">The group you are trying to access does not exist or you are not a member.</p>
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
    <div className="space-y-8 animate-fade-in text-left">
      {/* Group Header */}
      <div className="p-6 md:p-8 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-5">
          {group.imageURI ? (
            <img
              src={group.imageURI}
              alt={group.title}
              className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover border border-white/10"
            />
          ) : (
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/10 flex items-center justify-center text-purple-400 font-extrabold text-2xl md:text-3xl">
              {group.title ? group.title[0].toUpperCase() : 'G'}
            </div>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white m-0">{group.title}</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl font-medium">{group.description || 'No description provided.'}</p>
          </div>
        </div>

        {/* Group Net Balance Status */}
        <div className="w-full md:w-auto p-4 bg-slate-950/40 border border-white/5 rounded-xl text-center md:text-left min-w-[200px]">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Your Group Position</p>
          {myBalance > 0 ? (
            <p className="text-xl font-black text-emerald-400 mt-1">You are owed ${myBalance.toFixed(2)}</p>
          ) : myBalance < 0 ? (
            <p className="text-xl font-black text-rose-400 mt-1">You owe ${Math.abs(myBalance).toFixed(2)}</p>
          ) : (
            <p className="text-lg font-bold text-slate-400 mt-1">All settled up</p>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Active Tab Workspace */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-white/5 p-1 bg-slate-900/20 rounded-xl">
            {['expenses', 'balances', 'chat'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-semibold capitalize rounded-lg transition-all cursor-pointer focus:outline-none ${
                  activeTab === tab
                    ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow-inner shadow-purple-900/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Workspace Contents */}
          <div className="flex-1">
            
            {/* 1. EXPENSES TAB */}
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Expenses History</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setExpenseModalOpen(true)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-600/10"
                    >
                      Add Expense
                    </button>
                    <button
                      onClick={() => navigate(`/groups/${id}/settlements`)}
                      className="px-4 py-2 border border-purple-500/20 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      View Settlements
                    </button>
                  </div>
                </div>

                {loadingExpenses ? (
                  <div className="flex justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/10 border border-dashed border-white/5 rounded-2xl p-6">
                    <p className="text-sm text-slate-400 font-medium">No expenses yet. Add one to split expenses!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map((expense) => {
                      const userSplit = expense.splits?.find((s) => s.userId === user.id);
                      const paidByMe = expense.paidBy === user.id;

                      let shareText = '';
                      let shareStyle = 'text-slate-400';

                      if (paidByMe) {
                        const othersOwed = expense.totalAmount - (userSplit?.owedAmount || 0);
                        shareText = othersOwed > 0 ? `You lent $${othersOwed.toFixed(2)}` : 'You paid';
                        shareStyle = 'text-emerald-400';
                      } else if (userSplit) {
                        shareText = `You owe $${userSplit.owedAmount.toFixed(2)}`;
                        shareStyle = 'text-rose-400';
                      } else {
                        shareText = 'Not involved';
                      }

                      return (
                        <Link
                          key={expense.id}
                          to={`/groups/${id}/expenses/${expense.id}`}
                          className="flex items-center justify-between p-4 bg-slate-900/30 hover:bg-slate-800/30 border border-white/5 hover:border-white/10 rounded-xl transition-all group"
                        >
                          <div className="flex items-center space-x-4">
                            {/* Date Badge */}
                            <div className="bg-slate-950/60 border border-white/5 rounded-lg p-2.5 text-center min-w-[50px]">
                              <p className="text-[10px] text-slate-400 uppercase tracking-tight font-bold">
                                {new Date(expense.timestamp).toLocaleDateString(undefined, { month: 'short' })}
                              </p>
                              <p className="text-lg font-black text-white leading-none mt-0.5">
                                {new Date(expense.timestamp).getDate()}
                              </p>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                                {expense.title}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1">
                                Paid by <span className="font-semibold text-slate-300">{expense.payer?.name}</span> • ${expense.totalAmount.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className={`text-xs font-semibold ${shareStyle}`}>{shareText}</p>
                            <p className="text-[10px] text-slate-400 mt-1 capitalize font-medium">{expense.category}</p>
                          </div>
                        </Link>
                      );
                    })}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex justify-between items-center pt-4">
                        <button
                          disabled={page === 1}
                          onClick={() => fetchExpenses(page - 1)}
                          className="px-4 py-2 border border-white/5 hover:bg-white/5 text-xs text-slate-300 font-semibold rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-slate-400 font-medium">Page {page} of {totalPages}</span>
                        <button
                          disabled={page === totalPages}
                          onClick={() => fetchExpenses(page + 1)}
                          className="px-4 py-2 border border-white/5 hover:bg-white/5 text-xs text-slate-300 font-semibold rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. BALANCES TAB */}
            {activeTab === 'balances' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Simplified Debts</h3>
                  <button
                    onClick={() => navigate(`/groups/${id}/settlements`)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-600/10"
                  >
                    Settle Up
                  </button>
                </div>

                {loadingBalances ? (
                  <div className="flex justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
                  </div>
                ) : balances.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/10 border border-dashed border-white/5 rounded-2xl p-6">
                    <p className="text-sm text-slate-400 font-medium">Everyone is settled up! No debts to display.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {balances.map((tx, idx) => {
                      const fromInfo = getMemberInfo(tx.from);
                      const toInfo = getMemberInfo(tx.to);
                      
                      const isDebtor = tx.from === user.id;
                      const isCreditor = tx.to === user.id;

                      let debtMessage = '';
                      let debtColorClass = 'text-slate-300';
                      
                      if (isDebtor) {
                        debtMessage = `You owe ${toInfo.name}`;
                        debtColorClass = 'text-rose-400';
                      } else if (isCreditor) {
                        debtMessage = `${fromInfo.name} owes you`;
                        debtColorClass = 'text-emerald-400';
                      } else {
                        debtMessage = `${fromInfo.name} owes ${toInfo.name}`;
                      }

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-slate-900/30 border border-white/5 rounded-xl"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex -space-x-2">
                              {/* Debtor Avatar */}
                              {fromInfo.imageURI ? (
                                <img
                                  src={fromInfo.imageURI}
                                  alt={fromInfo.name}
                                  className="h-8 w-8 rounded-full object-cover border border-slate-950"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-xs font-bold text-slate-400">
                                  {fromInfo.name[0].toUpperCase()}
                                </div>
                              )}
                              {/* Creditor Avatar */}
                              {toInfo.imageURI ? (
                                <img
                                  src={toInfo.imageURI}
                                  alt={toInfo.name}
                                  className="h-8 w-8 rounded-full object-cover border border-slate-950"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-xs font-bold text-slate-400">
                                  {toInfo.name[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className={`text-sm font-semibold ${debtColorClass}`}>{debtMessage}</span>
                          </div>

                          <div className="flex items-center space-x-4">
                            <span className="text-base font-bold text-white">${tx.amount.toFixed(2)}</span>
                            {(isDebtor || isCreditor) && (
                              <button
                                onClick={() => navigate(`/groups/${id}/settlements`)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/5 text-[11px] font-bold text-slate-300 rounded-lg transition-colors cursor-pointer"
                              >
                                Settle
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-[500px] bg-slate-900/10 border border-white/5 rounded-2xl overflow-hidden">
                {/* Messages Panel */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                      <svg className="h-8 w-8 text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="font-medium">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.user.id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2.5 max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                        >
                          {/* Avatar */}
                          {msg.user.imageURI ? (
                            <img
                              src={msg.user.imageURI}
                              alt={msg.user.name}
                              className="h-8 w-8 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                              {msg.user.name[0].toUpperCase()}
                            </div>
                          )}

                          <div>
                            {/* Meta */}
                            <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-xs font-bold text-slate-300">{msg.user.name}</span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {new Date(msg.timestamp).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            
                            {/* Message Bubble */}
                            <div
                              className={`p-3 text-sm rounded-2xl ${
                                isMe
                                  ? 'bg-purple-600 text-white rounded-tr-none'
                                  : 'bg-slate-900 border border-white/5 text-slate-200 rounded-tl-none'
                              }`}
                            >
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Panel */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-slate-950/20 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-950 border border-white/5 focus:outline-none focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    <svg className="h-5 w-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>

        {/* Right Side: Members & Invite Panel */}
        <div className="space-y-6">
          
          {/* Members List */}
          <div className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md">
            <h3 className="text-lg font-bold text-white mb-4">Group Members</h3>
            <div className="space-y-3">
              {group.members?.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="flex items-center space-x-3">
                    {member.user.imageURI ? (
                      <img
                        src={member.user.imageURI}
                        alt={member.user.name}
                        className="h-9 w-9 rounded-xl object-cover border border-white/10"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-sm font-bold text-slate-400">
                        {member.user.name[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{member.user.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{member.user.email}</p>
                    </div>
                  </div>

                  {member.role === 'ADMIN' ? (
                    <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-[9px] font-black text-purple-400 rounded-md tracking-wider uppercase">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-800 text-[9px] font-semibold text-slate-400 rounded-md uppercase">
                      Member
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Invite Member Section */}
          {isAdmin && (
            <div className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md">
              <h3 className="text-sm font-bold text-white mb-2">Invite Members</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed font-medium">Add people directly if they are registered, or send an invitation link by email.</p>

              {inviteSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400 mb-4">
                  {inviteSuccess}
                </div>
              )}

              {inviteError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 mb-4">
                  {inviteError}
                </div>
              )}

              <form onSubmit={handleInviteMember} className="space-y-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@email.com"
                  required
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-white/5 focus:outline-none focus:ring-1 focus:ring-purple-500 rounded-xl text-xs text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-55 text-xs font-bold text-white rounded-xl shadow-lg shadow-purple-600/10 transition-all cursor-pointer"
                >
                  {inviting ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </form>
            </div>
          )}
        </div>

      </div>

      <CreateExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        onExpenseCreated={() => {
          fetchGroupDetails();
          fetchExpenses(1);
        }}
        group={group}
      />
    </div>
  );
}
