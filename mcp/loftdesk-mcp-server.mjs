#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const tools = [
  {
    name: 'loftdesk_detect_stack',
    description: 'Detects available package scripts and common project files relevant to the current workspace.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'loftdesk_run_script',
    description: 'Runs a safe project script like build, lint, test, typecheck, dev-check.',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', enum: ['build', 'lint', 'test', 'typecheck', 'preview'] }
      },
      required: ['script'],
      additionalProperties: false
    }
  },
  {
    name: 'loftdesk_git_snapshot',
    description: 'Returns git status and a short diff summary for the current repository.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }
];

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function error(id, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }) + '\n');
}

function run(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: true, cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', reject);
  });
}

async function handleTool(name, args) {
  if (name === 'loftdesk_detect_stack') {
    const pkg = existsSync(path.join(process.cwd(), 'package.json'));
    const vite = existsSync(path.join(process.cwd(), 'vite.config.js')) || existsSync(path.join(process.cwd(), 'vite.config.ts'));
    const netlify = existsSync(path.join(process.cwd(), 'netlify.toml'));
    const supabase = existsSync(path.join(process.cwd(), 'supabase'));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ packageJson: pkg, vite, netlify, supabase }, null, 2)
      }]
    };
  }

  if (name === 'loftdesk_run_script') {
    const { script } = args;
    const result = await run('npm', ['run', script]);
    return {
      content: [{
        type: 'text',
        text: [`Exit code: ${result.code}`, 'STDOUT:', result.stdout || '(empty)', 'STDERR:', result.stderr || '(empty)'].join('\n')
      }]
    };
  }

  if (name === 'loftdesk_git_snapshot') {
    const status = await run('git', ['status', '--short']);
    const diff = await run('git', ['diff', '--stat']);
    return {
      content: [{
        type: 'text',
        text: ['git status --short', status.stdout || '(clean)', '', 'git diff --stat', diff.stdout || '(no diff)'].join('\n')
      }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', async chunk => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }

    try {
      if (msg.method === 'initialize') {
        respond(msg.id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'loftdesk-local', version: '0.1.0' }
        });
      } else if (msg.method === 'tools/list') {
        respond(msg.id, { tools });
      } else if (msg.method === 'tools/call') {
        const result = await handleTool(msg.params.name, msg.params.arguments || {});
        respond(msg.id, result);
      } else if (msg.method === 'notifications/initialized') {
        // no-op
      } else {
        error(msg.id, `Unsupported method: ${msg.method}`);
      }
    } catch (e) {
      error(msg.id, e.message || String(e));
    }
  }
});
