import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/api/user/profile', { headers: { Authorization: `Bearer ${token}` }, withCredentials: true })
      .then(res => setUser(res.data?.user || null))
      .catch(() => setError('Could not fetch user info'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-cyan-300">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center text-gray-400">No user info found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#181c24] via-[#232526] to-[#0a1833] text-white p-8 flex flex-col items-center">
      <div className="absolute top-4 left-4 z-50 select-none">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span className="text-lg font-extrabold tracking-tight font-playfair text-white px-4 py-1 rounded-full shadow-lg bg-[#1e0000a0] border border-[#ffd6c1] hover:bg-[#ffd6c133] transition-colors" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '0.04em', textShadow: '0 2px 8px #2d0101' }}>
            visual.cineaste
          </span>
        </Link>
      </div>
      <div className="bg-[#232526] rounded-xl shadow-lg border border-cyan-700 px-8 py-6 mt-16 w-full max-w-md flex flex-col items-center">
        <img src={user.avatarUrl || 'https://via.placeholder.com/80x80?text=User'} alt={user.name} className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400 mb-4" />
        <div className="font-bold text-2xl text-cyan-200 mb-2">{user.name}</div>
        <div className="text-sm text-gray-400 mb-2">Email: {user.email}</div>
        <div className="text-sm text-gray-400 mb-2">User ID: {user._id}</div>
        <div className="text-sm text-gray-400">Joined: {new Date(user.createdAt).toLocaleDateString()}</div>
      </div>
    </div>
  );
}
