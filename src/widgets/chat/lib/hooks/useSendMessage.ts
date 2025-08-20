import { useMutation } from "@apollo/client";
import { Message, MessageStatus, MessageSender } from "@entities/message";
import { v4 as uuidv4 } from "uuid";

import { SEND_MESSAGE, GET_MESSAGES } from "../../api";

export interface UseSendMessageReturn {
  sendMessage: (text: string) => Promise<Message | null>;
  loading: boolean;
  error: Error | undefined;
}

export const useSendMessage = (): UseSendMessageReturn => {
  const [sendMessageMutation, { loading, error }] = useMutation<
    { sendMessage: Message },
    { text: string }
  >(SEND_MESSAGE, {
    errorPolicy: "all",
    // Optimistic update
    optimisticResponse: (variables) => ({
      sendMessage: {
        __typename: "Message",
        id: `temp-${uuidv4()}`,
        text: variables.text,
        status: MessageStatus.Sending,
        updatedAt: new Date().toISOString(),
        sender: MessageSender.Admin, // Server always returns Admin, but we'll handle this in UI
      },
    }),
    // Update cache after successful mutation
    update: (cache, { data }) => {
      if (!data?.sendMessage) return;

      // Read current messages from cache
      const existingData = cache.readQuery<{
        messages: {
          edges: Array<{ node: Message; cursor: string }>;
          pageInfo: {
            hasNextPage: boolean;
            hasPreviousPage: boolean;
            startCursor?: string;
            endCursor?: string;
          };
        };
      }>({
        query: GET_MESSAGES,
      });

      if (!existingData) return;

      // Check if this message already exists in cache (might be added via subscription)
      const finalEdges = (() => {
        // Remove matching temp optimistic messages (same text, temp- id)
        const edgesWithoutTemps = existingData.messages.edges.filter((edge) => {
          const isTemp = String(edge.node.id).startsWith("temp-");
          const sameText = edge.node.text === data.sendMessage.text;
          return !(isTemp && sameText);
        });

        // If the server message is not present, append it
        const existsNow = edgesWithoutTemps.some(
          (edge) => edge.node.id === data.sendMessage.id
        );

        if (!existsNow) {
          const newEdge = {
            node: data.sendMessage,
            cursor: `cursor_${data.sendMessage.id}`,
            __typename: "MessageEdge" as const,
          };
          return [...edgesWithoutTemps, newEdge];
        }

        // Otherwise update by id if fresher
        return edgesWithoutTemps.map((edge) => {
          if (edge.node.id === data.sendMessage.id) {
            const existingUpdatedAt = new Date(edge.node.updatedAt);
            const incomingUpdatedAt = new Date(data.sendMessage.updatedAt);
            if (incomingUpdatedAt >= existingUpdatedAt) {
              return { ...edge, node: data.sendMessage };
            }
          }
          return edge;
        });
      })();

      cache.writeQuery({
        query: GET_MESSAGES,
        data: {
          messages: {
            ...existingData.messages,
            edges: finalEdges,
          },
        },
      });
    },
  });

  const sendMessage = async (text: string): Promise<Message | null> => {
    if (!text.trim()) {
      return null;
    }

    try {
      const result = await sendMessageMutation({
        variables: { text: text.trim() },
      });

      return result.data?.sendMessage || null;
    } catch (mutationError) {
      console.error("Error sending message:", mutationError);
      return null;
    }
  };

  return {
    sendMessage,
    loading,
    error,
  };
};
