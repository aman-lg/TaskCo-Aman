// SERVER ONLY — never import from "use client" files.
// No `resend` npm package installed — their REST API is a single POST, so a
// small fetch wrapper avoids adding a dependency for one call site.

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: string /* base64 */ }[];
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Resend API error (${res.status}): ${text}` };
  }
  return { ok: true };
}
