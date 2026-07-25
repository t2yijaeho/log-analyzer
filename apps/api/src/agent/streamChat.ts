import { run } from '@openai/agents';
import type { AgentBundle } from '../session/types.js';
import { redactSecrets } from '../utils/redact.js';

export type ChatSseEvent =
  | { event: 'tool_call'; data: { id: string; name: string; arguments: unknown } }
  | { event: 'tool_result'; data: { id: string; name: string; output: unknown } }
  | { event: 'token'; data: { delta: string } }
  | { event: 'done'; data: { message: string } }
  | { event: 'error'; data: { code: string; message: string } };

export interface StreamChatTurnArgs {
  agentBundle: AgentBundle;
  message: string;
  onEvent: (event: ChatSseEvent) => void;
}

/** Matches the plan's `run(agent, message, { session, stream: true, maxTurns: 10 })`. */
const MAX_TURNS = 10;

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Maps a caught error to a small, safe `{code, message}` SSE payload. Never includes raw secrets. */
function classifyError(error: unknown): { code: string; message: string } {
  const name = error instanceof Error ? error.name : 'Error';
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = redactSecrets(rawMessage);

  switch (name) {
    case 'MaxTurnsExceededError':
      return { code: 'MAX_TURNS_EXCEEDED', message };
    case 'ModelRefusalError':
      return { code: 'MODEL_REFUSAL', message };
    case 'InputGuardrailTripwireTriggered':
    case 'OutputGuardrailTripwireTriggered':
    case 'ToolInputGuardrailTripwireTriggered':
    case 'ToolOutputGuardrailTripwireTriggered':
      return { code: 'GUARDRAIL_TRIGGERED', message };
    case 'ToolTimeoutError':
      return { code: 'TOOL_TIMEOUT', message };
    default: {
      // Surface a recognizable code for OpenAI API-level failures (auth, rate limit, bad
      // model/param, 5xx) without depending on a specific SDK error class name/version.
      const status = (error as { status?: number } | undefined)?.status;
      if (typeof status === 'number') {
        return { code: `OPENAI_API_ERROR_${status}`, message };
      }
      return { code: 'AGENT_ERROR', message };
    }
  }
}

/**
 * Runs one chat turn against an already-built agent/session bundle, translating the SDK's
 * `RunStreamEvent`s directly into the SSE contract's five event types:
 *   tool_call -> tool_result -> token* -> done   (happy path)
 *   ... -> error                                  (anywhere something goes wrong)
 *
 * Guaranteed to call `onEvent` with exactly one terminal event (`done` xor `error`) and to
 * never throw -- callers do not strictly need a try/catch of their own around this (though
 * `routes/chat.ts` keeps one anyway, as defense in depth; it should never trigger).
 */
export async function streamChatTurn({ agentBundle, message, onEvent }: StreamChatTurnArgs): Promise<void> {
  try {
    const result = await run(agentBundle.agent, message, {
      session: agentBundle.memorySession,
      stream: true,
      maxTurns: MAX_TURNS,
    });

    for await (const event of result) {
      if (event.type === 'raw_model_stream_event') {
        if (event.data.type === 'output_text_delta') {
          onEvent({ event: 'token', data: { delta: event.data.delta } });
        }
        continue;
      }

      if (event.type === 'run_item_stream_event') {
        const item = event.item;
        if (item.type === 'tool_call_item' && item.rawItem.type === 'function_call') {
          const { callId, name, arguments: rawArgs } = item.rawItem;
          onEvent({ event: 'tool_call', data: { id: callId, name, arguments: safeParseJson(rawArgs) } });
        } else if (item.type === 'tool_call_output_item' && item.rawItem.type === 'function_call_result') {
          const { callId, name } = item.rawItem;
          onEvent({ event: 'tool_result', data: { id: callId, name, output: item.output } });
        }
        continue;
      }
    }

    // Ensures any pending internal bookkeeping has settled before reading `.error`/`.finalOutput`
    // (per the SDK's own docs on `StreamedRunResult#completed`); a rejection here is caught below.
    await result.completed;

    if (result.error) {
      onEvent({ event: 'error', data: classifyError(result.error) });
      return;
    }

    const finalMessage = typeof result.finalOutput === 'string' ? result.finalOutput : String(result.finalOutput ?? '');
    onEvent({ event: 'done', data: { message: finalMessage } });
  } catch (error) {
    onEvent({ event: 'error', data: classifyError(error) });
  }
}
