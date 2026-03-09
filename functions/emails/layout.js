/**
 * Shared branded email HTML wrapper for iTag Timestamp Portal.
 * Table-based layout for maximum email client compatibility (including Outlook).
 * All styles are inline — no external CSS or <style> blocks.
 */
module.exports = function wrapInBrandedEmail(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>iTag Timestamp Portal</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; font-family:'Inter',-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f7;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px; width:100%; margin:0 auto; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#4f46e5; background-image:linear-gradient(135deg,#4f46e5,#6366f1); padding:28px 32px; text-align:center;">
              <img src="https://itagts.com/logo192.png" alt="iTag" width="44" height="44"
                   style="border-radius:10px; display:inline-block; vertical-align:middle;" />
              <p style="color:#ffffff; font-size:20px; font-weight:700; margin:10px 0 0; line-height:1.3; letter-spacing:-0.01em;">
                iTag Timestamp Portal
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 32px 28px; background-color:#ffffff;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af; font-size:12px; font-weight:500; margin:0 0 4px; letter-spacing:0.02em;">
                iTag Timestamp Portal
              </p>
              <p style="color:#b0b5bf; font-size:11px; margin:0;">
                This is an automated message. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
