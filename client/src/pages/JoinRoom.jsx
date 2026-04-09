import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Loader2, CheckCircle, XCircle, Home } from 'lucide-react';

const JoinRoom = () => {
  const { code } = useParams(); // Grab the code from the URL
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('joining'); // 'joining', 'success', 'error'
  const [message, setMessage] = useState('Joining room...');
  const [roomId, setRoomId] = useState(null);

  // Prevent React StrictMode from firing the API twice
  const hasAttemptedJoin = useRef(false);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setMessage('Invalid invite link.');
      return;
    }

    const autoJoinRoom = async () => {
      if (hasAttemptedJoin.current) return;
      hasAttemptedJoin.current = true;

      try {
        // Hit your existing join-by-code endpoint!
        const response = await api.post('/rooms/join/code', { code: code.toUpperCase() });
        
        setStatus('success');
        setMessage(response.data.message);
        setRoomId(response.data.data.room._id);
        
        // Wait 2 seconds so they see the success message, then teleport them into the room
        setTimeout(() => {
          navigate(`/room/${response.data.data.room._id}`);
        }, 2000);

      } catch (error) {
        setStatus('error');
        // If they are already a member, your backend safely returns a 400. We can handle that gracefully!
        const errorMsg = error.response?.data?.message || 'Failed to join room. The link may be invalid.';
        setMessage(errorMsg);
      }
    };

    autoJoinRoom();
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
        
        {status === 'joining' && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">Joining Room...</h2>
            <p className="text-slate-500 font-mono tracking-widest bg-slate-100 py-2 rounded-lg">{code.toUpperCase()}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Successfully Joined!</h2>
            <p className="text-slate-500">{message}</p>
            <p className="text-sm text-slate-400 animate-pulse mt-4">Taking you to the room...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Couldn't Join Room</h2>
            <p className="text-slate-500">{message}</p>
            
            <Link 
              to="/dashboard" 
              className="mt-6 w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
            >
              <Home className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};

export default JoinRoom;