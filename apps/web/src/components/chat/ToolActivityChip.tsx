import { useState } from 'react';
import type { ToolActivity } from '../../state/useChatStore';
import styles from './ToolActivityChip.module.css';

/** A small expandable "Used tool: X" chip -- collapsed by default, showing the raw
 *  tool_call arguments / tool_result output as JSON once expanded. */
export function ToolActivityChip({ activity }: { activity: ToolActivity }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.chip}>
      <button type="button" className={styles.summary} onClick={() => setExpanded((v) => !v)}>
        <span className={styles.status} data-done={activity.status === 'done' ? 'true' : 'false'} aria-hidden="true" />
        <span>Used tool: {activity.name || '…'}</span>
        <span className={styles.caret} aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded ? (
        <pre className={styles.detail}>{JSON.stringify({ arguments: activity.arguments, output: activity.output }, null, 2)}</pre>
      ) : null}
    </div>
  );
}
