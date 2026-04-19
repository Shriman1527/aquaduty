import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Home, Plus, LogOut, Users, Droplets, Loader2, KeyRound, Building2, Hash, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const Dashboard = () => {
  const { user, logout, toggleVacation } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  // Form setups
  const createForm = useForm();
  const joinForm = useForm();

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data.data.rooms);
    } catch (error) {
      toast.error('Failed to load your rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  // ─── Create Room Logic ──────────────────────────────────────────────────────
  const onCreateSubmit = async (data) => {
    try {
      const response = await api.post('/rooms', data);
      toast.success(response.data.message);
      setIsCreateOpen(false);
      createForm.reset();
      fetchRooms(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create room');
    }
  };

  // ─── Join Room Logic ────────────────────────────────────────────────────────
  const onJoinSubmit = async (data) => {
    try {
      const response = await api.post('/rooms/join/code', { code: data.code });
      toast.success(response.data.message);
      setIsJoinOpen(false);
      joinForm.reset();
      fetchRooms();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid code or room full');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation remains same as Chunk 5 */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-200">💧</div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">AquaDuty</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleVacation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
              user?.isOnVacation
                ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {user?.isOnVacation ? '🌴 On Vacation' : '🌴 Set Vacation'}
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Your Rooms</h2>
            <p className="text-slate-500">Select a room to manage water duties</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setIsJoinOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <KeyRound className="w-4 h-4" /> Join
            </button>
            <button 
              onClick={() => setIsCreateOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
            >
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        </div>

      {/* Room Grid */}
{loading ? (
  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {rooms.map((room) => (
      <Link 
        to={`/room/${room._id}`} 
        key={room._id}
        className="group bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
      >
        {/* Visual Accent */}
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
              {room.name}
            </h3>
            <p className="text-sm text-slate-500">
              {room.hostelName} • Room {room.roomNumber}
            </p>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Droplets className="w-5 h-5" />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" />
            <span>{room.members?.length || 0} Members</span>
          </div>
          
          {room.currentDuty ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
              Up next: {room.currentDuty.userId?.name.split(' ')[0]}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
              No pending duty
            </span>
          )}
        </div>
      </Link>
    ))}
  </div>
)}

        {/* ─── Create Room Modal ─── */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Room">
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Room Display Name</label>
              <div className="relative">
                <Home className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input {...createForm.register('name', { required: true })} className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" placeholder="e.g. The Legends" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Hostel Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input {...createForm.register('hostelName', { required: true })} className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none" placeholder="Block A" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Room No.</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input {...createForm.register('roomNumber', { required: true })} className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none" placeholder="101" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Duty Frequency (Hours)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input type="number" defaultValue={24} {...createForm.register('dutyFrequencyHours')} className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none" />
              </div>
            </div>
            <button disabled={createForm.formState.isSubmitting} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
              {createForm.formState.isSubmitting ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        </Modal>

        {/* ─── Join Room Modal ─── */}
        <Modal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} title="Join with Code">
          <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-4">
            <p className="text-sm text-slate-500">Ask the room admin for the 6-character invite code.</p>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input 
                {...joinForm.register('code', { required: true, minLength: 6, maxLength: 6 })} 
                className="w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-100 uppercase font-mono text-lg tracking-widest" 
                placeholder="ABC123" 
              />
            </div>
            <button disabled={joinForm.formState.isSubmitting} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all">
              Join Room
            </button>
          </form>
        </Modal>

      </main>
    </div>
  );
};

export default Dashboard;