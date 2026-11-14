import { Resend } from 'resend';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderEmail({ title, greeting, message, code, action }) {
  const content = code
    ? `<div style="margin:28px 0;padding:20px;border:1px solid #26384b;border-radius:12px;background:#0b1521;text-align:center"><div style="font-size:12px;letter-spacing:3px;color:#9eb0c3;text-transform:uppercase">Your one-time code</div><div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#55d5f5;padding:12px 0 4px">${escapeHtml(code)}</div><div style="font-size:13px;color:#9eb0c3">Expires in 5 minutes</div></div>`
    : '';

  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#07101a;font-family:Arial,Helvetica,sans-serif;color:#e8eef5"><div style="max-width:560px;margin:0 auto;border:1px solid #203044;border-radius:16px;overflow:hidden;background:#101b28"><div style="padding:24px 28px;border-bottom:1px solid #203044"><div style="font-size:12px;letter-spacing:3px;color:#55d5f5;font-weight:700">VISUAL CINEASTE</div><div style="font-size:12px;color:#8da0b4;margin-top:5px">A little more cinema, a little more you.</div></div><main style="padding:28px"><h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;color:#fff">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.7;color:#c2ceda;margin:0 0 12px">${escapeHtml(greeting)}</p><p style="font-size:15px;line-height:1.7;color:#c2ceda;margin:0">${escapeHtml(message)}</p>${content}<p style="font-size:13px;line-height:1.6;color:#91a1b2;margin:20px 0 0">${escapeHtml(action)}</p><p style="font-size:12px;color:#718396;margin:22px 0 0">If you didn't request this, you can safely ignore this email.</p></main><footer style="padding:16px 28px;border-top:1px solid #203044;color:#718396;font-size:12px">Visual Cineaste · Stories worth staying for.</footer></div></body></html>`;
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Email service is not configured: set RESEND_API_KEY and EMAIL_FROM.');
  }

  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html, text });
  if (error) throw new Error(`Email delivery failed: ${error.message}`);
}

async function sendOtp(email, code, { title, subject, message }) {
  await sendEmail({
    to: email,
    subject,
    text: `${title}\n${message}\nYour code is ${code}. It expires in 5 minutes.`,
    html: renderEmail({
      title,
      greeting: 'Hello, cineaste.',
      message,
      code,
      action: 'This code can only be used once and expires in 5 minutes.',
    }),
  });
}

export function sendVerificationCode(email, code) {
  return sendOtp(email, code, {
    title: 'Verify your email',
    subject: 'Your Visual Cineaste verification code',
    message: 'Use this code to verify your email and finish creating your account.',
  });
}

export function sendLoginCode(email, code) {
  return sendOtp(email, code, {
    title: 'Your sign-in code',
    subject: 'Your Visual Cineaste sign-in code',
    message: 'Use this code to securely sign in to your account.',
  });
}

export function sendPasswordResetCode(email, code) {
  return sendOtp(email, code, {
    title: 'Reset your password',
    subject: 'Your Visual Cineaste password reset code',
    message: 'Use this code to choose a new password for your account.',
  });
}

export function sendWelcomeEmail(email, name) {
  const safeName = name || 'cineaste';
  const message = `Welcome to Visual Cineaste, ${safeName}. Your account is ready.`;
  return sendEmail({
    to: email,
    subject: 'Welcome to Visual Cineaste',
    text: `${message}\nWe're glad you're here.`,
    html: renderEmail({
      title: 'Welcome to the screening room',
      greeting: `Hello, ${safeName}.`,
      message: 'Your Visual Cineaste account is ready. Discover films, build your watchlist, and share what moves you.',
      action: "We're glad you're here.",
    }),
  });
}
