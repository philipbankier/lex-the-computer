// Phase 10: AI Browser tools

import { ToolDefinition } from './types.js';
import * as browser from '../services/browser.js';

export const browseWebTool: ToolDefinition<{
  url?: string;
  action: 'navigate' | 'screenshot' | 'click' | 'type' | 'extract' | 'evaluate' | 'info';
  selector?: string;
  text?: string;
  code?: string;
}> = {
  name: 'browse_web',
  description: 'Browse the web using a real browser (Playwright). Navigate to URLs, take screenshots, click elements, type text, extract content, evaluate JavaScript, or get page info.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to (for navigate/screenshot actions)' },
      action: { type: 'string', enum: ['navigate', 'screenshot', 'click', 'type', 'extract', 'evaluate', 'info'], description: 'Browser action to perform' },
      selector: { type: 'string', description: 'CSS selector (for click/type/extract actions)' },
      text: { type: 'string', description: 'Text to type (for type action)' },
      code: { type: 'string', description: 'JavaScript code to evaluate (for evaluate action)' },
    },
    required: ['action'],
  },
  async execute(params) {
    switch (params.action) {
      case 'navigate': {
        if (!params.url) throw new Error('url required for navigate action');
        return browser.navigateTo(params.url);
      }
      case 'screenshot': return browser.screenshot(params.url);
      case 'click': {
        if (!params.selector) throw new Error('selector required for click action');
        return browser.clickElement(params.selector);
      }
      case 'type': {
        if (!params.selector || !params.text) throw new Error('selector and text required for type action');
        return browser.typeText(params.selector, params.text);
      }
      case 'extract': return browser.extractContent(params.selector);
      case 'evaluate': {
        if (!params.code) throw new Error('code required for evaluate action');
        return browser.evaluateScript(params.code);
      }
      case 'info': return browser.getPageInfo();
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

export const browserSessionTool: ToolDefinition<{
  action: 'list' | 'delete';
  session_id?: number;
}> = {
  name: 'browser_session',
  description: 'Manage browser sessions. List saved sessions or delete a session.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'delete'], description: 'Action to perform' },
      session_id: { type: 'number', description: 'Session ID (for delete action)' },
    },
    required: ['action'],
  },
  async execute(params) {
    switch (params.action) {
      case 'list': return browser.listSessions();
      case 'delete': {
        if (!params.session_id) throw new Error('session_id required for delete action');
        return browser.deleteSession(params.session_id);
      }
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};
