import { ToolDefinition } from './types.js';
import { findIntegration } from '../lib/oauth2.js';
import * as gmail from '../services/integrations/gmail.js';
import * as calendar from '../services/integrations/calendar.js';
import * as notion from '../services/integrations/notion.js';
import * as drive from '../services/integrations/drive.js';
import * as dropbox from '../services/integrations/dropbox.js';
import * as linear from '../services/integrations/linear.js';
import * as github from '../services/integrations/github.js';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';

const USER_ID = 1; // Phase 0 placeholder

async function requireIntegration(provider: string, writeRequired = false) {
  const integration = await findIntegration(USER_ID, provider);
  if (!integration) throw new Error(`${provider} is not connected. Connect it in Settings → Integrations.`);
  if (writeRequired && integration.permission === 'read') {
    throw new Error(`${provider} is connected as read-only. Update permissions to read & write.`);
  }
  return integration;
}

// --- Gmail Tool ---
export const useGmailTool: ToolDefinition<{
  action: 'search' | 'read' | 'send' | 'labels';
  query?: string; email_id?: string; max_results?: number;
  to?: string; subject?: string; body?: string; cc?: string; bcc?: string;
}> = {
  name: 'use_gmail',
  description: 'Interact with Gmail: search emails, read an email, send emails, or list labels. Requires Gmail integration to be connected.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search', 'read', 'send', 'labels'], description: 'The action to perform' },
      query: { type: 'string', description: 'Search query (for search action)' },
      email_id: { type: 'string', description: 'Email ID (for read action)' },
      max_results: { type: 'number', description: 'Max results to return (default 10)' },
      to: { type: 'string', description: 'Recipient email (for send action)' },
      subject: { type: 'string', description: 'Email subject (for send action)' },
      body: { type: 'string', description: 'Email body text (for send action)' },
      cc: { type: 'string', description: 'CC recipients (for send action)' },
      bcc: { type: 'string', description: 'BCC recipients (for send action)' },
    },
    required: ['action'],
  },
  async execute(params) {
    const isWrite = params.action === 'send';
    const integration = await requireIntegration('gmail', isWrite);
    switch (params.action) {
      case 'search': return gmail.searchEmails(integration.id, params.query || '', params.max_results);
      case 'read': {
        if (!params.email_id) throw new Error('email_id required for read action');
        return gmail.getEmail(integration.id, params.email_id);
      }
      case 'send': {
        if (!params.to || !params.subject || !params.body) throw new Error('to, subject, and body required for send action');
        return gmail.sendEmail(integration.id, params.to, params.subject, params.body, params.cc, params.bcc);
      }
      case 'labels': return gmail.getLabels(integration.id);
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- Calendar Tool ---
export const useCalendarTool: ToolDefinition<{
  action: 'list' | 'get' | 'create' | 'update' | 'delete';
  start_date?: string; end_date?: string; event_id?: string;
  title?: string; start?: string; end?: string; description?: string; attendees?: string[];
}> = {
  name: 'use_calendar',
  description: 'Interact with Google Calendar: list events, get event details, create/update/delete events. Requires Google Calendar integration.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete'], description: 'The action to perform' },
      start_date: { type: 'string', description: 'Start date/time (ISO 8601) for list or create' },
      end_date: { type: 'string', description: 'End date/time (ISO 8601) for list or create' },
      event_id: { type: 'string', description: 'Event ID (for get/update/delete)' },
      title: { type: 'string', description: 'Event title (for create/update)' },
      start: { type: 'string', description: 'Event start time (for create/update)' },
      end: { type: 'string', description: 'Event end time (for create/update)' },
      description: { type: 'string', description: 'Event description' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails (for create)' },
    },
    required: ['action'],
  },
  async execute(params) {
    const isWrite = ['create', 'update', 'delete'].includes(params.action);
    const integration = await requireIntegration('google-calendar', isWrite);
    switch (params.action) {
      case 'list': {
        const start = params.start_date || new Date().toISOString();
        const end = params.end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        return calendar.listEvents(integration.id, start, end);
      }
      case 'get': {
        if (!params.event_id) throw new Error('event_id required');
        return calendar.getEvent(integration.id, params.event_id);
      }
      case 'create': {
        if (!params.title || !params.start || !params.end) throw new Error('title, start, and end required');
        return calendar.createEvent(integration.id, params.title, params.start, params.end, params.description, params.attendees);
      }
      case 'update': {
        if (!params.event_id) throw new Error('event_id required');
        return calendar.updateEvent(integration.id, params.event_id, { title: params.title, start: params.start, end: params.end, description: params.description });
      }
      case 'delete': {
        if (!params.event_id) throw new Error('event_id required');
        return calendar.deleteEvent(integration.id, params.event_id);
      }
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- Notion Tool ---
export const useNotionTool: ToolDefinition<{
  action: 'search' | 'get' | 'create' | 'update' | 'list-dbs' | 'query-db';
  query?: string; page_id?: string; parent_id?: string; title?: string; content?: string;
  db_id?: string; filter?: any;
}> = {
  name: 'use_notion',
  description: 'Interact with Notion: search pages, read/create/update pages, list databases, query databases. Requires Notion integration.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search', 'get', 'create', 'update', 'list-dbs', 'query-db'], description: 'The action to perform' },
      query: { type: 'string', description: 'Search query (for search action)' },
      page_id: { type: 'string', description: 'Page ID (for get/update actions)' },
      parent_id: { type: 'string', description: 'Parent page or database ID (for create action)' },
      title: { type: 'string', description: 'Page title (for create action)' },
      content: { type: 'string', description: 'Page content (for create/update actions)' },
      db_id: { type: 'string', description: 'Database ID (for query-db action)' },
      filter: { type: 'object', description: 'Notion filter object (for query-db action)' },
    },
    required: ['action'],
  },
  async execute(params) {
    const isWrite = ['create', 'update'].includes(params.action);
    const integration = await requireIntegration('notion', isWrite);
    const token = integration.access_token!;
    switch (params.action) {
      case 'search': return notion.searchPages(token, params.query || '');
      case 'get': {
        if (!params.page_id) throw new Error('page_id required');
        return notion.getPage(token, params.page_id);
      }
      case 'create': {
        if (!params.parent_id || !params.title) throw new Error('parent_id and title required');
        return notion.createPage(token, params.parent_id, params.title, params.content || '');
      }
      case 'update': {
        if (!params.page_id || !params.content) throw new Error('page_id and content required');
        return notion.updatePage(token, params.page_id, params.content);
      }
      case 'list-dbs': return notion.listDatabases(token);
      case 'query-db': {
        if (!params.db_id) throw new Error('db_id required');
        return notion.queryDatabase(token, params.db_id, params.filter);
      }
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- Drive Tool ---
export const useDriveTool: ToolDefinition<{
  action: 'search' | 'get' | 'download' | 'upload';
  query?: string; file_id?: string; name?: string; content?: string; mime_type?: string; folder_id?: string;
}> = {
  name: 'use_drive',
  description: 'Interact with Google Drive: search files, get file info, download file content, upload files. Requires Google Drive integration.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search', 'get', 'download', 'upload'], description: 'The action to perform' },
      query: { type: 'string', description: 'Search query (for search action)' },
      file_id: { type: 'string', description: 'File ID (for get/download actions)' },
      name: { type: 'string', description: 'File name (for upload action)' },
      content: { type: 'string', description: 'File content (for upload action)' },
      mime_type: { type: 'string', description: 'MIME type (for upload action, default text/plain)' },
      folder_id: { type: 'string', description: 'Folder ID to upload to (optional)' },
    },
    required: ['action'],
  },
  async execute(params) {
    const isWrite = params.action === 'upload';
    const integration = await requireIntegration('google-drive', isWrite);
    switch (params.action) {
      case 'search': return drive.searchFiles(integration.id, params.query || '');
      case 'get': {
        if (!params.file_id) throw new Error('file_id required');
        return drive.getFile(integration.id, params.file_id);
      }
      case 'download': {
        if (!params.file_id) throw new Error('file_id required');
        const content = await drive.downloadFile(integration.id, params.file_id);
        return { file_id: params.file_id, content: content.slice(0, 10000) };
      }
      case 'upload': {
        if (!params.name || !params.content) throw new Error('name and content required');
        return drive.uploadFile(integration.id, params.name, params.content, params.mime_type || 'text/plain', params.folder_id);
      }
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- Dropbox Tool ---
export const useDropboxTool: ToolDefinition<{
  action: 'search' | 'get' | 'download' | 'upload';
  query?: string; path?: string; content?: string;
}> = {
  name: 'use_dropbox',
  description: 'Interact with Dropbox: search files, get file info, download content, upload files. Requires Dropbox integration.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search', 'get', 'download', 'upload'], description: 'The action to perform' },
      query: { type: 'string', description: 'Search query (for search action)' },
      path: { type: 'string', description: 'File path in Dropbox (for get/download/upload)' },
      content: { type: 'string', description: 'File content (for upload action)' },
    },
    required: ['action'],
  },
  async execute(params) {
    const isWrite = params.action === 'upload';
    const integration = await requireIntegration('dropbox', isWrite);
    switch (params.action) {
      case 'search': return dropbox.searchFiles(integration.id, params.query || '');
      case 'get': {
        if (!params.path) throw new Error('path required');
        return dropbox.getFile(integration.id, params.path);
      }
      case 'download': {
        if (!params.path) throw new Error('path required');
        const content = await dropbox.downloadFile(integration.id, params.path);
        return { path: params.path, content: content.slice(0, 10000) };
      }
      case 'upload': {
        if (!params.path || !params.content) throw new Error('path and content required');
        return dropbox.uploadFile(integration.id, params.path, params.content);
      }
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- Linear Tool ---
export const useLinearTool: ToolDefinition<{
  action: 'search' | 'get' | 'create' | 'update' | 'list-teams';
  query?: string; issue_id?: string; team_id?: string; title?: string; description?: string;
  priority?: number; assignee_id?: string; state_id?: string;
}> = {
  name: 'use_linear',
  description: 'Interact with Linear: search issues, get issue details, create/update issues, list teams. Requires Linear integration.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search', 'get', 'create', 'update', 'list-teams'], description: 'The action to perform' },
      query: { type: 'string', description: 'Search query (for search action)' },
      issue_id: { type: 'string', description: 'Issue ID (for get/update actions)' },
      team_id: { type: 'string', description: 'Team ID (for create action)' },
      title: { type: 'string', description: 'Issue title (for create/update)' },
      description: { type: 'string', description: 'Issue description (for create/update)' },
      priority: { type: 'number', description: 'Priority 0-4 (for create/update)' },
      assignee_id: { type: 'string', description: 'Assignee user ID (for create/update)' },
      state_id: { type: 'string', description: 'State ID (for update)' },
    },
    required: ['action'],
  },
  async execute(params) {
    const isWrite = ['create', 'update'].includes(params.action);
    const integration = await requireIntegration('linear', isWrite);
    switch (params.action) {
      case 'search': return linear.searchIssues(integration.id, params.query || '');
      case 'get': {
        if (!params.issue_id) throw new Error('issue_id required');
        return linear.getIssue(integration.id, params.issue_id);
      }
      case 'create': {
        if (!params.team_id || !params.title) throw new Error('team_id and title required');
        return linear.createIssue(integration.id, params.team_id, params.title, params.description, params.priority, params.assignee_id);
      }
      case 'update': {
        if (!params.issue_id) throw new Error('issue_id required');
        const updates: any = {};
        if (params.title) updates.title = params.title;
        if (params.description) updates.description = params.description;
        if (params.priority != null) updates.priority = params.priority;
        if (params.state_id) updates.stateId = params.state_id;
        if (params.assignee_id) updates.assigneeId = params.assignee_id;
        return linear.updateIssue(integration.id, params.issue_id, updates);
      }
      case 'list-teams': return linear.listTeams(integration.id);
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- GitHub Tool ---
export const useGithubTool: ToolDefinition<{
  action: 'list-repos' | 'get-repo' | 'list-issues' | 'create-issue' | 'list-prs' | 'get-file';
  owner?: string; repo?: string; title?: string; body?: string;
  state?: 'open' | 'closed' | 'all'; path?: string;
}> = {
  name: 'use_github',
  description: 'Interact with GitHub: list repos, get repo details, list/create issues, list PRs, read file content. Requires GitHub integration.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list-repos', 'get-repo', 'list-issues', 'create-issue', 'list-prs', 'get-file'], description: 'The action to perform' },
      owner: { type: 'string', description: 'Repository owner (for repo-specific actions)' },
      repo: { type: 'string', description: 'Repository name (for repo-specific actions)' },
      title: { type: 'string', description: 'Issue title (for create-issue)' },
      body: { type: 'string', description: 'Issue body (for create-issue)' },
      state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter by state (for list-issues/list-prs)' },
      path: { type: 'string', description: 'File path in repo (for get-file)' },
    },
    required: ['action'],
  },
  async execute(params) {
    const isWrite = params.action === 'create-issue';
    const integration = await requireIntegration('github', isWrite);
    switch (params.action) {
      case 'list-repos': return github.listRepos(integration.id);
      case 'get-repo': {
        if (!params.owner || !params.repo) throw new Error('owner and repo required');
        return github.getRepo(integration.id, params.owner, params.repo);
      }
      case 'list-issues': {
        if (!params.owner || !params.repo) throw new Error('owner and repo required');
        return github.listIssues(integration.id, params.owner, params.repo, params.state);
      }
      case 'create-issue': {
        if (!params.owner || !params.repo || !params.title) throw new Error('owner, repo, and title required');
        return github.createIssue(integration.id, params.owner, params.repo, params.title, params.body);
      }
      case 'list-prs': {
        if (!params.owner || !params.repo) throw new Error('owner and repo required');
        return github.listPRs(integration.id, params.owner, params.repo, params.state);
      }
      case 'get-file': {
        if (!params.owner || !params.repo || !params.path) throw new Error('owner, repo, and path required');
        return github.getFileContent(integration.id, params.owner, params.repo, params.path);
      }
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- List App Tools ---
export const listAppToolsTool: ToolDefinition<{}> = {
  name: 'list_app_tools',
  description: 'List all connected integrations and their available actions. Use this to check which integration tools are available.',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const rows = await db.select().from(schema.integrations).where(eq(schema.integrations.user_id, USER_ID));
    const active = rows.filter(r => r.is_active);

    const providerActions: Record<string, string[]> = {
      gmail: ['search', 'read', 'send', 'labels'],
      'google-calendar': ['list', 'get', 'create', 'update', 'delete'],
      notion: ['search', 'get', 'create', 'update', 'list-dbs', 'query-db'],
      'google-drive': ['search', 'get', 'download', 'upload'],
      dropbox: ['search', 'get', 'download', 'upload'],
      linear: ['search', 'get', 'create', 'update', 'list-teams'],
      github: ['list-repos', 'get-repo', 'list-issues', 'create-issue', 'list-prs', 'get-file'],
    };

    const providerToolNames: Record<string, string> = {
      gmail: 'use_gmail',
      'google-calendar': 'use_calendar',
      notion: 'use_notion',
      'google-drive': 'use_drive',
      dropbox: 'use_dropbox',
      linear: 'use_linear',
      github: 'use_github',
    };

    return {
      connected: active.map(r => ({
        provider: r.provider,
        tool_name: providerToolNames[r.provider] || r.provider,
        label: r.label,
        account: r.account_email || r.account_name,
        permission: r.permission,
        actions: providerActions[r.provider] || [],
      })),
      not_connected: Object.keys(providerActions).filter(p => !active.some(a => a.provider === p)),
    };
  },
};
