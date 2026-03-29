// Phase 10: SSH tools

import { ToolDefinition } from './types.js';
import * as ssh from '../services/ssh.js';

export const sshExecTool: ToolDefinition<{
  host: string;
  command: string;
}> = {
  name: 'ssh_exec',
  description: 'Execute a command on a remote host via SSH. The host can be a saved connection name, host address, or ID.',
  parameters: {
    type: 'object',
    properties: {
      host: { type: 'string', description: 'SSH connection name, host address, or saved key ID' },
      command: { type: 'string', description: 'Command to execute on the remote host' },
    },
    required: ['host', 'command'],
  },
  async execute(params) {
    return ssh.exec(params.host, params.command);
  },
};

export const sshUploadTool: ToolDefinition<{
  host: string;
  local_path: string;
  remote_path: string;
}> = {
  name: 'ssh_upload',
  description: 'Upload a file from workspace to a remote host via SCP/SFTP.',
  parameters: {
    type: 'object',
    properties: {
      host: { type: 'string', description: 'SSH connection name or ID' },
      local_path: { type: 'string', description: 'Local file path in workspace' },
      remote_path: { type: 'string', description: 'Destination path on remote host' },
    },
    required: ['host', 'local_path', 'remote_path'],
  },
  async execute(params) {
    return ssh.upload(params.host, params.local_path, params.remote_path);
  },
};

export const sshDownloadTool: ToolDefinition<{
  host: string;
  remote_path: string;
  local_path: string;
}> = {
  name: 'ssh_download',
  description: 'Download a file from a remote host to workspace via SCP/SFTP.',
  parameters: {
    type: 'object',
    properties: {
      host: { type: 'string', description: 'SSH connection name or ID' },
      remote_path: { type: 'string', description: 'File path on remote host' },
      local_path: { type: 'string', description: 'Destination path in workspace' },
    },
    required: ['host', 'remote_path', 'local_path'],
  },
  async execute(params) {
    return ssh.download(params.host, params.remote_path, params.local_path);
  },
};
