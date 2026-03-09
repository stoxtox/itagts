const wrapInBrandedEmail = require("./layout");

/**
 * Branded password reset email with reset link.
 * @param {string} resetLink - The password reset URL
 * @param {string} name - Recipient's name
 */
module.exports = function getResetEmailHtml(resetLink, name) {
  const displayName = name || "there";

  return wrapInBrandedEmail(`
    <h2 style="color:#1a1a2e; font-size:22px; font-weight:700; margin:0 0 8px; letter-spacing:-0.01em;">
      Reset your password
    </h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 24px; line-height:1.5;">
      We received a request to reset your password.
    </p>

    <p style="color:#374151; font-size:15px; line-height:1.7; margin:0 0 28px;">
      Hi <strong>${displayName}</strong>,<br/>
      Click the button below to set a new password for your account:
    </p>

    <!-- CTA Button -->
    <div style="text-align:center; margin:0 0 28px;">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-radius:14px; background-color:#4f46e5;">
            <a href="${resetLink}"
               style="display:inline-block; padding:14px 36px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:14px; background-color:#4f46e5; font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;">
              Reset Password
            </a>
          </td>
        </tr>
      </table>
    </div>

    <p style="color:#6b7280; font-size:13px; text-align:center; margin:0 0 8px;">
      This link expires in <strong>1 hour</strong>.
    </p>
    <p style="color:#9ca3af; font-size:12px; text-align:center; margin:0 0 16px;">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will remain unchanged.
    </p>

    <!-- Fallback link for broken buttons -->
    <p style="color:#9ca3af; font-size:11px; text-align:center; word-break:break-all; margin:0;">
      If the button doesn't work, copy and paste this link:<br/>
      <a href="${resetLink}" style="color:#4f46e5; text-decoration:underline;">${resetLink}</a>
    </p>
  `);
};
