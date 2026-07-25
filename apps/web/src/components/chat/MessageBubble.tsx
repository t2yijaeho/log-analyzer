import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../../state/useChatStore';
import { ToolActivityChip } from './ToolActivityChip';
import styles from './MessageBubble.module.css';

/** react-markdown never renders raw HTML from its input unless explicitly opted
 *  into (rehype-raw), so streamed model/user text can't inject markup here. */
const REMARK_PLUGINS = [remarkGfm];

/**
 * Subscribes to exactly one turn by id (`s.turns.find(...)`). Token updates during
 * streaming replace only the matching turn object in the store's array (see
 * patchTurn in useChatStore.ts), so every *other* mounted MessageBubble's selector
 * keeps returning the same object reference and does not re-render -- only the
 * bubble actually receiving new tokens does.
 */
export function MessageBubble({ id }: { id: string }) {
  const turn = useChatStore((s) => s.turns.find((t) => t.id === id));
  const retryTurn = useChatStore((s) => s.retryTurn);

  if (!turn) return null;

  const roleClass =
    turn.role === 'user' ? styles.user : turn.role === 'system-summary' ? styles.systemSummary : styles.assistant;

  return (
    <div className={`${styles.bubble} ${roleClass}`}>
      {turn.toolActivity.length > 0 ? (
        <div className={styles.toolActivity}>
          {turn.toolActivity.map((activity) => (
            <ToolActivityChip key={activity.id} activity={activity} />
          ))}
        </div>
      ) : null}

      <div className={styles.text}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{turn.text}</ReactMarkdown>
        {turn.streaming ? <span className={styles.cursor} aria-hidden="true" /> : null}
      </div>

      {turn.errorCode ? (
        <div className={styles.error}>
          <span>Something went wrong ({turn.errorCode}).</span>
          <button type="button" className={styles.retry} onClick={() => void retryTurn(id)}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
