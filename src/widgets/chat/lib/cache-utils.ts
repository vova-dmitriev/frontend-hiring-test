import { ApolloCache } from "@apollo/client";

import { Message } from "../../../entities/message";
import { GET_MESSAGES } from "../api";

type MessagesQueryShape = {
  messages: {
    edges: Array<{ node: Message; cursor: string }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null;
      endCursor?: string | null;
    };
  };
};

export const upsertMessageInCache = (
  cache: ApolloCache<unknown>,
  message: Message
) => {
  const existingData = cache.readQuery<MessagesQueryShape>({
    query: GET_MESSAGES,
  });
  if (!existingData) return;

  const edges = existingData.messages.edges;
  const index = edges.findIndex((e) => e.node.id === message.id);

  let newEdges: MessagesQueryShape["messages"]["edges"];
  if (index === -1) {
    const newEdge = {
      node: message,
      cursor: `cursor_${message.id}`,
      __typename: "MessageEdge" as const,
    };
    newEdges = [...edges, newEdge];
  } else {
    const existing = edges[index].node;
    const existingUpdatedAt = new Date(existing.updatedAt);
    const incomingUpdatedAt = new Date(message.updatedAt);
    if (incomingUpdatedAt < existingUpdatedAt) {
      return; // ignore stale
    }
    newEdges = [...edges];
    newEdges[index] = { ...newEdges[index], node: message };
  }

  cache.writeQuery<MessagesQueryShape>({
    query: GET_MESSAGES,
    data: {
      messages: {
        ...existingData.messages,
        edges: newEdges,
      },
    },
  });
};

export const removeTempMessagesByText = (
  cache: ApolloCache<unknown>,
  text: string
) => {
  const existingData = cache.readQuery<MessagesQueryShape>({
    query: GET_MESSAGES,
  });
  if (!existingData) return;

  const filteredEdges = existingData.messages.edges.filter((edge) => {
    const isTemp = String(edge.node.id).startsWith("temp-");
    return !(isTemp && edge.node.text === text);
  });

  if (filteredEdges.length === existingData.messages.edges.length) return;

  cache.writeQuery<MessagesQueryShape>({
    query: GET_MESSAGES,
    data: {
      messages: {
        ...existingData.messages,
        edges: filteredEdges,
      },
    },
  });
};
