// Phase 10: Diagram Generation service using D2
// D2 is a diagram scripting language (https://d2lang.com)

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function isD2Installed(): Promise<boolean> {
  try {
    await execAsync('which d2');
    return true;
  } catch {
    return false;
  }
}

export async function generateDiagram(d2Code: string, format: 'svg' | 'png' = 'svg'): Promise<{ path: string }> {
  if (!(await isD2Installed())) {
    throw new Error('D2 is not installed. Install it: curl -fsSL https://d2lang.com/install.sh | sh');
  }

  const timestamp = Date.now();
  const inputPath = path.join(env.WORKSPACE_DIR, 'files', `.tmp-diagram-${timestamp}.d2`);
  const outputFilename = `diagram-${timestamp}.${format}`;
  const outputPath = path.join(env.WORKSPACE_DIR, 'files', outputFilename);

  try {
    await fs.writeFile(inputPath, d2Code, 'utf-8');
    await execAsync(`d2 --theme 200 "${inputPath}" "${outputPath}"`, { timeout: 30000 });
    return { path: `files/${outputFilename}` };
  } finally {
    try { await fs.unlink(inputPath); } catch {}
  }
}

export async function diagramFromDescription(description: string): Promise<{ d2Code: string; path: string }> {
  // Generate D2 code from a natural language description
  // This is a structured mapping - the AI tool caller should provide the D2 code
  // Here we provide a helper that converts simple descriptions to D2
  const d2Code = descriptionToD2(description);
  const result = await generateDiagram(d2Code);
  return { d2Code, ...result };
}

function descriptionToD2(description: string): string {
  // Basic heuristic: split by arrows/connections
  const lines = description.split(/[,;\n]+/).map(l => l.trim()).filter(Boolean);
  const d2Lines: string[] = [];

  for (const line of lines) {
    // Match "A -> B" or "A to B" patterns
    const arrowMatch = line.match(/^(.+?)\s*(?:->|→|to)\s*(.+?)(?:\s*:\s*(.+))?$/i);
    if (arrowMatch) {
      const [, from, to, label] = arrowMatch;
      const edge = label ? `${from.trim()} -> ${to.trim()}: ${label.trim()}` : `${from.trim()} -> ${to.trim()}`;
      d2Lines.push(edge);
    } else {
      // Just a node declaration
      d2Lines.push(line);
    }
  }

  return d2Lines.join('\n') || `# ${description}\nNote: Please provide D2 code directly for complex diagrams`;
}
