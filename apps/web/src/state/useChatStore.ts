import { create } from 'zustand';
import { sendChatMessage, ChatApiError } from '../api/chat';
import { useLogStore } from './useLogStore';

export interface ToolActivity {
  id: string;
  name: string;
  arguments: unknown;
  output?: unknown;
  status: 'calling' | 'done';
}

export type ChatRole = 'user' | 'assistant' | 'system-summary';

export interface ChatTurn {
  id: string;
  role: ChatRole;
  text: string;
  toolActivity: ToolActivity[];
  streaming: boolean;
  errorCode?: string;
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Replaces one turn by id, preserving reference identity of every other turn so
 *  MessageBubble's per-id selector only re-renders the turn that actually changed. */
function patchTurn(turns: ChatTurn[], id: string, patch: Partial<ChatTurn>): ChatTurn[] {
  return turns.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn));
}

function patchToolActivity(
  turns: ChatTurn[],
  turnId: string,
  toolCallId: string,
  patch: Partial<ToolActivity>,
): ChatTurn[] {
  return turns.map((turn) => {
    if (turn.id !== turnId) return turn;
    const exists = turn.toolActivity.some((t) => t.id === toolCallId);
    const toolActivity = exists
      ? turn.toolActivity.map((t) => (t.id === toolCallId ? { ...t, ...patch } : t))
      : [...turn.toolActivity, { id: toolCallId, name: '', arguments: undefined, status: 'calling' as const, ...patch }];
    return { ...turn, toolActivity };
  });
}

interface ChatState {
  turns: ChatTurn[];
  draftText: string;
  inFlight: boolean;

  setDraftText: (text: string) => void;
  addSystemSummary: (text: string) => void;
  sendMessage: (message: string) => Promise<void>;
  retryTurn: (turnId: string) => Promise<void>;
  reset: () => void;
}

// Lives outside the store initializer and talks to `useChatStore.setState`/`getState`
// directly (rather than closing over the initializer's `set`/`get`) -- this is the
// same getState()/setState()-outside-the-render-cycle pattern the SSE reader needs,
// and it lets `sendMessage` and `retryTurn` share one implementation.
async function runTurn(assistantTurnId: string, userMessage: string) {
  const set = useChatStore.setState;
  const sessionId = useLogStore.getState().sessionId;

  if (!sessionId) {
    set((s) => ({
      turns: patchTurn(s.turns, assistantTurnId, {
        streaming: false,
        errorCode: 'NO_LOG_LOADED',
        text: 'Load a log before starting a chat.',
      }),
      inFlight: false,
    }));
    return;
  }

  try {
    for await (const event of sendChatMessage(sessionId, userMessage)) {
      switch (event.type) {
        case 'tool_call':
          set((s) => ({
            turns: patchToolActivity(s.turns, assistantTurnId, event.data.id, {
              name: event.data.name,
              arguments: event.data.arguments,
              status: 'calling',
            }),
          }));
          break;
        case 'tool_result':
          set((s) => ({
            turns: patchToolActivity(s.turns, assistantTurnId, event.data.id, {
              output: event.data.output,
              status: 'done',
            }),
          }));
          break;
        case 'token':
          set((s) => ({
            turns: patchTurn(s.turns, assistantTurnId, {
              text: (s.turns.find((t) => t.id === assistantTurnId)?.text ?? '') + event.data.delta,
            }),
          }));
          break;
        case 'done':
          // The `done` event's message is authoritative -- prefer it over the
          // locally concatenated token stream (network hiccups, reordering,
          // etc. could otherwise leave the two out of sync).
          set((s) => ({
            turns: patchTurn(s.turns, assistantTurnId, { text: event.data.message, streaming: false }),
            inFlight: false,
          }));
          break;
        case 'error':
          set((s) => ({
            turns: patchTurn(s.turns, assistantTurnId, {
              streaming: false,
              errorCode: event.data.code,
              text: s.turns.find((t) => t.id === assistantTurnId)?.text || event.data.message,
            }),
            inFlight: false,
          }));
          break;
      }
    }
  } catch (err) {
    const info =
      err instanceof ChatApiError
        ? { code: err.code, message: err.message }
        : { code: 'NETWORK_ERROR', message: 'Could not reach the server while chatting.' };
    set((s) => ({
      turns: patchTurn(s.turns, assistantTurnId, {
        streaming: false,
        errorCode: info.code,
        text: s.turns.find((t) => t.id === assistantTurnId)?.text || info.message,
      }),
      inFlight: false,
    }));
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  turns: [],
  draftText: '',
  inFlight: false,

  setDraftText: (text) => set({ draftText: text }),

  addSystemSummary: (text) =>
    set((s) => ({
      turns: [...s.turns, { id: makeId(), role: 'system-summary', text, toolActivity: [], streaming: false }],
    })),

  sendMessage: async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || get().inFlight) return;

    const userTurn: ChatTurn = { id: makeId(), role: 'user', text: trimmed, toolActivity: [], streaming: false };
    const assistantTurn: ChatTurn = { id: makeId(), role: 'assistant', text: '', toolActivity: [], streaming: true };

    set((s) => ({
      turns: [...s.turns, userTurn, assistantTurn],
      draftText: '',
      inFlight: true,
    }));

    await runTurn(assistantTurn.id, trimmed);
  },

  retryTurn: async (turnId: string) => {
    if (get().inFlight) return;
    const turns = get().turns;
    const idx = turns.findIndex((t) => t.id === turnId);
    if (idx < 1) return;
    const userTurn = turns[idx - 1];
    if (userTurn.role !== 'user') return;

    set((s) => ({
      turns: patchTurn(s.turns, turnId, { text: '', streaming: true, errorCode: undefined, toolActivity: [] }),
      inFlight: true,
    }));

    await runTurn(turnId, userTurn.text);
  },

  reset: () => set({ turns: [], draftText: '', inFlight: false }),
}));
