import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";

import { GET_MESSAGES } from "../../../api";
import { useMessages } from "../useMessages";

// Type definitions for testing (copied from generated types)
export enum MessageStatus {
  Read = "Read",
  Sending = "Sending",
  Sent = "Sent",
}

export enum MessageSender {
  Admin = "Admin",
  Customer = "Customer",
}

export type Message = {
  __typename?: "Message";
  id: string;
  status: MessageStatus;
  text: string;
  updatedAt: string;
  sender: MessageSender;
};

// Mock message data
const createMockMessage = (
  id: string,
  text: string,
  status: MessageStatus = MessageStatus.Sent,
  sender: MessageSender = MessageSender.Customer,
  updatedAt: string = new Date().toISOString()
): Message => ({
  __typename: "Message",
  id,
  text,
  status,
  sender,
  updatedAt,
});

// Test wrapper component
const createWrapper = (mocks: ReadonlyArray<MockedResponse>) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks} addTypename={false}>
      {children}
    </MockedProvider>
  );
  return Wrapper;
};

describe("useMessages", () => {
  const mockMessage1 = createMockMessage("1", "First message");
  const mockMessage2 = createMockMessage("2", "Second message");

  it("should fetch messages successfully", async () => {
    const mocks = [
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 20, after: undefined },
        },
        result: {
          data: {
            messages: {
              edges: [
                { node: mockMessage1, cursor: "cursor1" },
                { node: mockMessage2, cursor: "cursor2" },
              ],
              pageInfo: {
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: "cursor1",
                endCursor: "cursor2",
              },
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        id: mockMessage1.id,
        text: mockMessage1.text,
        status: mockMessage1.status,
        sender: mockMessage1.sender,
        updatedAt: mockMessage1.updatedAt,
      })
    );
    expect(result.current.messages[1]).toEqual(
      expect.objectContaining({
        id: mockMessage2.id,
        text: mockMessage2.text,
        status: mockMessage2.status,
        sender: mockMessage2.sender,
        updatedAt: mockMessage2.updatedAt,
      })
    );
    expect(result.current.error).toBeUndefined();
  });

  it("should handle loading state", () => {
    const mocks: MockedResponse[] = [];

    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper(mocks),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it("should handle fetchMore when no next page", async () => {
    const mockMessage = createMockMessage("1", "Test message");

    const mocks = [
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 20, after: undefined },
        },
        result: {
          data: {
            messages: {
              edges: [{ node: mockMessage, cursor: "cursor_1" }],
              pageInfo: {
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: "cursor_1",
                endCursor: "cursor_1",
              },
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Try to fetch more when there's no next page
    await result.current.fetchMore();

    // Should not trigger any additional requests
    expect(result.current.hasNextPage).toBe(false);
  });

  it("should handle fetchMore when no endCursor", async () => {
    const mockMessage = createMockMessage("1", "Test message");

    const mocks = [
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 20, after: undefined },
        },
        result: {
          data: {
            messages: {
              edges: [{ node: mockMessage, cursor: "cursor_1" }],
              pageInfo: {
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: "cursor_1",
                endCursor: null, // No endCursor
              },
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Try to fetch more when there's no endCursor
    await result.current.fetchMore();

    // Should not trigger any additional requests
    expect(result.current.hasNextPage).toBe(true);
  });

  it("should handle fetchMore error", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const mockMessage = createMockMessage("1", "Test message");

    const mocks = [
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 20, after: undefined },
        },
        result: {
          data: {
            messages: {
              edges: [{ node: mockMessage, cursor: "cursor_1" }],
              pageInfo: {
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: "cursor_1",
                endCursor: "cursor_1",
              },
            },
          },
        },
      },
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 20, after: "cursor_1" },
        },
        error: new Error("Fetch more failed"),
      },
    ];

    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.fetchMore();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching more messages:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("should handle refetch error", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const mockMessage = createMockMessage("1", "Test message");

    const mocks = [
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 20, after: undefined },
        },
        result: {
          data: {
            messages: {
              edges: [{ node: mockMessage, cursor: "cursor_1" }],
              pageInfo: {
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: "cursor_1",
                endCursor: "cursor_1",
              },
            },
          },
        },
      },
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 20, after: undefined },
        },
        error: new Error("Refetch failed"),
      },
    ];

    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error refetching messages:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("should handle custom options", async () => {
    const mockMessage = createMockMessage("1", "Test message");

    const mocks = [
      {
        request: {
          query: GET_MESSAGES,
          variables: { first: 10, after: "custom_cursor" },
        },
        result: {
          data: {
            messages: {
              edges: [{ node: mockMessage, cursor: "cursor_1" }],
              pageInfo: {
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: "cursor_1",
                endCursor: "cursor_1",
              },
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useMessages({ first: 10, after: "custom_cursor" }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(
      expect.objectContaining({
        id: mockMessage.id,
        text: mockMessage.text,
      })
    );
  });
});
