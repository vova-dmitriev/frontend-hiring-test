import { useSubscription, useApolloClient } from "@apollo/client";
import { Message } from "@entities/message";

import {
  MESSAGE_ADDED_SUBSCRIPTION,
  MESSAGE_UPDATED_SUBSCRIPTION,
} from "../../api";
import { upsertMessageInCache } from "../cache-utils";

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
      upsertMessageInCache(client.cache, newMessage);
      onMessageAdded?.(newMessage);
    } catch (error) {
      console.error("Error handling new message:", error);
    }
  };

  const handleUpdatedMessage = (updatedMessage: Message) => {
    try {
      upsertMessageInCache(client.cache, updatedMessage);
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
