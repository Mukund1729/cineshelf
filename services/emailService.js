import { Resend } from 'resend';

export async function sendVerificationCode(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('Resend email settings are incomplete');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: 'Verify your Visual Cineaste account',
    text: `Your Visual Cineaste verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Visual Cineaste verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
  if (error) throw new Error(`Resend failed to send verification email: ${error.message}`);
}
