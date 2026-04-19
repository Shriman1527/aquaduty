import { useState, useEffect } from 'react';
import { useParams, Link ,useNavigate} from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ArrowLeft, Copy, CheckCircle, Clock, Users, Shield, AlertCircle, Loader2, MessageSquare, History, Trophy, TrendingUp, XCircle, Settings, Shuffle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const Room = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();

  const navigate = useNavigate();
  const [isDeleteRoomOpen, setIsDeleteRoomOpen] = useState(false);
  
  const [roomData, setRoomData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // Add this new state

  // Modals State
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // ─── NEW: Admin Modals State ───
  const [isShuffleOpen, setIsShuffleOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);

 const fetchAllData = async () => {
    try {
      const [roomRes, historyRes] = await Promise.all([
        api.get(`/rooms/${roomId}`),
        api.get(`/duty/room/${roomId}/history?page=1`) // Explicitly fetch page 1
      ]);
      setRoomData(roomRes.data.data);
      setHistoryData(historyRes.data.data);
    } catch (error) {
      toast.error('Failed to load room data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchAllData();
  }, [roomId]);

  // ─── Fetch Older History ───
  const fetchMoreHistory = async () => {
    // Prevent fetching if already loading or no more pages exist
    if (loadingMore || !historyData?.pagination?.hasMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = historyData.pagination.page + 1;
      const { data } = await api.get(`/duty/room/${roomId}/history?page=${nextPage}`);
      
      // Update state by appending new logs to the old logs
      setHistoryData(prev => ({
        ...data.data, // Update stats and pagination info
        logs: [...prev.logs, ...data.data.logs] // Spread old logs, then spread new logs
      }));
    } catch (error) {
      toast.error('Failed to load older activity');
    } finally {
      setLoadingMore(false);
    }
  };

  // Socket Listeners
  useEffect(() => {
    if (!socket || !roomId) return;
    
    socket.emit('room:join', roomId);

    socket.on('duty:advanced', (data) => {
      toast(`${data.nextUser?.name.split(' ')[0]} is now on duty!`, { icon: '🔄' });
      fetchAllData(); 
    });

    socket.on('member:joined', (data) => {
      toast.success(`${data.user?.name} joined the room!`, { icon: '👋' });
      fetchAllData();
    });

    // These listen to the Admin actions!
    socket.on('rotation:updated', () => {
      toast('The Admin reshuffled the rotation!', { icon: '🔀' });
      fetchAllData();
    });
    
    socket.on('member:removed', () => {
      fetchAllData(); // Silently update if someone is kicked
    });

    socket.on('room:deleted', () => {
      toast.error('The admin has permanently deleted this room.', { icon: '💥' });
      navigate('/dashboard');
    });


    return () => {
      socket.emit('room:leave', roomId);
      socket.off('duty:advanced');
      socket.off('member:joined');
      socket.off('rotation:updated');
      socket.off('member:removed');
      socket.off('room:deleted')
    };
  }, [socket, roomId]);

  // const copyInviteCode = () => {
  //   navigator.clipboard.writeText(roomData?.room?.inviteCode);
  //   toast.success('Invite code copied!');
  // };

  const copyInviteLink = () => {
    // Dynamically get the current website URL (e.g., http://localhost:5173 or your production domain)
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/join/${roomData?.room?.inviteCode}`;
    
    navigator.clipboard.writeText(inviteLink);
    toast.success('Magic invite link copied to clipboard!');
  };

  const handleCompleteDuty = async (e) => {
    e.preventDefault();
    setIsCompleting(true);
    try {
      const response = await api.patch(`/duty/${roomData.currentDuty._id}/complete`, { notes: completeNotes });
      toast.success(response.data.message || 'Duty marked as complete!');
      setIsCompleteOpen(false);
      setCompleteNotes('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to complete duty');
    } finally {
      setIsCompleting(false);
    }
  };

  // ─── NEW: Admin Functions ───
  const handleShuffleRotation = async () => {
    setIsAdminActionLoading(true);
    try {
      const response = await api.patch(`/rooms/${roomId}/shuffle`);
      toast.success(response.data.message || 'Rotation shuffled!');
      setIsShuffleOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to shuffle rotation');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsAdminActionLoading(true);
    try {
      const response = await api.delete(`/rooms/${roomId}/members/${memberToRemove._id}`);
      toast.success(response.data.message || 'Member removed.');
      setIsRemoveOpen(false);
      setMemberToRemove(null);
      
      // If the admin kicks themselves out (edge case handled by backend), redirect them
      if (memberToRemove._id === user._id) {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    setIsAdminActionLoading(true);
    try {
      await api.delete(`/rooms/${roomId}`);
      toast.success('Room permanently deleted.');
      setIsDeleteRoomOpen(false);
      // We redirect to dashboard; the socket event handles it for other users
      navigate('/dashboard'); 
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete room');
      setIsAdminActionLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  if (!roomData) return null;

  const { room, currentDuty } = roomData;
  const isMyTurn = currentDuty?.userId?._id === user._id;
  const isAdmin = room.adminId._id === user._id; // Check if current user is Admin

  const getMemberName = (id) => {
    const member = room.members.find(m => m.userId._id === id);
    return member ? member.userId.name : 'Unknown User';
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{room.name}</h1>
              <p className="text-xs text-slate-500 font-medium">{room.hostelName} • Room {room.roomNumber}</p>
            </div>
          </div>
          {/* <button onClick={copyInviteCode} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-slate-200">
            <span className="font-mono tracking-widest text-blue-700">{room.inviteCode}</span>
            <Copy className="w-4 h-4 text-slate-400" />
          </button> */}
          
          <button onClick={copyInviteLink} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-slate-200">
            <span className="font-mono tracking-widest text-blue-700">{room.inviteCode}</span>
            <Copy className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (Banner & History) */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`relative overflow-hidden rounded-3xl p-8 border ${isMyTurn ? 'bg-blue-600 border-blue-700 shadow-xl shadow-blue-200/50' : 'bg-white border-slate-200 shadow-sm'}`}>
              {isMyTurn && <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />}
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold mb-4 ${isMyTurn ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                    <AlertCircle className="w-4 h-4" /> Active Duty
                  </div>
                  <h2 className={`text-3xl font-bold mb-2 ${isMyTurn ? 'text-white' : 'text-slate-900'}`}>
                    {isMyTurn ? "It's your turn!" : `${currentDuty?.userId?.name}'s turn`}
                  </h2>
                  <p className={`flex items-center gap-2 ${isMyTurn ? 'text-blue-100' : 'text-slate-500'}`}>
                    <Clock className="w-4 h-4" /> Due: {new Date(currentDuty?.dueDate).toLocaleString()}
                  </p>
                </div>
                <div className="w-full md:w-auto">
                  <button onClick={() => setIsCompleteOpen(true)} disabled={!isMyTurn && !isAdmin} className={`w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${isMyTurn ? 'bg-white text-blue-600 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'}`}>
                    <CheckCircle className="w-6 h-6" /> Mark as Done
                  </button>
                  {!isMyTurn && isAdmin && <p className="text-xs text-center text-slate-400 mt-2 font-medium">Admin override available</p>}
                </div>
              </div>
            </div>
            
            
            {/* History Feed */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
               <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <History className="w-5 h-5 text-blue-600" /> Recent Activity
               </h3>
               
               {historyData?.logs?.length === 0 ? (
                 <p className="text-center text-slate-500 py-8">No duties completed yet.</p>
               ) : (
                 <div className="space-y-4">
                   
                   {/* 1. This loops through and displays all your history logs */}
                   {historyData?.logs?.map((log) => (
                     <div key={log._id} className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                       <div className="mt-1">
                         {log.status === 'done' ? <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><CheckCircle className="w-4 h-4" /></div>
                         : log.status === 'skipped' ? <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center"><XCircle className="w-4 h-4" /></div>
                         : <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><Clock className="w-4 h-4" /></div>}
                       </div>
                       <div className="flex-1">
                         <div className="flex justify-between items-start">
                           <p className="font-bold text-slate-900 text-sm">{log.userId?.name}</p>
                          <span className="text-xs text-slate-500">
  {new Date(log.updatedAt || log.createdAt).toLocaleString([], { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })}
</span>
                         </div>
                         <p className="text-sm text-slate-600 mt-1 capitalize">
                           Status: <span className={`font-semibold ${log.status === 'done' ? 'text-green-600' : 'text-amber-600'}`}>{log.status}</span>
                           {log.isLate && <span className="text-red-500 font-bold ml-2">(Late)</span>}
                         </p>
                         {log.notes && (
                           <div className="mt-2 bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-700 shadow-sm flex gap-2">
                             <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                             <p>"{log.notes}"</p>
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                   
                   {/* 2. NEW BUTTON: Placed right after the map finishes, but still inside the space-y-4 div */}
                   {historyData?.pagination?.hasMore && (
                     <button 
                       onClick={fetchMoreHistory}
                       disabled={loadingMore}
                       className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all disabled:opacity-50"
                     >
                       {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load Older Activity'}
                     </button>
                   )}
                   
                 </div>
               )}
            </div>
          </div>

          {/* Right Column (Admin Panel, Rotation, Stats) */}
          <div className="space-y-6">
            
            {/* ─── NEW: Admin Controls ─── */}
          {/* Admin Controls */}
{isAdmin && (
  <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm border-l-4 border-l-indigo-500 relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
      <Shield className="w-24 h-24 text-indigo-900" />
    </div>
    <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
      <Settings className="w-5 h-5 text-indigo-600" /> Admin Controls
    </h3>
    
    <div className="space-y-3">
      <button 
        onClick={() => setIsShuffleOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
      >
        <Shuffle className="w-4 h-4" /> Shuffle Rotation
      </button>

      {/* NEW DELETE BUTTON */}
      <button 
        onClick={() => setIsDeleteRoomOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 py-2.5 rounded-xl font-bold hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" /> Delete Room
      </button>
    </div>
  </div>
)}
            {/* Rotation Order */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" /> Rotation</h3>
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">{room.members.length}/20</span>
              </div>
              <div className="space-y-3">
                {room.rotationOrder.map((member, index) => {
                  const isCurrent = index === room.currentIndex;
                  const isMemberAdmin = room.adminId._id === member._id;
                  
                  return (
                    <div key={member._id} className={`flex items-center justify-between p-3 rounded-xl border group ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</div>
                        <div>
                          <p className={`font-semibold text-sm ${isCurrent ? 'text-blue-900' : 'text-slate-700'}`}>
                            {member.name} {member._id === user._id && '(You)'}
                          </p>
                          {/* The Badge */}
                          {member.isOnVacation && (
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              🌴 Away
                            </span>
                          )}
                          {isMemberAdmin && <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5"><Shield className="w-3 h-3" /> Admin</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isCurrent && <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                        
                        {/* ─── NEW: Kick Button (Only Admin sees this, can't kick themselves) ─── */}
                        {isAdmin && !isMemberAdmin && (
                          <button 
                            onClick={() => {
                              setMemberToRemove(member);
                              setIsRemoveOpen(true);
                            }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 active:text-red-600 rounded-lg transition-all"
                          title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard</h3>
              {historyData?.memberStats?.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Complete duties to see stats.</p>
              ) : (
                <div className="space-y-4">
                  {historyData?.memberStats?.sort((a, b) => b.done - a.done).map((stat) => (
                    <div key={stat._id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-bold">{getMemberName(stat._id).charAt(0)}</div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{getMemberName(stat._id)}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-500" /> {stat.done} duties completed</p>
                        </div>
                      </div>
                      {stat.late > 0 && <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">{stat.late} Late</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ─── Modals ─── */}
        <Modal isOpen={isCompleteOpen} onClose={() => !isCompleting && setIsCompleteOpen(false)} title="Complete Water Duty">
          <form onSubmit={handleCompleteDuty} className="space-y-5">
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100">
              <span className="font-bold">Awesome!</span> You are marking your current water duty as completed. The rotation will automatically advance to the next person.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400" /> Add a Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} maxLength={300} placeholder="e.g., Fetched 2 big bottles from the ground floor cooler." className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none h-24 text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsCompleteOpen(false)} disabled={isCompleting} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all">Cancel</button>
              <button type="submit" disabled={isCompleting} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                {isCompleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Done'}
              </button>
            </div>
          </form>
        </Modal>

        {/* NEW: Shuffle Confirmation Modal */}
        <Modal isOpen={isShuffleOpen} onClose={() => !isAdminActionLoading && setIsShuffleOpen(false)} title="Shuffle Rotation?">
          <div className="space-y-5">
            <p className="text-slate-600 text-sm">
              Are you sure you want to shuffle the room? This will randomize the order of all members, reset the current cycle, and skip the currently pending duty. 
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsShuffleOpen(false)} disabled={isAdminActionLoading} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleShuffleRotation} disabled={isAdminActionLoading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                {isAdminActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Shuffle It'}
              </button>
            </div>
          </div>
        </Modal>

        {/* NEW: Remove Member Confirmation Modal */}
        <Modal isOpen={isRemoveOpen} onClose={() => !isAdminActionLoading && setIsRemoveOpen(false)} title="Remove Member">
          <div className="space-y-5">
            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm border border-red-100">
              <span className="font-bold">Warning:</span> You are about to permanently kick <strong>{memberToRemove?.name}</strong> from this room.
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsRemoveOpen(false)} disabled={isAdminActionLoading} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleRemoveMember} disabled={isAdminActionLoading} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2">
                {isAdminActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Kick Member'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete Room Confirmation Modal */}
<Modal isOpen={isDeleteRoomOpen} onClose={() => !isAdminActionLoading && setIsDeleteRoomOpen(false)} title="Permanently Delete Room?">
  <div className="space-y-5">
    <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm border border-red-200">
      <span className="font-bold text-red-900 uppercase">Warning:</span> This action is irreversible. All duty history, stats, and member data will be permanently wiped from the database.
    </div>
    <p className="text-slate-600 text-sm">
      Are you absolutely sure you want to destroy <strong>{room.name}</strong>?
    </p>
    <div className="flex gap-3 pt-2">
      <button onClick={() => setIsDeleteRoomOpen(false)} disabled={isAdminActionLoading} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all">Keep Room</button>
      <button onClick={handleDeleteRoom} disabled={isAdminActionLoading} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2">
        {isAdminActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Delete Everything'}
      </button>
    </div>
  </div>
</Modal>

      </main>
    </div>
  );
};

export default Room;