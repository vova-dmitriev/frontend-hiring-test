import { Message } from "@entities/message";
import { useState, useCallback } from "react";

import { useMessages } from "./useMessages";
import { useMessageSubscriptions } from "./useMessageSubscriptions";
import { useSendMessage } from "./useSendMessage";

export interface UseChatReturn {
  // Message data
  messages: Message[];
  loading: boolean;
  error: Error | undefined;

  // Pagination
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  loadMore: () => Promise<void>;

  // Message sending
  sendMessage: (text: string) => Promise<void>;
  sendingMessage: boolean;
  sendError: Error | undefined;

  // Interface management
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSubmit: () => Promise<void>;

  // Connection state
  isConnected: boolean;

  // Scroll state
  isAtBottom: boolean;
  setIsAtBottom: (isAtBottom: boolean) => void;

  // New messages notification
  newMessagesCount: number;
  resetNewMessages: () => void;
}

export const useChat = (): UseChatReturn => {
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  // Hooks for data management
  const {
    messages,
    loading,
    error,
    hasNextPage,
    hasPreviousPage,
    fetchMore,
    refetch,
  } = useMessages();

  const {
    sendMessage: sendMessageMutation,
    loading: sendingMessage,
    error: sendError,
  } = useSendMessage();

  // Real-time update subscriptions
  useMessageSubscriptions({
    onMessageAdded: () => {
      // If user is not at the bottom, show the notification
      if (!isAtBottom) {
        setNewMessagesCount((count) => count + 1);
      }
    },
    onMessageUpdated: (updatedMessage) => {
      console.log("Message updated:", updatedMessage);
    },
  });

  // Function to load additional messages
  const loadMore = useCallback(async () => {
    try {
      await fetchMore();
    } catch (fetchError) {
      console.error("Error loading more messages:", fetchError);
      setIsConnected(false);

      // Attempt to reconnect after some time
      setTimeout(() => {
        setIsConnected(true);
        refetch();
      }, 3000);
    }
  }, [fetchMore, refetch]);

  // Function to send a message
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) return;

      try {
        await sendMessageMutation(trimmedText);
      } catch (error) {
        console.error("Error sending message:", error);
        setIsConnected(false);

        // Attempt to reconnect
        setTimeout(() => {
          setIsConnected(true);
        }, 3000);
      }
    },
    [sendMessageMutation]
  );

  // Form submission handler
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || sendingMessage) return;

    const messageText = inputValue;
    setInputValue(""); // Clear input field immediately for better UX

    await sendMessage(messageText);
  }, [inputValue, sendingMessage, sendMessage]);

  // Сбрасываем уведомление при достижении низа
  const handleAtBottomChange = useCallback(
    (atBottom: boolean) => {
      setIsAtBottom(atBottom);
      if (atBottom && newMessagesCount > 0) {
        setNewMessagesCount(0);
      }
    },
    [newMessagesCount]
  );

  const resetNewMessages = useCallback(() => setNewMessagesCount(0), []);

  return {
    // Message data
    messages,
    loading,
    error,

    // Pagination
    hasNextPage,
    hasPreviousPage,
    loadMore,

    // Message sending
    sendMessage,
    sendingMessage,
    sendError,

    // Interface management
    inputValue,
    setInputValue,
    handleSubmit,

    // Connection state
    isConnected,

    // Scroll state
    isAtBottom,
    setIsAtBottom: handleAtBottomChange,

    // New messages notification
    newMessagesCount,
    resetNewMessages,
  };
};
