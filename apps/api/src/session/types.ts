import type { Agent, MemorySession } from '@openai/agents';
import type { ParsedLog } from '@log-analyzer/core';

/**
 * One `Agent` + `MemorySession` pair, built fresh (via closures over one specific
 * `ParsedLog`, see `agent/agentFactory.ts` / `agent/tools.ts`) every time a log is loaded
 * into a session. There is no generic/shared `RunContext<T>` anywhere in this system --
 * each bundle's tools can only ever see the one `ParsedLog` they were built for, which makes
 * cross-session data leakage structurally impossible rather than merely policy-enforced.
 */
export interface AgentBundle {
  agent: Agent;
  memorySession: MemorySession;
}

export interface SessionState {
  sessionId: string;
  createdAt: number;
  lastAccessedAt: number;
  parsedLog: ParsedLog | null;
  agentBundle: AgentBundle | null;
  /** Guards against racing two `run()` calls against the same `MemorySession` history at once. */
  chatInProgress: boolean;
}
