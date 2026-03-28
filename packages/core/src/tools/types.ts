export type ToolDefinition<Params = any> = {
  name: string;
  description?: string;
  parameters?: any;
  execute: (params: Params) => Promise<any>;
};

export type ToolCall = {
  id: string;
  toolName: string;
  args: any;
  result?: any;
  error?: string;
};

