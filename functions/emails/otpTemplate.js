const wrapInBrandedEmail = require("./layout");

/**
 * Branded OTP verification email.
 * @param {string} code - 6-digit OTP code
 * @param {string} name - Recipient's name (or "there" as fallback)
 */
module.exports = function getOtpEmailHtml(code, name) {
  const displayName = name || "there";

  return wrapInBrandedEmail(`
    <h2 style="color:#1a1a2e; font-size:22px; font-weight:700; margin:0 0 8px; letter-spacing:-0.01em;">
      Verify your email
    </h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 24px; line-height:1.5;">
      Almost there! Use the code below to complete your sign-up.
    </p>

    <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 24px;">
      Hi <strong>${displayName}</strong>,<br/>
      Enter this verification code to confirm your email address:
    </p>

    <!-- OTP Code Block -->
    <div style="text-align:center; margin:0 0 28px;">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background-color:#f0f0ff; border:2px solid #e0e0ff; border-radius:14px; padding:18px 36px;">
            <span style="font-size:34px; font-weight:700; letter-spacing:0.35em; color:#4f46e5; font-family:'Courier New',Courier,monospace; display:inline-block;">
              ${code}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <p style="color:#6b7280; font-size:13px; text-align:center; margin:0 0 8px;">
      This code expires in <strong>10 minutes</strong>.
    </p>
    <p style="color:#9ca3af; font-size:12px; text-align:center; margin:0;">
      If you didn't request this code, you can safely ignore this email.
    </p>
  `);
};
