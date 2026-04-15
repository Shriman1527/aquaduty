const nodemailer = require('nodemailer');

// ─── Create transporter ───────────────────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   parseInt(process.env.EMAIL_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ─── Base HTML template ───────────────────────────────────────────────────────
const baseTemplate = (content) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8"/>
    <style>
      body { font-family: sans-serif; background: #f0f9ff; margin: 0; padding: 24px; }
      .card { background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 36px; }
      .logo { font-size: 20px; font-weight: 700; color: #0077cc; margin-bottom: 24px; }
      h2 { color: #1e293b; margin-top: 0; }
      p  { color: #475569; line-height: 1.6; }
      .btn { display: inline-block; background: #0077cc; color: #fff; text-decoration: none;
             padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
      .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0;
                color: #94a3b8; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">💧 AquaDuty</div>
      ${content}
      <div class="footer">If you did not request this, you can safely ignore this email.</div>
    </div>
  </body>
  </html>
`;

// ─── Send raw email ───────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

// ─── Verification email ───────────────────────────────────────────────────────
const sendVerificationEmail = async ({ email, name, token }) => {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await sendEmail({
    to:      email,
    subject: 'Verify your AquaDuty email',
    html:    baseTemplate(`
      <h2>Welcome, ${name}! 🎉</h2>
      <p>Click the button below to verify your email and get started.</p>
      <a href="${url}" class="btn">Verify Email</a>
      <p style="font-size:13px;color:#94a3b8">Link expires in 24 hours.</p>
    `),
  });
};

// ─── Password reset email ─────────────────────────────────────────────────────
const sendPasswordResetEmail = async ({ email, name, token }) => {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await sendEmail({
    to:      email,
    subject: 'Reset your AquaDuty password',
    html:    baseTemplate(`
      <h2>Password reset request 🔐</h2>
      <p>Hi ${name}, click below to set a new password.</p>
      <a href="${url}" class="btn">Reset Password</a>
      <p style="font-size:13px;color:#94a3b8">This link expires in 10 minutes.</p>
    `),
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};