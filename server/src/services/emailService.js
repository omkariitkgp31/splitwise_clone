const nodemailer = require('nodemailer');

const getTransporter = () => {
  if (!process.env.SMTP_HOST) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const sendInviteEmail = async (to, inviterName, groupName, token) => {
  const inviteLink = `${getFrontendUrl()}/invite/${token}`;
  const from = process.env.SMTP_FROM || 'Splitwise Clone <no-reply@example.com>';

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('SMTP_HOST is not configured');
  }

  return transporter.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join ${groupName}`,
    text: [
      `${inviterName} invited you to join "${groupName}" on Splitwise Clone.`,
      '',
      `Accept the invite here: ${inviteLink}`,
      '',
      'This invite expires in 24 hours.',
    ].join('\n'),
    html: `
      <p>${inviterName} invited you to join <strong>${groupName}</strong> on Splitwise Clone.</p>
      <p><a href="${inviteLink}">Accept invite</a></p>
      <p>This invite expires in 24 hours.</p>
    `,
  });
};

module.exports = {
  sendInviteEmail,
};
