import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://api.github.com';

async function ghFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listRepos(integrationId: number, perPage = 20) {
  const data = await ghFetch(integrationId, `/user/repos?sort=updated&per_page=${perPage}`);
  return data.map((r: any) => ({
    id: r.id,
    fullName: r.full_name,
    name: r.name,
    owner: r.owner?.login,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    isPrivate: r.private,
    url: r.html_url,
    updatedAt: r.updated_at,
  }));
}

export async function getRepo(integrationId: number, owner: string, repo: string) {
  const r = await ghFetch(integrationId, `/repos/${owner}/${repo}`);
  return {
    id: r.id,
    fullName: r.full_name,
    name: r.name,
    owner: r.owner?.login,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    isPrivate: r.private,
    defaultBranch: r.default_branch,
    url: r.html_url,
    topics: r.topics,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listIssues(integrationId: number, owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
  const data = await ghFetch(integrationId, `/repos/${owner}/${repo}/issues?state=${state}&per_page=20`);
  return data.filter((i: any) => !i.pull_request).map((i: any) => ({
    id: i.id,
    number: i.number,
    title: i.title,
    body: i.body?.slice(0, 200),
    state: i.state,
    author: i.user?.login,
    labels: (i.labels || []).map((l: any) => l.name),
    assignees: (i.assignees || []).map((a: any) => a.login),
    url: i.html_url,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  }));
}

export async function createIssue(integrationId: number, owner: string, repo: string, title: string, body?: string) {
  const data = await ghFetch(integrationId, `/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  });
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    url: data.html_url,
    created: true,
  };
}

export async function listPRs(integrationId: number, owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
  const data = await ghFetch(integrationId, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`);
  return data.map((p: any) => ({
    id: p.id,
    number: p.number,
    title: p.title,
    body: p.body?.slice(0, 200),
    state: p.state,
    author: p.user?.login,
    head: p.head?.ref,
    base: p.base?.ref,
    url: p.html_url,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    merged: p.merged_at != null,
  }));
}

export async function getFileContent(integrationId: number, owner: string, repo: string, path: string) {
  const data = await ghFetch(integrationId, `/repos/${owner}/${repo}/contents/${path}`);
  if (data.type !== 'file') {
    // It's a directory listing
    return {
      type: 'directory',
      entries: (Array.isArray(data) ? data : []).map((e: any) => ({
        name: e.name,
        type: e.type,
        size: e.size,
        path: e.path,
      })),
    };
  }
  const content = data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : data.content;
  return {
    type: 'file',
    name: data.name,
    path: data.path,
    size: data.size,
    content,
    sha: data.sha,
    url: data.html_url,
  };
}
