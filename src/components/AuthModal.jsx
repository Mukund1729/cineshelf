import React, { useState } from 'react';
import axios from 'axios';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import BrandLogo from './BrandLogo';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const AuthModal = ({ type = 'login', onClose, onSwitch }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', username: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: email, 2: token, 3: new password
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendingCode, setResendingCode] = useState(false);
  const isSignup = type === 'signup';

  const finishAuthentication = (responseData, message) => {
    localStorage.setItem('token', responseData.token);
    localStorage.setItem('user', JSON.stringify(responseData.user));
    setSuccess(message);
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 1000);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (isSignup) {
        if (form.password !== form.confirm) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const response = await axios.post('/api/auth/signup', {
          name: form.name,
          username: form.username,
          email: form.email,
          password: form.password
        });
        setVerificationEmail(response.data.email || form.email);
        setVerificationStep(true);
        setSuccess(response.data.message || 'Check your email for a verification code.');
      } else {
        const response = await axios.post('/api/auth/login', {
          email: form.email,
          password: form.password
        });
        finishAuthentication(response.data, 'Login successful! Welcome back to visual.cineaste');
      }
    } catch (err) {
      if (err.response?.data?.verificationRequired) {
        setVerificationEmail(err.response.data.email || form.email);
        setVerificationStep(true);
      }
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/auth/verify-email', {
        email: verificationEmail,
        code: verificationCode,
      });
      finishAuthentication(response.data, 'Email verified. You are now signed in.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingCode(true);
    setError('');
    setSuccess('');
    try {
      const response = await axios.post('/api/auth/resend-verification', { email: verificationEmail });
      setSuccess(response.data?.message || 'A new verification code has been sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send a new verification code.');
    } finally {
      setResendingCode(false);
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    if (!credential) {
      setError('Google did not return a sign-in credential.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/auth/google', { credential });
      finishAuthentication(response.data, 'Google sign-in successful.');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (resetStep === 1) {
        await axios.post('/api/auth/forgot-password', { email: resetEmail });
        setSuccess('Password reset link sent to your email!');
        setResetStep(2);
      } else if (resetStep === 2) {
        setResetStep(3);
      } else if (resetStep === 3) {
        await axios.post('/api/auth/reset-password', { token: resetToken, newPassword });
        setSuccess('Password reset successful! You can now login.');
        setTimeout(() => {
          setShowForgotPassword(false);
          setResetStep(1);
          setResetEmail('');
          setResetToken('');
          setNewPassword('');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setResetStep(1);
    setResetEmail('');
    setResetToken('');
    setNewPassword('');
    setError('');
    setSuccess('');
  };

  if (verificationStep) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-sm relative">
          <button onClick={() => { setVerificationStep(false); setError(''); setSuccess(''); }} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl" aria-label="Back">×</button>
          <h2 className="text-2xl font-bold mb-3 text-center text-cyan-400">Verify your email</h2>
          <p className="text-sm text-gray-300 mb-4 text-center">
            Enter the six-digit code sent to <strong>{verificationEmail}</strong>. It expires in 10 minutes.
          </p>
          {error && <div className="mb-4 p-3 bg-red-600 text-white rounded text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-700 text-white rounded text-sm">{success}</div>}
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              aria-label="Six-digit email verification code"
              placeholder="000000"
              value={verificationCode}
              onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="w-full px-4 py-3 rounded bg-gray-800 text-white text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <button type="submit" disabled={loading || verificationCode.length !== 6} className="w-full py-2 rounded font-semibold bg-cyan-500 text-white disabled:bg-gray-600">
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </form>
          <button type="button" onClick={handleResendVerification} disabled={resendingCode} className="text-cyan-400 hover:underline text-sm mt-4 disabled:text-gray-500">
            {resendingCode ? 'Sending…' : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto relative">
          <button onClick={resetForgotPassword} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl" aria-label="Close">×</button>
          <h2 className="text-2xl font-bold mb-4 text-center text-cyan-400">Reset Password</h2>
          {error && <div className="mb-4 p-3 bg-red-600 text-white rounded text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-600 text-white rounded text-sm">{success}</div>}
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {resetStep === 1 && (
              <input type="email" placeholder="Enter your email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            )}
            {resetStep === 2 && (
              <div className="space-y-4">
                <p className="text-gray-300 text-sm">Check your email for the reset token and enter it below:</p>
                <input type="text" placeholder="Enter reset token" value={resetToken} onChange={e => setResetToken(e.target.value)} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
            )}
            {resetStep === 3 && (
              <div className="space-y-4">
                <input type="password" placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
            )}
            <button type="submit" disabled={loading} className={`w-full py-2 rounded font-semibold transition ${loading ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-cyan-500 text-white hover:bg-cyan-600'}`}>{loading ? (<span className="flex items-center justify-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{resetStep === 1 ? 'Sending...' : resetStep === 2 ? 'Verifying...' : 'Resetting...'}</span>) : (resetStep === 1 ? 'Send Reset Link' : resetStep === 2 ? 'Verify Token' : 'Reset Password')}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl" aria-label="Close">×</button>
        <div className="flex justify-center mb-5">
          <BrandLogo style={{ width: 180 }} />
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center text-cyan-400">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
        {error && <div className="mb-4 p-3 bg-red-600 text-white rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-600 text-white rounded text-sm">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <>
              <input type="text" name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              <input type="text" name="username" placeholder="Username" value={form.username} onChange={handleChange} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </>
          )}
          <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          {isSignup && (
            <input type="password" name="confirm" placeholder="Confirm Password" value={form.confirm} onChange={handleChange} required className="w-full px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          )}
          <button type="submit" disabled={loading} className={`w-full py-2 rounded font-semibold transition ${loading ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-cyan-500 text-white hover:bg-cyan-600'}`}>{loading ? (<span className="flex items-center justify-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{isSignup ? 'Creating Account...' : 'Logging In...'}</span>) : (isSignup ? 'Sign Up' : 'Login')}</button>
        </form>
        <div className="my-4 flex items-center gap-3 text-gray-500 text-xs">
          <span className="h-px flex-1 bg-gray-700" />
          <span>OR</span>
          <span className="h-px flex-1 bg-gray-700" />
        </div>
        {GOOGLE_CLIENT_ID ? (
          <div className="flex justify-center">
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed. Please try again.')} />
            </GoogleOAuthProvider>
          </div>
        ) : (
          <p className="text-center text-gray-500 text-xs">Google sign-in is not configured yet.</p>
        )}
        <div className="mt-4 text-center space-y-2">
          {!isSignup && (
            <button onClick={() => setShowForgotPassword(true)} className="text-cyan-400 hover:underline text-sm block">Forgot Password?</button>
          )}
          <button onClick={() => onSwitch(isSignup ? 'login' : 'signup')} className="text-cyan-400 hover:underline text-sm block">{isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up"}</button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;