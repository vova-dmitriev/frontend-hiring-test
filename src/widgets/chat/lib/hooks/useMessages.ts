import { useQuery } from "@apollo/client";
import { Message, MessageEdge, MessagePage } from "@entities/message";

import { GET_MESSAGES } from "../../api";

export interface UseMessagesOptions {
  first?: number;
  after?: string;
}

export interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | undefined;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 20;

export const useMessages = (
  options: UseMessagesOptions = {}
): UseMessagesReturn => {
  const { first = DEFAULT_PAGE_SIZE, after } = options;

  const { data, loading, error, fetchMore, refetch } = useQuery<{
    messages: MessagePage;
  }>(GET_MESSAGES, {
    variables: { first, after },
    errorPolicy: "all", // Show partial data even on errors
    notifyOnNetworkStatusChange: true, // Update loading state on fetchMore
  });

  // Extract messages from edges
  const messages =
    data?.messages?.edges?.map((edge: MessageEdge) => edge.node) || [];
  const pageInfo = data?.messages?.pageInfo;

  const handleFetchMore = async () => {
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) {
      return;
    }

    try {
      await fetchMore({
        variables: {
          first: DEFAULT_PAGE_SIZE,
          after: pageInfo.endCursor,
        },
      });
    } catch (fetchMoreError) {
      console.error("Error fetching more messages:", fetchMoreError);
    }
  };

  const handleRefetch = async () => {
    try {
      await refetch();
    } catch (refetchError) {
      console.error("Error refetching messages:", refetchError);
    }
  };

  return {
    messages,
    loading,
    error,
    hasNextPage: pageInfo?.hasNextPage || false,
    hasPreviousPage: pageInfo?.hasPreviousPage || false,
    fetchMore: handleFetchMore,
    refetch: handleRefetch,
  };
};
