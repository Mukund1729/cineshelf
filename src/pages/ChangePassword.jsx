import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.put('/api/user/password', { oldPassword, newPassword }, { headers, withCredentials: true });
      
      setMessage('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Password change error:', err);
      setError(err.response?.data?.error || 'Failed to change password');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#181c24] via-[#232526] to-[#0a1833] text-white">
      {/* Header */}
      <div className="relative">
        <div className="absolute top-4 left-4 z-50 select-none">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span className="text-lg font-extrabold tracking-tight font-playfair text-white px-4 py-1 rounded-full shadow-lg bg-[#1e0000a0] border border-[#ffd6c1] hover:bg-[#ffd6c133] transition-colors" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '0.04em', textShadow: '0 2px 8px #2d0101' }}>
              visual.cineaste
            </span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold font-playfair tracking-tight text-cyan-300 drop-shadow-lg mb-2">
              Change Password
            </h1>
            <p className="text-gray-400">Update your account password</p>
          </div>

          {/* Messages */}
          {message && (
            <div className="mb-6 bg-green-600 text-white p-3 rounded-lg text-center">
              {message}
            </div>
          )}
          
          {error && (
            <div className="mb-6 bg-red-600 text-white p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="bg-[#232526] rounded-xl shadow-lg p-6 border border-cyan-700">
      <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-cyan-200 mb-2">Current Password</label>
                <input 
                  type="password" 
                  placeholder="Enter your current password" 
                  value={oldPassword} 
                  onChange={e => setOldPassword(e.target.value)} 
                  required
                  className="w-full px-4 py-2 rounded bg-[#181c24] text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 border border-cyan-900" 
                />
              </div>
              
              <div>
                <label className="block text-cyan-200 mb-2">New Password</label>
                <input 
                  type="password" 
                  placeholder="Enter your new password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required
                  minLength={8}
                  className="w-full px-4 py-2 rounded bg-[#181c24] text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 border border-cyan-900" 
                />
                <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters long</p>
              </div>
              
              <div>
                <label className="block text-cyan-200 mb-2">Confirm New Password</label>
                <input 
                  type="password" 
                  placeholder="Confirm your new password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required
                  className="w-full px-4 py-2 rounded bg-[#181c24] text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 border border-cyan-900" 
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className={`w-full py-2 rounded font-semibold transition ${
                  loading 
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                    : 'bg-cyan-600 text-white hover:bg-cyan-700'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Changing Password...
                  </span>
                ) : (
                  'Change Password'
                )}
              </button>
      </form>
            
            <div className="mt-6 text-center">
              <Link to="/profile" className="text-cyan-400 hover:text-cyan-300 text-sm">
                ← Back to Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
