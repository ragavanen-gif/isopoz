import "server-only";

/** Gabarit HTML sobre et responsive pour les emails ISOPoz. */
export function brandedEmail(opts: {
  companyName: string;
  title: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f7f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 8px 16px;">
          <span style="font-size:22px;font-weight:700;color:#1d4ed8;">${escapeHtml(opts.companyName)}</span>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
          <h1 style="margin:0 0 16px;font-size:18px;">${escapeHtml(opts.title)}</h1>
          <div style="font-size:14px;line-height:1.6;color:#334155;">${opts.bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:16px 8px;color:#94a3b8;font-size:12px;">
          Email envoyé automatiquement par ISOPoz. Merci de ne pas répondre directement si un contact est indiqué ci-dessus.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
