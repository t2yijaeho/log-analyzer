import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useChatStore } from '../../state/useChatStore';
import { MessageBubble } from './MessageBubble';
import styles from './MessageList.module.css';

/**
 * Subscribes only to the *array of turn ids* (via `useShallow`, so a per-token
 * update -- which replaces one turn object but not the array's length/order --
 * doesn't re-render this list at all). Each id is handed to its own MessageBubble,
 * which subscribes to that one turn individually.
 */
export function MessageList() {
  const ids = useChatStore(useShallow((s) => s.turns.map((t) => t.id)));
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [ids.length]);

  if (ids.length === 0) {
    return <div className={styles.empty}>Load a log to start chatting about it.</div>;
  }

  return (
    <div className={styles.list}>
      {ids.map((id) => (
        <MessageBubble key={id} id={id} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
