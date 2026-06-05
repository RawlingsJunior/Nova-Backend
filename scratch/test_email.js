require('dotenv').config({ path: 'Backend/.env' });
const { sendEmail } = require('../src/services/emailService');

console.log('--- Email Provider Integration Test ---');
console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'Not Set (Auto-detecting)');
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'Configured' : 'Not Configured');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Configured' : 'Not Configured');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'Default (Nova Eye Care <info@novaeyecareservice.com>)');

const testEmail = async () => {
  const expectedProvider = process.env.EMAIL_PROVIDER || (process.env.SENDGRID_API_KEY ? 'sendgrid' : 'resend');
  console.log(`\nAttempting to send using expected provider: ${expectedProvider}`);

  try {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Email from Nova Eye Care Integration',
      html: '<p>This is a <strong>test</strong> email verifying our SendGrid/Resend dual-integration.</p>'
    });
    console.log('Result:', result === undefined ? 'Sent skipped (Keys not configured)' : result);
  } catch (err) {
    console.error('Error sending email:', err.message);
  }
};

testEmail();
