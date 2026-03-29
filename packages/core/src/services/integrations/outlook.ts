// Phase 10: Microsoft Outlook integration (Microsoft OAuth2, reuses OneDrive auth)

import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://graph.microsoft.com/v1.0';

async function graphFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`Microsoft Graph API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function searchEmails(integrationId: number, query: string): Promise<any[]> {
  const data = await graphFetch(integrationId, `/me/messages?$search="${encodeURIComponent(query)}"&$top=10&$select=id,subject,from,receivedDateTime,bodyPreview,isRead`);
  return (data.value || []).map((m: any) => ({
    id: m.id,
    subject: m.subject,
    from: m.from?.emailAddress?.address,
    from_name: m.from?.emailAddress?.name,
    received: m.receivedDateTime,
    preview: m.bodyPreview?.slice(0, 200),
    is_read: m.isRead,
  }));
}

export async function getEmail(integrationId: number, emailId: string): Promise<any> {
  const data = await graphFetch(integrationId, `/me/messages/${emailId}?$select=id,subject,from,toRecipients,receivedDateTime,body,isRead,hasAttachments`);
  return {
    id: data.id,
    subject: data.subject,
    from: data.from?.emailAddress?.address,
    from_name: data.from?.emailAddress?.name,
    to: data.toRecipients?.map((r: any) => r.emailAddress?.address),
    received: data.receivedDateTime,
    body: data.body?.content?.slice(0, 10000),
    body_type: data.body?.contentType,
    is_read: data.isRead,
    has_attachments: data.hasAttachments,
  };
}

export async function sendEmail(integrationId: number, to: string, subject: string, body: string): Promise<any> {
  await graphFetch(integrationId, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
  return { sent: true, to, subject };
}

export async function listFolders(integrationId: number): Promise<any[]> {
  const data = await graphFetch(integrationId, '/me/mailFolders?$top=20');
  return (data.value || []).map((f: any) => ({
    id: f.id,
    name: f.displayName,
    total_count: f.totalItemCount,
    unread_count: f.unreadItemCount,
  }));
}
