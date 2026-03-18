/**
 * Email Templates — clean, professional, and simple HTML templates.
 *
 * Designed for maximum readability and a premium "minimalist" feel.
 */

const getOtpEmailTemplate = ({ otp, purpose, expiryMinutes }) => {
  const isPasswordReset = purpose === 'password-reset';
  const title = isPasswordReset ? 'Password Reset Verification' : 'Registration Verification';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color: #1a1a1a;
          margin: 0;
          padding: 0;
          background-color: #ffffff;
        }
        .container {
          max-width: 500px;
          margin: 40px auto;
          padding: 20px;
        }
        .header {
          padding-bottom: 30px;
          border-bottom: 1px solid #eeeeee;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
          letter-spacing: -0.02em;
        }
        .content h1 {
          font-size: 24px;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 16px;
          color: #111111;
        }
        .content p {
          font-size: 16px;
          color: #444444;
          margin-bottom: 24px;
        }
        .otp-box {
          background-color: #f6f9fc;
          border: 1px dashed #2563eb;
          border-radius: 8px;
          padding: 25px;
          text-align: center;
          margin: 30px 0;
        }
        .otp-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 42px;
          font-weight: 700;
          color: #2563eb;
          letter-spacing: 6px;
          margin: 0;
          -webkit-user-select: all;
          user-select: all;
          cursor: pointer;
        }
        .expiry {
          font-size: 13px;
          color: #666666;
          margin-top: 10px;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #eeeeee;
          font-size: 12px;
          color: #888888;
        }
        .security-note {
          font-size: 13px;
          color: #666666;
          background-color: #fffaf0;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">INHOUSE INTERNSHIPS 2.0</div>
        </div>
        <div class="content">
          <h1>${title}</h1>
          <p>Please use the following verification code to complete your ${isPasswordReset ? 'password reset' : 'registration'} process.</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="expiry">Expires in ${expiryMinutes} minutes</div>
          </div>
          
          <div class="security-note">
            <strong>Note:</strong> For your security, do not share this code with anyone.
          </div>
          
          <p>If you did not request this code, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Inhouse Internships 2.0 • Aditya University</p>
          <p>This is an automated message. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  getOtpEmailTemplate
};
