import { Agent, MemorySession } from '@openai/agents';
import type { ParsedLog } from '@log-analyzer/core';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import type { AgentBundle } from '../session/types.js';
import { AGENT_INSTRUCTIONS } from './instructions.js';
import { buildToolsForLog } from './tools.js';

/**
 * Builds one fresh `Agent` + `MemorySession` for a newly-loaded log. Called once per
 * successful `POST /api/logs` (see `routes/logs.ts`), replacing whatever bundle (and
 * conversation history) the session previously had -- loading a new log always starts a new
 * investigation.
 */
export function buildAgentBundleForLog(parsedLog: ParsedLog): AgentBundle {
  const tools = buildToolsForLog(parsedLog);

  const agent = new Agent({
    name: 'Log Analyzer',
    instructions: AGENT_INSTRUCTIONS,
    model: config.openaiModel,
    modelSettings: { reasoning: { effort: config.reasoningEffort } },
    tools,
  });

  const memorySession = new MemorySession({ sessionId: randomUUID() });

  return { agent, memorySession };
}
