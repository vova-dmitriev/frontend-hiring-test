import cn from "clsx";
import { FC, useCallback, useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { useChat } from "../hooks";

import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";
import { NewMessagesBanner } from "./new-messages-banner";
import styles from "./styles.module.css";

import { ScrollToBottomButton } from "@/shared/ui";

export const ChatWidget: FC = () => {
  const {
    messages,
    loading,
    error,
    hasNextPage,
    loadMore,
    sendingMessage,
    sendError,
    inputValue,
    setInputValue,
    handleSubmit,
    isConnected,
    isAtBottom,
    setIsAtBottom,
    newMessagesCount,
    resetNewMessages,
  } = useChat();

  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const handleScrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      behavior: "smooth",
    });
  }, [messages.length]);

  const handleBannerClick = useCallback(() => {
    handleScrollToBottom();
    resetNewMessages();
  }, [handleScrollToBottom, resetNewMessages]);

  return (
    <div className={styles.root}>
      {/* Connection status indicator */}
      {!isConnected && (
        <div className={cn(styles.connectionStatus, styles.disconnected)}>
          Connection lost. Attempting to reconnect...
        </div>
      )}

      {/* Main container with messages */}
      <div className={styles.container}>
        {!!newMessagesCount && !isAtBottom && (
          <NewMessagesBanner
            count={newMessagesCount}
            onClick={handleBannerClick}
          />
        )}
        <MessageList
          messages={messages}
          loading={loading}
          hasNextPage={hasNextPage}
          onLoadMore={loadMore}
          isAtBottom={isAtBottom}
          onAtBottomChange={setIsAtBottom}
          virtuosoRef={virtuosoRef}
        />

        {!isAtBottom && <ScrollToBottomButton onClick={handleScrollToBottom} />}
      </div>

      {/* Message input field */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        loading={sendingMessage}
        disabled={!isConnected}
        placeholder={
          !isConnected ? "Waiting for connection..." : "Enter message..."
        }
      />

      {/* Error display */}
      {(error || sendError) && (
        <div className={styles.errorMessage}>
          {error?.message || sendError?.message || "An error occurred"}
        </div>
      )}
    </div>
  );
};
