import { useSubscription, useApolloClient } from "@apollo/client";
import { Message, MessageEdge, MessagePage } from "@entities/message";
import {
  MESSAGE_ADDED_SUBSCRIPTION,
  MESSAGE_UPDATED_SUBSCRIPTION,
  GET_MESSAGES,
} from "@shared/api";

export interface UseMessageSubscriptionsOptions {
  onMessageAdded?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
}

export const useMessageSubscriptions = (
  options: UseMessageSubscriptionsOptions = {}
) => {
  const client = useApolloClient();
  const { onMessageAdded, onMessageUpdated } = options;

  // Subscription for new messages
  const { data: newMessageData } = useSubscription<{ messageAdded: Message }>(
    MESSAGE_ADDED_SUBSCRIPTION,
    {
      errorPolicy: "all",
      onData: ({ data }) => {
        if (data?.data?.messageAdded) {
          handleNewMessage(data.data.messageAdded);
        }
      },
    }
  );

  // Subscription for message updates
  const { data: updatedMessageData } = useSubscription<{
    messageUpdated: Message;
  }>(MESSAGE_UPDATED_SUBSCRIPTION, {
    errorPolicy: "all",
    onData: ({ data }) => {
      if (data?.data?.messageUpdated) {
        handleUpdatedMessage(data.data.messageUpdated);
      }
    },
  });

  const handleNewMessage = (newMessage: Message) => {
    try {
      // Read current data from cache
      const existingData = client.readQuery<{ messages: MessagePage }>({
        query: GET_MESSAGES,
      });

      if (!existingData) return;

      // Check that the message doesn't already exist in cache
      const messageExists = existingData.messages.edges.some(
        (edge: MessageEdge) => edge.node.id === newMessage.id
      );

      if (!messageExists) {
        // Add new message to the end of the list
        const newEdge = {
          node: newMessage,
          cursor: `cursor_${newMessage.id}`,
          __typename: "MessageEdge" as const,
        };

        client.writeQuery({
          query: GET_MESSAGES,
          data: {
            messages: {
              ...existingData.messages,
              edges: [...existingData.messages.edges, newEdge],
            },
          },
        });

        // Call callback if provided
        onMessageAdded?.(newMessage);
      }
    } catch (error) {
      console.error("Error handling new message:", error);
    }
  };

  const handleUpdatedMessage = (updatedMessage: Message) => {
    try {
      // Read current data from cache
      const existingData = client.readQuery<{ messages: MessagePage }>({
        query: GET_MESSAGES,
      });

      if (!existingData) return;

      // Find the index of the message to update
      const messageIndex = existingData.messages.edges.findIndex(
        (edge: MessageEdge) => edge.node.id === updatedMessage.id
      );

      if (messageIndex === -1) return;

      const existingMessage = existingData.messages.edges[messageIndex].node;

      // Check data freshness by updatedAt
      const existingUpdatedAt = new Date(existingMessage.updatedAt);
      const incomingUpdatedAt = new Date(updatedMessage.updatedAt);

      if (incomingUpdatedAt < existingUpdatedAt) {
        console.warn("Ignoring outdated message update from subscription:", {
          messageId: updatedMessage.id,
          existing: existingMessage.updatedAt,
          incoming: updatedMessage.updatedAt,
        });
        return;
      }

      // Update message in cache
      const updatedEdges = [...existingData.messages.edges];
      updatedEdges[messageIndex] = {
        ...updatedEdges[messageIndex],
        node: updatedMessage,
      };

      client.writeQuery({
        query: GET_MESSAGES,
        data: {
          messages: {
            ...existingData.messages,
            edges: updatedEdges,
          },
        },
      });

      // Call callback if provided
      onMessageUpdated?.(updatedMessage);
    } catch (error) {
      console.error("Error handling updated message:", error);
    }
  };

  return {
    newMessageData: newMessageData?.messageAdded,
    updatedMessageData: updatedMessageData?.messageUpdated,
  };
};
