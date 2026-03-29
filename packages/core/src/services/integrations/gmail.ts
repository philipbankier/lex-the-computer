import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error(`Gmail API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function searchEmails(integrationId: number, query: string, maxResults = 10) {
  const data = await gmailFetch(integrationId, `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  const messages = data.messages || [];
  // Fetch metadata for each message
  const results = await Promise.all(
    messages.slice(0, maxResults).map(async (m: any) => {
      const msg = await gmailFetch(integrationId, `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
      const headers = msg.payload?.headers || [];
      const get = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
      return { id: m.id, threadId: m.threadId, subject: get('Subject'), from: get('From'), to: get('To'), date: get('Date'), snippet: msg.snippet };
    })
  );
  return results;
}

export async function getEmail(integrationId: number, emailId: string) {
  const msg = await gmailFetch(integrationId, `/messages/${emailId}?format=full`);
  const headers = msg.payload?.headers || [];
  const get = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract body text
  let body = '';
  function extractText(part: any): string {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) return part.parts.map(extractText).join('\n');
    return '';
  }
  body = extractText(msg.payload);

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: get('Subject'),
    from: get('From'),
    to: get('To'),
    cc: get('Cc'),
    date: get('Date'),
    body,
    snippet: msg.snippet,
    labelIds: msg.labelIds,
  };
}

export async function sendEmail(integrationId: number, to: string, subject: string, body: string, cc?: string, bcc?: string) {
  const lines = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].filter(Boolean);

  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

  const result = await gmailFetch(integrationId, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
  return { id: result.id, threadId: result.threadId, sent: true };
}

export async function getLabels(integrationId: number) {
  const data = await gmailFetch(integrationId, '/labels');
  return (data.labels || []).map((l: any) => ({ id: l.id, name: l.name, type: l.type }));
}
