import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import BrandLogo from './BrandLogo';
import { apiUrl } from '../api/config';

const fieldClass = 'w-full px-4 py-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400';
const buttonClass = 'w-full py-3 rounded font-semibold transition bg-cyan-500 text-white hover:bg-cyan-600 disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed';

function OtpInputs({ value, onChange, disabled = false, label = 'Six-digit code' }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || '');

  const setDigit = (index, input) => {
    const digit = input.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(''));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handlePaste = event => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={element => { refs.current[index] = element; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`${label}, digit ${index + 1}`}
          value={digit}
          disabled={disabled}
          onChange={event => setDigit(index, event.target.value)}
          onPaste={handlePaste}
          onKeyDown={event => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            } else if (event.key === 'ArrowLeft' && index > 0) {
              refs.current[index - 1]?.focus();
            } else if (event.key === 'ArrowRight' && index < 5) {
              refs.current[index + 1]?.focus();
            }
          }}
          className="w-10 h-12 sm:w-12 sm:h-14 rounded bg-gray-800 text-white text-center text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-60"
        />
      ))}
    </div>
  );
}

const AuthModal = ({ type = 'login', onClose, onSwitch, initialError = '' }) => {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [otpFlow, setOtpFlow] = useState(null);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpName, setOtpName] = useState('');
  const [nameRequired, setNameRequired] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendingCode, setResendingCode] = useState(false);
  const isSignup = type === 'signup';

  useEffect(() => {
    if ((!otpFlow && !(showForgotPassword && resetStep === 2)) || resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds(seconds => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpFlow, resendSeconds, showForgotPassword, resetStep]);

  const finishAuthentication = (responseData, message) => {
    localStorage.removeItem('token');
    if (responseData.user) localStorage.setItem('user', JSON.stringify(responseData.user));
    setSuccess(message);
    window.setTimeout(() => {
      onClose();
      window.location.reload();
    }, 500);
  };

  const handleChange = event => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setError('');
    setEmailAlreadyRegistered(false);
  };

  const beginOtp = (email, purpose, message) => {
    setOtpEmail(email);
    setOtpCode('');
    setOtpName(isSignup ? form.name : '');
    setNameRequired(false);
    setOtpFlow(purpose);
    setResendSeconds(60);
    setError('');
    setSuccess(message);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (isSignup) {
        if (form.password !== form.confirm) {
          setError('Passwords do not match.');
          return;
        }
        const response = await axios.post('/api/auth/signup', {
          name: form.name,
          username: form.username,
          email: form.email,
          password: form.password,
        });
        beginOtp(response.data.email || form.email, response.data.otpPurpose || 'verification',
          response.data.message || 'Check your email for a verification code.');
      } else {
        const response = await axios.post('/api/auth/login', {
          email: form.email,
          password: form.password,
        });
        finishAuthentication(response.data, 'Sign-in successful.');
      }
    } catch (requestError) {
      if (requestError.response?.data?.code === 'EMAIL_ALREADY_REGISTERED') {
        setEmailAlreadyRegistered(true);
      }
      if (requestError.response?.data?.verificationRequired) {
        beginOtp(requestError.response.data.email || form.email, 'verification', '');
      }
      setError(requestError.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOtp = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post('/api/auth/send-otp', { email: form.email });
      beginOtp(form.email, 'login', 'If this address can receive sign-in codes, one is on its way.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send a sign-in code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await axios.post('/api/auth/verify-otp', {
        email: otpEmail,
        code: otpCode,
        purpose: otpFlow,
        ...(otpName ? { name: otpName } : {}),
        ...(form.username ? { username: form.username } : {}),
      });
      finishAuthentication(response.data, response.data.message || 'You are now signed in.');
    } catch (requestError) {
      if (requestError.response?.data?.code === 'NAME_REQUIRED') {
        setNameRequired(true);
        setError(requestError.response.data.message);
      } else {
        setError(requestError.response?.data?.message || 'Could not verify the code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendingCode(true);
    setError('');
    setSuccess('');
    try {
      const response = otpFlow === 'verification'
        ? await axios.post('/api/auth/resend-verification', { email: otpEmail })
        : await axios.post('/api/auth/send-otp', { email: otpEmail });
      setOtpCode('');
      setResendSeconds(60);
      setSuccess(response.data.message || 'A new code has been sent.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send a new code.');
    } finally {
      setResendingCode(false);
    }
  };

  const changeOtpEmail = () => {
    setForm(current => ({ ...current, email: otpEmail }));
    setOtpFlow(null);
    setOtpCode('');
    setNameRequired(false);
    setError('');
    setSuccess('');
  };

  const handleGoogleSignIn = () => {
    window.location.assign(apiUrl('/api/auth/google'));
  };

  const handleForgotPassword = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (resetStep === 1) {
        const response = await axios.post('/api/auth/forgot-password', { email: resetEmail });
        setResetStep(2);
        setSuccess(response.data.message || 'If an account exists, a reset code has been sent.');
        setResendSeconds(60);
      } else {
        const response = await axios.post('/api/auth/reset-password', {
          email: resetEmail,
          code: resetCode,
          newPassword,
        });
        setSuccess(response.data.message || 'Password reset. You can now sign in.');
        setResetStep(1);
        setResetEmail('');
        setResetCode('');
        setNewPassword('');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not process the request. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setResetStep(1);
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setError('');
    setSuccess('');
  };

  const closeOtp = () => {
    setOtpFlow(null);
    setError('');
    setSuccess('');
  };

  const renderMessages = () => (
    <>
      {error && <div role="alert" className="mb-4 p-3 bg-red-700 text-white rounded text-sm">{error}</div>}
      {success && <div role="status" className="mb-4 p-3 bg-green-700 text-white rounded text-sm">{success}</div>}
    </>
  );

  if (otpFlow) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto relative">
          <button onClick={closeOtp} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl" aria-label="Back">×</button>
          <h2 className="text-2xl font-bold mb-3 text-center text-cyan-400">
            {otpFlow === 'verification'
              ? 'Verify your email'
              : isSignup ? 'Continue with email' : 'Sign in with email'}
          </h2>
          <p className="text-sm text-gray-300 mb-5 text-center">
            {isSignup && otpFlow === 'login'
              ? 'Confirm your email to continue. If an account already exists, you will be signed in.'
              : 'Enter the six-digit code sent to'}{' '}
            <strong className="break-all">{otpEmail}</strong>. It expires in 5 minutes.
          </p>
          {renderMessages()}
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            {nameRequired && (
              <input
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={otpName}
                onChange={event => setOtpName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
                className={fieldClass}
              />
            )}
            <OtpInputs value={otpCode} onChange={setOtpCode} disabled={loading} />
            <button type="submit" disabled={loading || otpCode.length !== 6 || (nameRequired && otpName.trim().length < 2)} className={buttonClass}>
              {loading ? 'Verifying…' : 'Verify code'}
            </button>
          </form>
          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <button type="button" onClick={changeOtpEmail} className="text-gray-300 hover:text-white">Change email</button>
            <button type="button" onClick={handleResendOtp} disabled={resendingCode || resendSeconds > 0} className="text-cyan-400 hover:underline disabled:text-gray-500 disabled:no-underline">
              {resendingCode ? 'Sending…' : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto relative">
          <button onClick={resetForgotPassword} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl" aria-label="Close">×</button>
          <h2 className="text-2xl font-bold mb-4 text-center text-cyan-400">Reset password</h2>
          {renderMessages()}
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {resetStep === 1 ? (
              <input
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={event => setResetEmail(event.target.value)}
                required
                className={fieldClass}
              />
            ) : (
              <>
                <p className="text-gray-300 text-sm text-center">Enter the reset code sent to {resetEmail}. It expires in 5 minutes.</p>
                <OtpInputs value={resetCode} onChange={setResetCode} disabled={loading} label="Password reset code" />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password (at least 8 characters)"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  minLength={8}
                  required
                  className={fieldClass}
                />
                <button type="button" onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    await axios.post('/api/auth/forgot-password', { email: resetEmail });
                    setResendSeconds(60);
                    setSuccess('If an account exists, a new reset code has been sent.');
                  } catch (requestError) {
                    setError(requestError.response?.data?.message || 'Could not send a reset code.');
                  } finally {
                    setLoading(false);
                  }
                }} disabled={loading || resendSeconds > 0} className="text-cyan-400 text-sm hover:underline disabled:text-gray-500 disabled:no-underline">
                  {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend reset code'}
                </button>
              </>
            )}
            <button type="submit" disabled={loading || (resetStep === 2 && (resetCode.length !== 6 || newPassword.length < 8))} className={buttonClass}>
              {loading ? 'Please wait…' : resetStep === 1 ? 'Send reset code' : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl" aria-label="Close">×</button>
        <div className="flex justify-center mb-5">
          <BrandLogo style={{ width: 180 }} />
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center text-cyan-400">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h2>
        {renderMessages()}
        {emailAlreadyRegistered && (
          <button
            type="button"
            onClick={() => {
              setEmailAlreadyRegistered(false);
              setError('');
              onSwitch('login');
            }}
            className="mb-4 text-cyan-400 hover:underline text-sm"
          >
            Go to sign in
          </button>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={80}
              className={fieldClass}
            />
          )}
          {isSignup && (
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9._-]{3,30}"
              title="Use 3 to 30 letters, numbers, dots, or hyphens."
              className={fieldClass}
            />
          )}
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            className={fieldClass}
          />
          <input
            type="password"
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder="Password (at least 8 characters)"
            value={form.password}
            onChange={handleChange}
            required
            minLength={isSignup ? 8 : undefined}
            className={fieldClass}
          />
          {isSignup && (
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={form.confirm}
              onChange={handleChange}
              required
              className={fieldClass}
            />
          )}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-gray-500 text-xs">
          <span className="h-px flex-1 bg-gray-700" />
          <span>OR</span>
          <span className="h-px flex-1 bg-gray-700" />
        </div>

        <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 rounded border border-gray-600 text-white font-semibold hover:bg-gray-800 disabled:opacity-60 flex items-center justify-center gap-3">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 5.99c4.51-4.17 7.11-10.31 7.11-17.7Z" />
            <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)" />
            <path fill="#34A853" d="M24 48c6.47 0 11.9-2.13 15.87-5.8l-7.73-5.99c-2.14 1.44-4.88 2.29-8.14 2.29-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -5)" />
          </svg>
          Continue with Google
        </button>
        <button type="button" onClick={handleEmailOtp} disabled={loading || !form.email} className="w-full py-3 mt-3 rounded border border-cyan-500 text-cyan-300 font-semibold hover:bg-gray-800 disabled:opacity-60">
          {isSignup ? 'Continue with Email OTP' : 'Sign in with Email OTP'}
        </button>

        <div className="mt-4 text-center space-y-2">
          {!isSignup && (
            <button type="button" onClick={() => {
              setShowForgotPassword(true);
              setResetEmail(form.email);
              setError('');
              setSuccess('');
            }} className="text-cyan-400 hover:underline text-sm block mx-auto">
              Forgot password?
            </button>
          )}
          <button type="button" onClick={() => onSwitch(isSignup ? 'login' : 'signup')} className="text-cyan-400 hover:underline text-sm block mx-auto">
            {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
