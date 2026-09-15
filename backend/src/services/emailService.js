// ==========================================
// Email Service — Verification Code Delivery
// ==========================================
// Sends verification emails via SendGrid in production,
// falls back to console.log in development.
//
// Design decision: The HTML template is self-contained here
// (no external template engine). This keeps the service
// simple and avoids a file-read on every send.

/**
 * Build the branded HTML email for a verification code.
 *
 * @param {string} code — 6-digit verification code
 * @returns {string} — Full HTML document
 */
function buildVerificationHtml(code) {
  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n' +
    '<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">\n' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7">\n' +
    '<tr><td align="center" style="padding:40px 0">\n' +
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden">\n' +
    // Header
    '<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">\n' +
    '  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px">ManagerRate</h1>\n' +
    '  <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">Email Verification</p>\n' +
    '</td></tr>\n' +
    // Body
    '<tr><td style="padding:40px">\n' +
    '  <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6">Use the code below to verify your work email. This confirms you have access to the email address associated with your company.</p>\n' +
    '  <div style="margin:24px 0;padding:20px;background:#f8f7ff;border:2px dashed #8b5cf6;border-radius:8px;text-align:center">\n' +
    '    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#6366f1;font-family:\'Courier New\',monospace">' + code + '</span>\n' +
    '  </div>\n' +
    '  <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.5">\u23f0 This code expires in <strong>10 minutes</strong>.</p>\n' +
    '  <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5">\ud83d\udd12 If you did not request this code, you can safely ignore this email.</p>\n' +
    '</td></tr>\n' +
    // Footer
    '<tr><td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center">\n' +
    '  <p style="margin:0;color:#9ca3af;font-size:12px">ManagerRate — Anonymous manager reviews you can trust.</p>\n' +
    '  <p style="margin:4px 0 0;color:#9ca3af;font-size:12px">This is an automated message. Please do not reply.</p>\n' +
    '</td></tr>\n' +
    '</table>\n' +
    '</td></tr>\n' +
    '</table>\n' +
    '</body>\n' +
    '</html>';
}

/**
 * Send a verification code email.
 *
 * Uses SendGrid when SENDGRID_API_KEY is set.
 * Falls back to console.log in development or when the key is missing.
 *
 * @param {string} email — Recipient address
 * @param {string} code — 6-digit verification code
 * @returns {Promise<{ success: boolean, provider: string }>}
 */
async function sendVerificationCode(email, code) {
  var fromAddress = process.env.VERIFY_EMAIL_FROM || 'noreply@managerrate.com';
  var subject = 'Your ManagerRate verification code: ' + code;
  var html = buildVerificationHtml(code);

  // ── SendGrid path ──
  if (process.env.SENDGRID_API_KEY) {
    try {
      var sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      await sgMail.send({
        to: email,
        from: { email: fromAddress, name: 'ManagerRate' },
        subject: subject,
        html: html,
        // Prevent threading in Gmail
        headers: { 'X-Entity-Ref-ID': code },
        // Categories for SendGrid analytics
        categories: ['verification', 'managerrate'],
      });

      console.log('[EmailService] Verification code sent via SendGrid to', email);
      return { success: true, provider: 'sendgrid' };

    } catch (err) {
      console.error('[EmailService] SendGrid failed:', err.message);

      // In production, propagate the error — don't silently fall back
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to send verification email. Please try again.');
      }

      // In dev, fall through to console.log fallback
      console.warn('[EmailService] Falling back to console.log (dev mode)');
    }
  }

  // ── Development fallback ──
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  📧 VERIFICATION CODE (dev mode — not emailed)  ║');
  console.log('║                                                  ║');
  console.log('║  To:   ' + email.padEnd(41, ' ') + '║');
  console.log('║  Code: ' + code + '                                       ║');
  console.log('║                                                  ║');
  console.log('║  Set SENDGRID_API_KEY to send real emails.       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  return { success: true, provider: 'console' };
}

module.exports = {
  sendVerificationCode,
  buildVerificationHtml, // Exported for testing
};
