const { Resend } = require('resend');
/** @type {any} */
const axios = require('axios');
// Loaded updated environment settings for SendGrid email provider

const parseFromEmail = (fromStr) => {
  const match = fromStr.match(/^(.*?)\s*<(.*?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: fromStr.trim() };
};

const sendEmail = async ({ to, subject, html, text = undefined }) => {
  const provider = process.env.EMAIL_PROVIDER || (process.env.SENDGRID_API_KEY ? 'sendgrid' : 'resend');
  const fromInfo = process.env.EMAIL_FROM || 'Nova Eye Care <info@novaeyecareservice.com>';

  // Create text fallback from HTML if not provided
  const textPart = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  if (provider === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email not sent:', subject);
      return;
    }

    try {
      const fromObj = parseFromEmail(fromInfo);
      const payload = {
        personalizations: [
          {
            to: [{ email: to }]
          }
        ],
        from: fromObj,
        subject: subject,
        content: [
          {
            type: 'text/plain',
            value: textPart
          },
          {
            type: 'text/html',
            value: html
          }
        ]
      };

      const response = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    } catch (err) {
      const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      console.error('Error sending email via SendGrid:', errorMsg);
      throw new Error(`SendGrid API error: ${errorMsg}`);
    }
  } else {
    if (!process.env.RESEND_API_KEY) {
      console.warn('Resend API key not configured. Email not sent:', subject);
      return;
    }

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: fromInfo,
        to: [to],
        subject: subject,
        html: html,
        text: textPart
      });

      return result;
    } catch (err) {
      console.error('Error sending email via Resend:', err);
      throw err;
    }
  }
};

module.exports = { sendEmail };
