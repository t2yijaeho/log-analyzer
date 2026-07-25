import { useLogStore } from '../../state/useLogStore';
import { useChatStore } from '../../state/useChatStore';
import styles from './ChatInput.module.css';

/**
 * `draftText` lives in useChatStore (not local component state) specifically so
 * SelectedPairPanel's "Ask about this request" button can prefill it with no prop
 * drilling. Disabling mirrors the server's NO_LOG_LOADED/CHAT_IN_PROGRESS guards
 * client-side for instant feedback; the server is still the real authority -- a
 * race just surfaces as an inline turn error with Retry (see useChatStore.ts).
 */
export function ChatInput() {
  const sessionId = useLogStore((s) => s.sessionId);
  const draftText = useChatStore((s) => s.draftText);
  const inFlight = useChatStore((s) => s.inFlight);
  const setDraftText = useChatStore((s) => s.setDraftText);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const disabled = !sessionId || inFlight;
  const canSend = !disabled && draftText.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    void sendMessage(draftText);
  };

  return (
    <div className={styles.inputRow}>
      <textarea
        className={styles.textarea}
        placeholder={!sessionId ? 'Load a log first…' : inFlight ? 'Waiting for a response…' : 'Ask about this log…'}
        value={draftText}
        disabled={disabled}
        rows={2}
        onChange={(e) => setDraftText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="button" className={styles.send} disabled={!canSend} onClick={submit}>
        Send
      </button>
    </div>
  );
}
