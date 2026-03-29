// AI Browser tools — Playwright + Stagehand

import { ToolDefinition } from './types.js';
import * as browser from '../services/browser.js';

export const browseWebTool: ToolDefinition<{
  url?: string;
  action: 'navigate' | 'screenshot' | 'click' | 'type' | 'extract' | 'evaluate' | 'info' | 'act' | 'ai_extract' | 'observe';
  selector?: string;
  text?: string;
  code?: string;
  instruction?: string;
}> = {
  name: 'browse_web',
  description: 'Browse the web using a real browser. Standard Playwright actions: navigate, screenshot, click, type, extract, evaluate, info. AI-powered Stagehand actions: act (natural language click/type/interact), ai_extract (structured data extraction), observe (find visible elements).',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      action: { type: 'string', enum: ['navigate', 'screenshot', 'click', 'type', 'extract', 'evaluate', 'info', 'act', 'ai_extract', 'observe'], description: 'Browser action to perform' },
      selector: { type: 'string', description: 'CSS selector (for click/type/extract actions)' },
      text: { type: 'string', description: 'Text to type (for type action) or natural language action (for act)' },
      code: { type: 'string', description: 'JavaScript code to evaluate (for evaluate action)' },
      instruction: { type: 'string', description: 'Natural language instruction (for act, ai_extract, observe actions)' },
    },
    required: ['action'],
  },
  async execute(params) {
    switch (params.action) {
      // Standard Playwright actions
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

      // Stagehand AI actions
      case 'act': {
        const instruction = params.instruction || params.text;
        if (!instruction) throw new Error('instruction or text required for act action');
        return browser.stagehandAct(params.url, instruction);
      }
      case 'ai_extract': {
        if (!params.instruction) throw new Error('instruction required for ai_extract action');
        return browser.stagehandExtract(params.url, params.instruction);
      }
      case 'observe': {
        if (!params.instruction) throw new Error('instruction required for observe action');
        return browser.stagehandObserve(params.url, params.instruction);
      }
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
