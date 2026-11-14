import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';
import { tmdbImageUrl } from '../api/tmdb';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [sakha, setSakha] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [lists, setLists] = useState([]);
  const [diary, setDiary] = useState([]);
  const [activityError, setActivityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    bio: '',
    avatar: '',
    socials: { instagram: '', twitter: '', website: '' }
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to view your profile');
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch user profile
      const profileRes = await axios.get('/api/user/profile', { headers, withCredentials: true });
      const profileData = profileRes.data?.data || profileRes.data;
      const currentProfile = profileData?.user || profileData;
      setProfile(currentProfile);

      // Initialize edit form
      setEditForm({
        name: currentProfile?.name || '',
        username: currentProfile?.username || '',
        bio: currentProfile?.bio || '',
        avatar: currentProfile?.avatar || '',
        socials: currentProfile?.socials || { instagram: '', twitter: '', website: '' }
      });

      const results = await Promise.allSettled([
        axios.get('/api/watchlist', { headers, withCredentials: true }),
        axios.get('/api/review', { headers, withCredentials: true }),
        axios.get('/api/lists', { headers, withCredentials: true }),
        axios.get('/api/diary', { headers, withCredentials: true }),
        axios.get('/api/people/sakha', { headers, withCredentials: true }),
      ]);

      const [watchlistResult, reviewsResult, listsResult, diaryResult, friendsResult] = results;
      if (watchlistResult.status === 'fulfilled') {
        setWatchlist(watchlistResult.value.data?.movies || []);
      }
      if (reviewsResult.status === 'fulfilled') {
        setReviews(reviewsResult.value.data?.data || reviewsResult.value.data?.reviews || []);
      }
      if (listsResult.status === 'fulfilled') {
        setLists(listsResult.value.data?.data || []);
      }
      if (diaryResult.status === 'fulfilled') {
        setDiary(diaryResult.value.data?.data || []);
      }
      if (friendsResult.status === 'fulfilled') {
        setSakha(friendsResult.value.data?.data || []);
      }
      if (results.some(result => result.status === 'rejected')) {
        setActivityError('Some profile activity could not be loaded. Please refresh to try again.');
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data');
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('socials.')) {
      const socialKey = name.split('.')[1];
      setEditForm(prev => ({
        ...prev,
        socials: { ...prev.socials, [socialKey]: value }
      }));
    } else {
      setEditForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError('');
    }
    e.target.value = '';
  };

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    if (avatar.startsWith('/')) return apiUrl(avatar);
    return avatar;
  };

  const getDefaultAvatar = (name) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="#1a1a1a"/>
        <circle cx="60" cy="40" r="15" fill="#4a5568"/>
        <path d="M10 100C10 85 22 73 37 73H83C98 73 110 85 110 100V110H10V100Z" fill="#4a5568"/>
        <text x="60" y="65" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#e2e8f0" text-anchor="middle">${initials}</text>
      </svg>
    `)}`;
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      let avatarUrl = editForm.avatar;

      // If there's a new avatar file, upload it first
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);

        try {
          const uploadRes = await axios.post('/api/user/avatar', formData, {
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true,
            timeout: 10000
          });
          const uploadData = uploadRes.data?.data || uploadRes.data;
          avatarUrl = uploadData?.avatarUrl || uploadData?.user?.avatar || editForm.avatar;
        } catch (uploadErr) {
          console.error('Avatar upload failed:', uploadErr);
          let errorMessage = 'Avatar upload failed';
          if (uploadErr.response?.data?.error) {
            errorMessage += `: ${uploadErr.response.data.error}`;
          } else if (uploadErr.message) {
            errorMessage += `: ${uploadErr.message}`;
          }
          setError(errorMessage);
          return;
        }
      }

      // Update profile
      const updateData = {
        ...editForm,
        avatar: avatarUrl
      };

      const profileRes = await axios.put('/api/user/profile', updateData, { headers, withCredentials: true });

      const profileData = profileRes.data?.data || profileRes.data;
      const savedProfile = profileData?.user || profileData;
      setProfile(savedProfile);
      const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...cachedUser, ...savedProfile };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedUser }));
      setMessage('Profile updated successfully!');
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview('');

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update profile';
      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-200">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="vc-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', color: 'var(--vc-red)', marginBottom: '1rem' }}>Error</h2>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', marginBottom: '1rem' }}>{error}</p>
          <Link to="/" style={{ color: 'var(--vc-gold)', textDecoration: 'none' }}>Go back to home</Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="vc-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', color: 'var(--vc-red)', marginBottom: '1rem' }}>Profile Not Found</h2>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', marginBottom: '1rem' }}>Please login to view your profile</p>
          <Link to="/" style={{ color: 'var(--vc-gold)', textDecoration: 'none' }}>Go back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="vc-profile-page" style={{ minHeight: '100vh', background: 'var(--vc-bg-base)', color: 'var(--vc-cream)', width: '100%' }}>
      <Navbar />

      <section className="vc-profile-hero" style={{
        paddingTop: '6rem',
        paddingBottom: '3rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(135deg, #060912 0%, #0a0f1a 50%, #0d1420 100%)',
      }}>
        <div className="vc-container">
          <div className="vc-profile-heading">
            <img
              className="vc-profile-avatar"
              src={getAvatarUrl(profile.avatar) || getDefaultAvatar(profile.name || profile.username)}
              alt={`${profile.name || profile.username}'s profile`}
              onError={e => { e.currentTarget.src = getDefaultAvatar(profile.name || profile.username); }}
            />
            <div>
              <span className="vc-section-label">Your Profile</span>
              <h1 style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 800,
                marginBottom: '0.75rem',
              }}>
                {profile.name || profile.username}
              </h1>
              <p style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--vc-slate)', maxWidth: 560, marginBottom: '1.5rem' }}>
                {profile.bio || 'Cinematic journey and preferences'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="vc-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {/* Stats Row */}
        <div className="flex flex-wrap justify-center md:justify-start gap-8 mb-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{watchlist.length}</div>
            <div className="text-gray-400 text-sm uppercase tracking-wider">Watchlist</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{reviews.length}</div>
            <div className="text-gray-400 text-sm uppercase tracking-wider">Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{diary.length}</div>
            <div className="text-gray-400 text-sm uppercase tracking-wider">Diary logs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{lists.length}</div>
            <div className="text-gray-400 text-sm uppercase tracking-wider">Lists</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{sakha.length}</div>
            <div className="text-gray-400 text-sm uppercase tracking-wider">Friends</div>
          </div>
        </div>
        {activityError && <p role="status" className="mb-6 text-sm text-yellow-300">{activityError}</p>}

        {/* Social Links */}
        {(profile.socials?.instagram || profile.socials?.twitter || profile.socials?.website) && (
          <div className="flex justify-center md:justify-start gap-6 mb-8">
            {profile.socials?.instagram && (
              <a href={profile.socials.instagram} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-cyan-400 transition-colors group">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                <span className="group-hover:underline">Instagram</span>
              </a>
            )}
            {profile.socials?.twitter && (
              <a href={profile.socials.twitter} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-cyan-400 transition-colors group">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
                <span className="group-hover:underline">Twitter</span>
              </a>
            )}
            {profile.socials?.website && (
              <a href={profile.socials.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-cyan-400 transition-colors group">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0-9c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"} />
                </svg>
                <span className="group-hover:underline">Website</span>
              </a>
            )}
          </div>
        )}

        {/* Edit Button */}
        <button
          onClick={() => setEditing(!editing)}
          className="vc-btn vc-btn-primary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"} />
          </svg>
          {editing ? 'Cancel Edit' : 'Edit Profile'}
        </button>
      </div>

  {/* Messages */ }
{
  message && (
    <div className="max-w-4xl mx-auto px-6 mb-6">
      <div className="bg-green-600/20 border border-green-500/50 text-green-300 p-4 rounded-lg text-center backdrop-blur-sm">
        {message}
      </div>
    </div>
  )
}

