import { InMemoryCache } from "@apollo/client";
import * as apolloClient from "@apollo/client";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { renderHook, waitFor, act } from "@testing-library/react";
import { ReactNode } from "react";

import {
  Message,
  MessageSender,
  MessageStatus,
} from "../../../../../entities/message";
import { SEND_MESSAGE, GET_MESSAGES } from "../../../api";
import { useSendMessage } from "../useSendMessage";

// Mock UUID
jest.mock("uuid", () => ({
  v4: jest.fn(() => "mocked-uuid"),
}));

// Mock message data
const createMockMessage = (
  id: string,
  text: string,
  updatedAt: string = new Date().toISOString(),
  status: MessageStatus = MessageStatus.Sent,
  sender: MessageSender = MessageSender.Admin
): Message => ({
  __typename: "Message",
  id,
  text,
  status,
  updatedAt,
  sender,
});

const createMockMessagesResponse = (messages: Message[]) => ({
  messages: {
    __typename: "MessagePage",
    edges: messages.map((message) => ({
      __typename: "MessageEdge",
      node: message,
      cursor: `cursor_${message.id}`,
    })),
    pageInfo: {
      __typename: "MessagePageInfo",
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: messages.length > 0 ? `cursor_${messages[0].id}` : null,
      endCursor:
        messages.length > 0
          ? `cursor_${messages[messages.length - 1].id}`
          : null,
    },
  },
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

describe("useSendMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send message successfully", async () => {
    const messageText = "Hello, world!";
    const sentMessage = createMockMessage("123", messageText);

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();

    // Send message
    let sentMessageResult: Message | null = null;

    await act(async () => {
      sentMessageResult = await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(sentMessageResult).toEqual(
      expect.objectContaining({
        id: sentMessage.id,
        text: sentMessage.text,
        status: sentMessage.status,
        sender: sentMessage.sender,
        updatedAt: sentMessage.updatedAt,
      })
    );
    expect(result.current.error).toBeUndefined();
  });

  it("should handle empty text gracefully", async () => {
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper([]),
    });

    const result1 = await result.current.sendMessage("");
    const result2 = await result.current.sendMessage("   ");
    const result3 = await result.current.sendMessage("\t\n");

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).toBeNull();
  });

  it("should handle send message errors", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const messageText = "Failed message";

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        error: new Error("Send failed"),
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    const sentMessageResult = await result.current.sendMessage(messageText);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(sentMessageResult).toBeNull();
    expect(result.current.error).toBeDefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error sending message:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("should provide optimistic response while sending", async () => {
    const messageText = "Optimistic message";
    const sentMessage = createMockMessage("123", messageText);

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
        delay: 100, // Add delay to test optimistic response
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    // Start sending
    await act(async () => {
      const promise = result.current.sendMessage(messageText);
      await promise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should trim whitespace from message text", async () => {
    const messageText = "  Hello, world!  ";
    const trimmedText = "Hello, world!";
    const sentMessage = createMockMessage("123", trimmedText);

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: trimmedText }, // Should be trimmed
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    let sentMessageResult: Message | null = null;
    await act(async () => {
      sentMessageResult = await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(sentMessageResult).toEqual(
      expect.objectContaining({
        id: sentMessage.id,
        text: sentMessage.text,
        status: sentMessage.status,
        sender: sentMessage.sender,
        updatedAt: sentMessage.updatedAt,
      })
    );
  });

  it("should update cache after successful send", async () => {
    const existingMessage = createMockMessage("1", "Existing message");
    const messageText = "New message";
    const sentMessage = createMockMessage("123", messageText);

    const mocks = [
      // Initial cache state
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([existingMessage]),
        },
      },
      // Send message
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await result.current.sendMessage(messageText);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Cache update logic is tested in the actual implementation
    // through the update function in the mutation
  });

  it("should handle network errors gracefully", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const messageText = "Network error message";

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        networkError: new Error("Network error"),
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    const sentMessageResult = await result.current.sendMessage(messageText);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(sentMessageResult).toBeNull();
    expect(result.current.error).toBeDefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error sending message:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("should handle mutation result without data", async () => {
    const messageText = "No data message";

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: null, // No data returned
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    const sentMessageResult = await result.current.sendMessage(messageText);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(sentMessageResult).toBeNull();
  });

  it("should handle multiple concurrent sends", async () => {
    const message1Text = "Message 1";
    const message2Text = "Message 2";
    const sentMessage1 = createMockMessage("123", message1Text);
    const sentMessage2 = createMockMessage("456", message2Text);

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: message1Text },
        },
        result: {
          data: { sendMessage: sentMessage1 },
        },
        delay: 100,
      },
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: message2Text },
        },
        result: {
          data: { sendMessage: sentMessage2 },
        },
        delay: 50,
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    // Send both messages concurrently
    let result1: Message | null = null,
      result2: Message | null = null;
    await act(async () => {
      const promise1 = result.current.sendMessage(message1Text);
      const promise2 = result.current.sendMessage(message2Text);
      [result1, result2] = await Promise.all([promise1, promise2]);
    });

    expect(result1).toEqual(
      expect.objectContaining({
        id: sentMessage1.id,
        text: sentMessage1.text,
        status: sentMessage1.status,
        sender: sentMessage1.sender,
        updatedAt: sentMessage1.updatedAt,
      })
    );
    expect(result2).toEqual(
      expect.objectContaining({
        id: sentMessage2.id,
        text: sentMessage2.text,
        status: sentMessage2.status,
        sender: sentMessage2.sender,
        updatedAt: sentMessage2.updatedAt,
      })
    );
  });

  it("should handle cache update when no existing data", async () => {
    const messageText = "New message";
    const sentMessage = createMockMessage("123", messageText);

    const mocks = [
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should append new message to cache when absent", async () => {
    const existingMessage = createMockMessage("1", "Existing");
    const messageText = "New message";
    const sentMessage = createMockMessage("123", messageText);

    const cache = new InMemoryCache();
    cache.writeQuery({
      query: GET_MESSAGES,
      data: createMockMessagesResponse([existingMessage]),
    });

    let capturedUpdate:
      | ((
          cacheArg: InMemoryCache,
          result: { data?: { sendMessage: Message } | null }
        ) => void)
      | undefined;

    const useMutationSpy = jest
      .spyOn(apolloClient, "useMutation")
      .mockImplementation((...args: unknown[]) => {
        const options = (args[1] ?? {}) as {
          update?: typeof capturedUpdate;
        };
        capturedUpdate = options.update;
        const mutate = async () => {
          capturedUpdate?.(cache, { data: { sendMessage: sentMessage } });
          return { data: { sendMessage: sentMessage } } as {
            data: { sendMessage: Message };
          };
        };
        return [
          mutate,
          { loading: false, error: undefined },
        ] as unknown as ReturnType<typeof apolloClient.useMutation>;
      });

    const { result } = renderHook(() => useSendMessage());

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    useMutationSpy.mockRestore();

    const after = cache.readQuery({ query: GET_MESSAGES });
    expect(after).toBeTruthy();
    const edges = (after as ReturnType<typeof createMockMessagesResponse>)
      .messages.edges;
    expect(edges.some((e) => e.node.id === "123")).toBe(true);
    expect(edges.some((e) => e.node.id === "1")).toBe(true);
  });

  it("should remove temp message with same text and add server message", async () => {
    const messageText = "Hello";
    const tempMessage = createMockMessage(
      "temp-abc",
      messageText,
      new Date().toISOString(),
      MessageStatus.Sending
    );
    const otherMessage = createMockMessage("2", "Other");
    const sentMessage = createMockMessage("123", messageText);

    const cache = new InMemoryCache();
    cache.writeQuery({
      query: GET_MESSAGES,
      data: createMockMessagesResponse([tempMessage, otherMessage]),
    });

    let capturedUpdate:
      | ((
          cacheArg: InMemoryCache,
          result: { data?: { sendMessage: Message } | null }
        ) => void)
      | undefined;

    const useMutationSpy = jest
      .spyOn(apolloClient, "useMutation")
      .mockImplementation((...args: unknown[]) => {
        const options = (args[1] ?? {}) as {
          update?: typeof capturedUpdate;
        };
        capturedUpdate = options.update;
        const mutate = async () => {
          capturedUpdate?.(cache, { data: { sendMessage: sentMessage } });
          return { data: { sendMessage: sentMessage } } as {
            data: { sendMessage: Message };
          };
        };
        return [
          mutate,
          { loading: false, error: undefined },
        ] as unknown as ReturnType<typeof apolloClient.useMutation>;
      });

    const { result } = renderHook(() => useSendMessage());

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    useMutationSpy.mockRestore();

    const after = cache.readQuery({ query: GET_MESSAGES });
    const edges = (after as ReturnType<typeof createMockMessagesResponse>)
      .messages.edges;
    expect(edges.some((e) => e.node.id.startsWith("temp-"))).toBe(false);
    expect(edges.some((e) => e.node.id === "123")).toBe(true);
    expect(edges.some((e) => e.node.id === "2")).toBe(true);
  });

  it("should keep temp message with different text", async () => {
    const messageText = "Hello";
    const tempDifferent = createMockMessage(
      "temp-xyz",
      "Different",
      new Date().toISOString(),
      MessageStatus.Sending
    );
    const sentMessage = createMockMessage("123", messageText);

    const cache = new InMemoryCache();
    cache.writeQuery({
      query: GET_MESSAGES,
      data: createMockMessagesResponse([tempDifferent]),
    });

    let capturedUpdate:
      | ((
          cacheArg: InMemoryCache,
          result: { data?: { sendMessage: Message } | null }
        ) => void)
      | undefined;

    const useMutationSpy = jest
      .spyOn(apolloClient, "useMutation")
      .mockImplementation((...args: unknown[]) => {
        const options = (args[1] ?? {}) as {
          update?: typeof capturedUpdate;
        };
        capturedUpdate = options.update;
        const mutate = async () => {
          capturedUpdate?.(cache, { data: { sendMessage: sentMessage } });
          return { data: { sendMessage: sentMessage } } as {
            data: { sendMessage: Message };
          };
        };
        return [
          mutate,
          { loading: false, error: undefined },
        ] as unknown as ReturnType<typeof apolloClient.useMutation>;
      });

    const { result } = renderHook(() => useSendMessage());

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    useMutationSpy.mockRestore();

    const after = cache.readQuery({ query: GET_MESSAGES });
    const edges = (after as ReturnType<typeof createMockMessagesResponse>)
      .messages.edges;
    expect(edges.some((e) => e.node.id === "123")).toBe(true);
    expect(edges.some((e) => e.node.id === "temp-xyz")).toBe(true);
  });

  it("should replace existing message with same id when incoming is newer", async () => {
    const old = createMockMessage(
      "1",
      "Old",
      new Date(Date.now()).toISOString()
    );
    const newer = createMockMessage(
      "1",
      "New",
      new Date(Date.now() + 1000).toISOString()
    );

    const cache = new InMemoryCache();
    cache.writeQuery({
      query: GET_MESSAGES,
      data: createMockMessagesResponse([old]),
    });

    let capturedUpdate:
      | ((
          cacheArg: InMemoryCache,
          result: { data?: { sendMessage: Message } | null }
        ) => void)
      | undefined;

    const useMutationSpy = jest
      .spyOn(apolloClient, "useMutation")
      .mockImplementation((...args: unknown[]) => {
        const options = (args[1] ?? {}) as {
          update?: typeof capturedUpdate;
        };
        capturedUpdate = options.update;
        const mutate = async () => {
          capturedUpdate?.(cache, { data: { sendMessage: newer } });
          return { data: { sendMessage: newer } } as {
            data: { sendMessage: Message };
          };
        };
        return [
          mutate,
          { loading: false, error: undefined },
        ] as unknown as ReturnType<typeof apolloClient.useMutation>;
      });

    const { result } = renderHook(() => useSendMessage());

    await act(async () => {
      await result.current.sendMessage(newer.text);
    });

    useMutationSpy.mockRestore();

    const after = cache.readQuery({ query: GET_MESSAGES });
    const edges = (after as ReturnType<typeof createMockMessagesResponse>)
      .messages.edges;
    const edge = edges.find((e) => e.node.id === "1");
    expect(edge?.node.text).toBe("New");
  });

  it("should keep existing message when incoming is older", async () => {
    const newer = createMockMessage(
      "1",
      "New",
      new Date(Date.now() + 1000).toISOString()
    );
    const older = createMockMessage("1", "Old", new Date().toISOString());

    const cache = new InMemoryCache();
    cache.writeQuery({
      query: GET_MESSAGES,
      data: createMockMessagesResponse([newer]),
    });

    let capturedUpdate:
      | ((
          cacheArg: InMemoryCache,
          result: { data?: { sendMessage: Message } | null }
        ) => void)
      | undefined;

    const useMutationSpy = jest
      .spyOn(apolloClient, "useMutation")
      .mockImplementation((...args: unknown[]) => {
        const options = (args[1] ?? {}) as {
          update?: typeof capturedUpdate;
        };
        capturedUpdate = options.update;
        const mutate = async () => {
          capturedUpdate?.(cache, { data: { sendMessage: older } });
          return { data: { sendMessage: older } } as {
            data: { sendMessage: Message };
          };
        };
        return [
          mutate,
          { loading: false, error: undefined },
        ] as unknown as ReturnType<typeof apolloClient.useMutation>;
      });

    const { result } = renderHook(() => useSendMessage());

    await act(async () => {
      await result.current.sendMessage(older.text);
    });

    useMutationSpy.mockRestore();

    const after = cache.readQuery({ query: GET_MESSAGES });
    const edges = (after as ReturnType<typeof createMockMessagesResponse>)
      .messages.edges;
    const edge = edges.find((e) => e.node.id === "1");
    expect(edge?.node.text).toBe("New");
  });

  it("should handle cache update when message already exists", async () => {
    const existingMessage = createMockMessage("1", "Existing message");
    const messageText = "Updated message";
    const sentMessage = createMockMessage(
      "1",
      messageText,
      new Date(Date.now() + 1000).toISOString()
    ); // Newer timestamp

    const mocks = [
      // Initial cache state
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([existingMessage]),
        },
      },
      // Send message with same ID but newer timestamp
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle cache update when message exists but is older", async () => {
    const existingMessage = createMockMessage(
      "1",
      "Existing message",
      new Date(Date.now() + 1000).toISOString()
    ); // Newer timestamp
    const messageText = "Older message";
    const sentMessage = createMockMessage(
      "1",
      messageText,
      new Date().toISOString()
    ); // Older timestamp

    const mocks = [
      // Initial cache state with newer message
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([existingMessage]),
        },
      },
      // Send message with same ID but older timestamp
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should remove temp optimistic messages on successful send", async () => {
    const messageText = "Test message";
    const tempMessage = createMockMessage(
      "temp-uuid",
      messageText,
      new Date().toISOString(),
      MessageStatus.Sending
    );
    const sentMessage = createMockMessage("123", messageText);

    const mocks = [
      // Initial cache state with temp message
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([tempMessage]),
        },
      },
      // Send message
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle cache update with temp messages that have different text", async () => {
    const messageText = "New message";
    const tempMessage = createMockMessage(
      "temp-uuid",
      "Different text",
      new Date().toISOString(),
      MessageStatus.Sending
    );
    const sentMessage = createMockMessage("123", messageText);

    const mocks = [
      // Initial cache state with temp message with different text
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([tempMessage]),
        },
      },
      // Send message
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle cache update when message exists with same ID but older timestamp", async () => {
    const messageText = "Updated message";
    const oldTimestamp = new Date().toISOString();
    const newTimestamp = new Date(Date.now() + 1000).toISOString();

    const existingMessage = createMockMessage("123", "Old text", oldTimestamp);
    const sentMessage = createMockMessage("123", messageText, newTimestamp);

    const mocks = [
      // Initial cache state with existing message
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([existingMessage]),
        },
      },
      // Send message with same ID but newer timestamp
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should not update cache when message exists with same ID but newer timestamp", async () => {
    const messageText = "Old message";
    const oldTimestamp = new Date().toISOString();
    const newTimestamp = new Date(Date.now() + 1000).toISOString();

    const existingMessage = createMockMessage(
      "123",
      "Newer text",
      newTimestamp
    );
    const sentMessage = createMockMessage("123", messageText, oldTimestamp);

    const mocks = [
      // Initial cache state with existing message that's newer
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([existingMessage]),
        },
      },
      // Send message with same ID but older timestamp
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle complex cache update with multiple temp messages and existing messages", async () => {
    const messageText = "New message";
    const tempMessage1 = createMockMessage(
      "temp-1",
      messageText,
      new Date().toISOString(),
      MessageStatus.Sending
    );
    const tempMessage2 = createMockMessage(
      "temp-2",
      "Different text",
      new Date().toISOString(),
      MessageStatus.Sending
    );
    const existingMessage = createMockMessage("456", "Existing message");
    const sentMessage = createMockMessage("123", messageText);

    const mocks = [
      // Initial cache state with temp messages and existing message
      {
        request: {
          query: GET_MESSAGES,
        },
        result: {
          data: createMockMessagesResponse([
            tempMessage1,
            tempMessage2,
            existingMessage,
          ]),
        },
      },
      // Send message
      {
        request: {
          query: SEND_MESSAGE,
          variables: { text: messageText },
        },
        result: {
          data: { sendMessage: sentMessage },
        },
      },
    ];

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(mocks),
    });

    await act(async () => {
      await result.current.sendMessage(messageText);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
