import { ToolDefinition } from './types.js';
import { runCommand } from './run_command.js';

export const runParallelCommands: ToolDefinition<{ commands: string[] }> = {
  name: 'run_parallel_commands',
  description: 'Run multiple shell commands concurrently and return all results',
  parameters: {
    type: 'object',
    properties: { commands: { type: 'array', items: { type: 'string' } } },
    required: ['commands'],
  },
  async execute({ commands }) {
    const results = await Promise.all(commands.map(async (cmd) => ({ cmd, ...(await runCommand.execute({ cmd })) })));
    return { results };
  },
};