{
  error && (
    <div className="max-w-4xl mx-auto px-6 mb-6">
      <div className="bg-red-600/20 border border-red-500/50 text-red-300 p-4 rounded-lg text-center backdrop-blur-sm">
        {error}
      </div>
    </div>
  )
}

{/* Edit Form */ }
{
  editing && (
    <div className="vc-container mb-8">
      <div className="vc-profile-form vc-card">
        <h3 className="vc-section-heading" style={{ marginBottom: '1.5rem' }}>Edit Profile</h3>
        <div className="space-y-4">
          <div className="vc-avatar-picker">
            <img
              src={avatarPreview || getAvatarUrl(editForm.avatar) || getDefaultAvatar(editForm.name)}
              alt="Profile preview"
              className="vc-profile-avatar"
              onError={e => { e.currentTarget.src = getDefaultAvatar(editForm.name); }}
            />
            <div>
              <label className="vc-profile-label" htmlFor="profile-avatar">Profile photo</label>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="vc-input vc-avatar-input"
              />
              <p className="vc-profile-hint">Choose an image up to 5 MB.</p>
            </div>
          </div>
          <div>
            <label className="vc-profile-label" htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              name="name"
              value={editForm.name}
              onChange={handleEditChange}
              className="vc-input"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="vc-profile-label" htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              type="text"
              name="username"
              value={editForm.username}
              onChange={handleEditChange}
              className="vc-input"
              placeholder="Username"
            />
          </div>

          <div>
            <label className="vc-profile-label" htmlFor="profile-bio">Bio</label>
            <textarea
              id="profile-bio"
              name="bio"
              value={editForm.bio}
              onChange={handleEditChange}
              rows={3}
              className="vc-input vc-textarea"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="vc-profile-label" htmlFor="profile-instagram">Instagram</label>
              <input
                id="profile-instagram"
                type="url"
                name="socials.instagram"
                value={editForm.socials.instagram}
                onChange={handleEditChange}
                className="vc-input"
                placeholder="Instagram URL"
              />
            </div>

            <div>
              <label className="vc-profile-label" htmlFor="profile-twitter">Twitter</label>
              <input
                id="profile-twitter"
                type="url"
                name="socials.twitter"
                value={editForm.socials.twitter}
                onChange={handleEditChange}
                className="vc-input"
                placeholder="Twitter URL"
              />
            </div>

            <div>
              <label className="vc-profile-label" htmlFor="profile-website">Website</label>
              <input
                id="profile-website"
                type="url"
                name="socials.website"
                value={editForm.socials.website}
                onChange={handleEditChange}
                className="vc-input"
                placeholder="Website URL"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={handleSaveProfile}
              className="vc-btn vc-btn-primary"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setAvatarFile(null);
                setAvatarPreview('');
                setEditForm({
                  name: profile.name || '',
                  username: profile.username || '',
                  bio: profile.bio || '',
                  avatar: profile.avatar || '',
                  socials: profile.socials || { instagram: '', twitter: '', website: '' }
                });
              }}
              className="vc-btn vc-btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

