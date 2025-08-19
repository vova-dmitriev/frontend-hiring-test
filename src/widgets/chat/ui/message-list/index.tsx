import { Message } from "@entities/message";
import { FC, useCallback } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { MessageItem } from "../message-item";

import styles from "./styles.module.css";

export interface MessageListProps {
  virtuosoRef: React.RefObject<VirtuosoHandle>;
  messages: Message[];
  loading: boolean;
  hasNextPage: boolean;
  onLoadMore: () => Promise<void>;
  isAtBottom: boolean;
  onAtBottomChange: (isAtBottom: boolean) => void;
  className?: string;
}

export const MessageList: FC<MessageListProps> = ({
  virtuosoRef,
  messages,
  loading,
  hasNextPage,
  onLoadMore,
  isAtBottom,
  onAtBottomChange,
  className,
}) => {
  const itemContent = useCallback((_: number, message: Message) => {
    return <MessageItem message={message} />;
  }, []);

  const handleEndReached = useCallback(async () => {
    if (loading || !hasNextPage) return;

    try {
      await onLoadMore();
    } catch (error) {
      console.error("Error loading more messages:", error);
    }
  }, [loading, hasNextPage, onLoadMore]);

  const Header = useCallback(() => {
    if (!hasNextPage) return null;

    return (
      <div className={styles.loadingIndicator}>
        {loading ? "Loading messages..." : "Pull to load more"}
      </div>
    );
  }, [loading, hasNextPage]);

  // Footer component for empty state
  const Footer = useCallback(() => {
    if (messages.length > 0) return null;

    return (
      <div className={styles.emptyState}>
        {loading ? "Loading messages..." : "No messages"}
      </div>
    );
  }, [loading, messages.length]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <Virtuoso
        ref={virtuosoRef}
        className={`${styles.list} ${className || ""}`}
        data={messages}
        itemContent={itemContent}
        endReached={handleEndReached}
        components={{
          Header,
          Footer,
        }}
        // Start from the bottom to show latest messages first
        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
        // Auto-follow only when user is at bottom
        followOutput={isAtBottom ? "smooth" : false}
        // Track bottom state for auto-scroll and scroll-to-bottom button
        atBottomStateChange={onAtBottomChange}
        // Settings for performance optimization
        overscan={5}
        increaseViewportBy={200}
      />

      {/* Scroll to bottom button */}
    </div>
  );
};
