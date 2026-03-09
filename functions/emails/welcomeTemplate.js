const wrapInBrandedEmail = require("./layout");

/**
 * Branded welcome email sent after account creation.
 * @param {string} name - Recipient's name
 */
module.exports = function getWelcomeEmailHtml(name) {
  const displayName = name || "there";

  return wrapInBrandedEmail(`
    <h2 style="color:#1a1a2e; font-size:22px; font-weight:700; margin:0 0 8px; letter-spacing:-0.01em;">
      Welcome to iTag!
    </h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 24px; line-height:1.5;">
      Your account has been created successfully.
    </p>

    <p style="color:#374151; font-size:15px; line-height:1.7; margin:0 0 8px;">
      Hi <strong>${displayName}</strong>,
    </p>
    <p style="color:#374151; font-size:15px; line-height:1.7; margin:0 0 28px;">
      You're all set! You can now log in and start using the Timestamp Portal to create plans,
      run ZUPT sessions, and capture timestamps with real-time sync across all your devices.
    </p>

    <!-- CTA Button -->
    <div style="text-align:center; margin:0 0 28px;">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-radius:14px; background-color:#4f46e5;">
            <a href="https://itagts.com"
               style="display:inline-block; padding:14px 36px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:14px; background-color:#4f46e5; font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;">
              Open Timestamp Portal
            </a>
          </td>
        </tr>
      </table>
    </div>

    <p style="color:#9ca3af; font-size:12px; text-align:center; margin:0;">
      If you didn't create this account, please contact our support team.
    </p>
  `);
};
