import { InMemoryCache, FieldPolicy } from "@apollo/client";
import { MessagePage } from "@entities/message";

// Function for merging message pages during pagination
const messagesFieldPolicy: FieldPolicy<MessagePage> = {
  keyArgs: false, // Don't use arguments for cache key
  merge(existing, incoming, { args }) {
    if (!existing) {
      return incoming;
    }

    // If this is loading the next page (has after)
    if (args?.after) {
      return {
        ...incoming,
        edges: [...existing.edges, ...incoming.edges],
        pageInfo: incoming.pageInfo,
      };
    }

    // If this is loading previous messages (has before)
    if (args?.before) {
      return {
        ...incoming,
        edges: [...incoming.edges, ...existing.edges],
        pageInfo: {
          ...incoming.pageInfo,
          hasNextPage: existing.pageInfo.hasNextPage,
          endCursor: existing.pageInfo.endCursor,
        },
      };
    }

    // If this is the first load or full reload
    return incoming;
  },
};

// Create cache with configured policies
export const createCacheWithPolicies = () => {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          messages: messagesFieldPolicy,
        },
      },
    },
  });
};
