import nodemailer from 'nodemailer';

export async function sendVerificationCode(email, code) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  if (!host || !user || !pass || !Number.isInteger(port)) {
    throw new Error('SMTP email settings are incomplete');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const from = process.env.SMTP_FROM || user;

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Verify your Visual Cineaste account',
    text: `Your Visual Cineaste verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Visual Cineaste verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
}
