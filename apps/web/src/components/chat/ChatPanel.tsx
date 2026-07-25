import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import styles from './ChatPanel.module.css';

export function ChatPanel() {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>Chat</div>
      <MessageList />
      <ChatInput />
    </div>
  );
}