{/* Content Grid */ }
<div className="max-w-7xl mx-auto px-6 pb-16">
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    {/* Left Column - Friends */}
    <div className="lg:col-span-1">
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-slate-700/50">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"} />
            </svg>
          </div>
          Friends
        </h3>
        {sakha.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"} />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">No friends added yet.</p>
            <p className="text-gray-500 text-xs mt-1">Connect with other cinephiles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sakha.map((friend, index) => (
              <div key={friend.id || `friend-${index}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700/30 transition-all duration-200 group cursor-pointer">
                <img
                  src={getAvatarUrl(friend.avatar) || getDefaultAvatar(friend.name)}
                  alt={friend.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-600 group-hover:border-cyan-400/50 transition-colors"
                  onError={(e) => {
                    e.target.src = getDefaultAvatar(friend.name);
                  }}
                />
                <div className="flex-1">
                  <p className="text-white font-semibold group-hover:text-cyan-300 transition-colors">{friend.name}</p>
                  <p className="text-gray-400 text-sm">@{friend.username}</p>
                </div>
                <svg className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M9 5l7 7-7 7"} />
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Right Column - Content */}
    <div className="lg:col-span-2 space-y-8">
      {/* Watchlist */}
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-slate-700/50">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"} />
              </svg>
            </div>
            Watchlist
          </h3>
          <Link to="/watchlist" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors flex items-center gap-1 group">
            View All
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M9 5l7 7-7 7"} />
            </svg>
          </Link>
        </div>
        {watchlist.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"} />
              </svg>
            </div>
            <p className="text-gray-400 text-lg mb-2">Your watchlist is empty</p>
            <p className="text-gray-500 text-sm">Start adding movies you want to watch</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {watchlist.slice(0, 10).map(movie => (
              <Link
                key={movie.tmdbId || movie.id}
                to={`/${movie.mediaType === 'tv' ? 'tv' : 'movie'}/${movie.tmdbId || movie.id}`}
                className="group"
              >
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={(movie.posterUrl || movie.poster) ? tmdbImageUrl(movie.posterUrl || movie.poster, 'w185') : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgODAgMTIwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMzM0MTU1Ii8+Cjx0ZXh0IHg9IjQwIiB5PSI2MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2EzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo='}
                    alt={movie.title}
                    className="w-full aspect-[2/3] object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-white text-sm font-semibold line-clamp-2">{movie.title}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-white text-sm font-semibold truncate group-hover:text-cyan-300 transition-colors">{movie.title}</p>
                  {movie.releaseDate && (
                    <p className="text-gray-400 text-xs">({movie.releaseDate.slice(0, 4)})</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-slate-700/50">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            Recent Reviews
          </h3>
          <Link to="/reviews" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors flex items-center gap-1 group">
            View All
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M9 5l7 7-7 7"} />
            </svg>
          </Link>
        </div>
        {reviews.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg mb-2">No reviews yet</p>
            <p className="text-gray-500 text-sm">Share your thoughts on the movies you watch</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.slice(0, 3).map(review => (
              <div key={review._id} className="bg-slate-700/30 rounded-xl p-6 hover:bg-slate-700/50 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Link to={`/${review.mediaType === 'tv' ? 'tv' : 'movie'}/${review.source === 'original' ? review.originalId : review.tmdbId}`} className="text-white font-bold text-lg hover:text-cyan-300">
                        {review.title || 'Untitled'}
                      </Link>
                      {review.rating !== undefined && review.rating !== null && (
                        <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full">
                          <span className="text-sm">★</span>
                          <span className="text-sm font-bold">{review.rating}/10</span>
                        </div>
                      )}
                    </div>
                    {review.review ? (
                      <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{review.review}</p>
                    ) : (
                      <p className="text-gray-400 text-sm">Rating only</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movie Diary */}
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-slate-700/50">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Movie Diary</h3>
          <Link to="/diary" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">Log a movie · View all</Link>
        </div>
        {diary.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-lg mb-2">Your diary is empty</p>
            <p className="text-gray-500 text-sm">Log a movie by date, with an optional rating or note.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diary.slice(0, 5).map(entry => (
              <div key={entry._id} className="flex items-center gap-4 rounded-xl bg-slate-700/30 p-4">
                {entry.poster && <img src={tmdbImageUrl(entry.poster, 'w92')} alt="" className="h-16 w-11 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <Link to={`/${entry.mediaType === 'tv' ? 'tv' : 'movie'}/${entry.source === 'original' ? entry.originalId : entry.tmdbId}`} className="font-semibold text-white hover:text-cyan-300">
                    {entry.title}
                  </Link>
                  <p className="mt-1 text-xs text-gray-400">
                    Watched {new Date(entry.watchedAt).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                    {entry.rating != null && ` · ★ ${entry.rating}/10`}
                  </p>
                  {entry.note && <p className="mt-1 truncate text-sm text-gray-300">{entry.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Lists */}
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-slate-700/50">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">My Lists</h3>
          <Link to="/lists" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">View all lists</Link>
        </div>
        {lists.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-lg mb-2">No lists yet</p>
            <p className="text-gray-500 text-sm">Create a list to collect movies and shows.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lists.slice(0, 6).map(list => (
              <Link key={list._id} to="/lists" className="rounded-xl border border-slate-700/60 bg-slate-700/30 p-4 transition-colors hover:border-cyan-400/40">
                <div className="font-semibold text-white">{list.name}</div>
                {list.description && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{list.description}</p>}
                <div className="mt-2 text-xs text-gray-400">{list.items?.length || 0} titles · {list.isPublic ? 'Public' : 'Private'}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
</div>
    </div >
  );
};

export default Profile;
