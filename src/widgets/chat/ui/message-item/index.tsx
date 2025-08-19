import { Message, MessageSender, MessageStatus } from "@entities/message";
import cn from "clsx";
import { FC } from "react";

import styles from "./styles.module.css";

export interface MessageItemProps {
  message: Message;
}

export const MessageItem: FC<MessageItemProps> = ({ message }) => {
  const { text, sender, status } = message;

  const isOutgoing = sender === MessageSender.Admin;

  const getStatusIcon = () => {
    switch (status) {
      case MessageStatus.Sending:
        return "⏳";
      case MessageStatus.Sent:
        return "✓";
      case MessageStatus.Read:
        return "✓✓";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case MessageStatus.Sending:
        return "#999";
      case MessageStatus.Sent:
        return "#666";
      case MessageStatus.Read:
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  return (
    <div className={styles.item}>
      <div className={cn(styles.message, isOutgoing ? styles.out : styles.in)}>
        <div className={styles.messageText}>{text}</div>
        {isOutgoing && (
          <div
            className={styles.messageStatus}
            style={{ color: getStatusColor() }}
            title={status}
          >
            {getStatusIcon()}
          </div>
        )}
      </div>
    </div>
  );
};
