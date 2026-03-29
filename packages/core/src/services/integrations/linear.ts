import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://api.linear.app/graphql';

async function linearGql(integrationId: number, query: string, variables?: any) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
  return json.data;
}

export async function searchIssues(integrationId: number, query: string) {
  const data = await linearGql(integrationId, `
    query($query: String!) {
      issueSearch(query: $query, first: 15) {
        nodes {
          id identifier title description priority state { name } assignee { name email } createdAt updatedAt url
        }
      }
    }
  `, { query });
  return (data.issueSearch?.nodes || []).map((i: any) => ({
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    description: i.description?.slice(0, 200),
    priority: i.priority,
    state: i.state?.name,
    assignee: i.assignee?.name,
    url: i.url,
    createdAt: i.createdAt,
  }));
}

export async function getIssue(integrationId: number, issueId: string) {
  const data = await linearGql(integrationId, `
    query($id: String!) {
      issue(id: $id) {
        id identifier title description priority priorityLabel
        state { name } assignee { name email }
        team { name key } labels { nodes { name } }
        createdAt updatedAt completedAt url
        comments { nodes { body user { name } createdAt } }
      }
    }
  `, { id: issueId });
  const i = data.issue;
  return {
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    description: i.description,
    priority: i.priority,
    priorityLabel: i.priorityLabel,
    state: i.state?.name,
    assignee: i.assignee ? { name: i.assignee.name, email: i.assignee.email } : null,
    team: i.team?.name,
    labels: (i.labels?.nodes || []).map((l: any) => l.name),
    url: i.url,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    completedAt: i.completedAt,
    comments: (i.comments?.nodes || []).map((c: any) => ({
      body: c.body,
      author: c.user?.name,
      createdAt: c.createdAt,
    })),
  };
}

export async function createIssue(integrationId: number, teamId: string, title: string, description?: string, priority?: number, assigneeId?: string) {
  const input: any = { teamId, title };
  if (description) input.description = description;
  if (priority != null) input.priority = priority;
  if (assigneeId) input.assigneeId = assigneeId;

  const data = await linearGql(integrationId, `
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url }
      }
    }
  `, { input });
  const result = data.issueCreate;
  return { created: result.success, issue: result.issue };
}

export async function updateIssue(integrationId: number, issueId: string, updates: { title?: string; description?: string; priority?: number; stateId?: string; assigneeId?: string }) {
  const data = await linearGql(integrationId, `
    mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier title state { name } url }
      }
    }
  `, { id: issueId, input: updates });
  const result = data.issueUpdate;
  return { updated: result.success, issue: result.issue };
}

export async function listTeams(integrationId: number) {
  const data = await linearGql(integrationId, `
    query {
      teams { nodes { id name key description } }
    }
  `);
  return (data.teams?.nodes || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    key: t.key,
    description: t.description,
  }));
}
