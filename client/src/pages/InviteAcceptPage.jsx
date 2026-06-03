import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchInviteDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/invite/${token}`);
        setInvite(res.data.invite);
      } catch (err) {
        console.error('Failed to load invite details:', err);
        setError(err.response?.data?.message || 'This invitation link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInviteDetails();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with a redirect query param
      navigate(`/login?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setError('');
    try {
      const res = await api.post(`/invite/${token}/accept`);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/groups/${res.data.groupId}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept invitation.');
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-8 text-center animate-scale-up">
        
        {/* Decorative Badge */}
        <div className="mx-auto h-16 w-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/10 flex items-center justify-center text-purple-400 font-extrabold text-2xl rounded-2xl mb-6">
          ✉️
        </div>

        {error ? (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Invalid Invitation</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">{error}</p>
            <div className="pt-4">
              <Link
                to="/dashboard"
                className="inline-block px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-xl transition-all cursor-pointer"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-emerald-400">Invitation Accepted!</h3>
            <p className="text-sm text-slate-400 font-medium">Redirecting you to the group workspace...</p>
            <div className="flex justify-center pt-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white">Group Invitation</h3>
              <p className="text-sm text-slate-400 mt-2 font-medium">
                <span className="font-bold text-white">{invite.inviterName}</span> has invited you to join the group{' '}
                <span className="font-bold text-purple-400">"{invite.groupName}"</span>.
              </p>
            </div>

            {/* Check email matches logged in user */}
            {user && user.email.toLowerCase() !== invite.email.toLowerCase() && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 text-left font-medium">
                ⚠️ Warning: This invitation was sent to <span className="font-bold">{invite.email}</span>, but you are logged in as{' '}
                <span className="font-bold">{user.email}</span>. Please switch accounts if this is incorrect.
              </div>
            )}

            {!user ? (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-slate-400 font-medium">Please log in or register to join this group.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to={`/login?redirect=/invite/${token}`}
                    className="py-2.5 border border-white/5 hover:bg-white/5 text-sm font-semibold text-slate-300 rounded-xl transition-all cursor-pointer"
                  >
                    Log In
                  </Link>
                  <Link
                    to={`/register?redirect=/invite/${token}`}
                    className="py-2.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
                  >
                    Register
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl shadow-lg shadow-purple-600/25 hover:scale-[1.01] transition-all cursor-pointer"
                >
                  {accepting ? 'Joining Group...' : 'Accept Invitation & Join'}
                </button>
                <Link
                  to="/dashboard"
                  className="block text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Decline & Go to Dashboard
                </Link>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
