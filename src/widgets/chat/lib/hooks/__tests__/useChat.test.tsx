import { Message, MessageSender, MessageStatus } from "@entities/message";
import { renderHook, act } from "@testing-library/react";

import { useChat } from "../useChat";
import * as useMessagesModule from "../useMessages";
import * as useMessageSubscriptionsModule from "../useMessageSubscriptions";
import * as useSendMessageModule from "../useSendMessage";

// Mock the individual hooks
jest.mock("../useMessages");
jest.mock("../useMessageSubscriptions");
jest.mock("../useSendMessage");

const mockUseMessages = useMessagesModule.useMessages as jest.MockedFunction<
  typeof useMessagesModule.useMessages
>;
const mockUseMessageSubscriptions =
  useMessageSubscriptionsModule.useMessageSubscriptions as jest.MockedFunction<
    typeof useMessageSubscriptionsModule.useMessageSubscriptions
  >;
const mockUseSendMessage =
  useSendMessageModule.useSendMessage as jest.MockedFunction<
    typeof useSendMessageModule.useSendMessage
  >;

// Mock message data
const createMockMessage = (
  id: string,
  text: string,
  sender: MessageSender = MessageSender.Customer,
  status: MessageStatus = MessageStatus.Sent
): Message => ({
  __typename: "Message",
  id,
  text,
  status,
  updatedAt: new Date().toISOString(),
  sender,
});

describe("useChat", () => {
  const mockMessages = [
    createMockMessage("1", "Message 1"),
    createMockMessage("2", "Message 2"),
  ];

  const defaultUseMessagesReturn = {
    messages: mockMessages,
    loading: false,
    error: undefined,
    hasNextPage: false,
    hasPreviousPage: false,
    fetchMore: jest.fn(),
    refetch: jest.fn(),
  };

  const defaultUseSendMessageReturn = {
    sendMessage: jest.fn(),
    loading: false,
    error: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMessages.mockReturnValue(defaultUseMessagesReturn);
    mockUseSendMessage.mockReturnValue(defaultUseSendMessageReturn);
    mockUseMessageSubscriptions.mockReturnValue({
      newMessageData: undefined,
      updatedMessageData: undefined,
    });
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual(mockMessages);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.inputValue).toBe("");
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isAtBottom).toBe(true);
    expect(result.current.newMessagesCount).toBe(0);
    expect(result.current.sendingMessage).toBe(false);
    expect(result.current.sendError).toBeUndefined();
  });

  it("should handle input value changes", () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setInputValue("Hello, world!");
    });

    expect(result.current.inputValue).toBe("Hello, world!");
  });

  it("should handle form submission successfully", async () => {
    const mockSendMessage = jest.fn().mockResolvedValue(undefined);
    mockUseSendMessage.mockReturnValue({
      ...defaultUseSendMessageReturn,
      sendMessage: mockSendMessage,
    });

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setInputValue("Test message");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockSendMessage).toHaveBeenCalledWith("Test message");
    expect(result.current.inputValue).toBe(""); // Input should be cleared
  });

  it("should not submit empty or whitespace-only messages", async () => {
    const mockSendMessage = jest.fn();
    mockUseSendMessage.mockReturnValue({
      ...defaultUseSendMessageReturn,
      sendMessage: mockSendMessage,
    });

    const { result } = renderHook(() => useChat());

    // Test empty string
    act(() => {
      result.current.setInputValue("");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockSendMessage).not.toHaveBeenCalled();

    // Test whitespace only
    act(() => {
      result.current.setInputValue("   ");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should not submit when already sending", async () => {
    const mockSendMessage = jest.fn();
    mockUseSendMessage.mockReturnValue({
      ...defaultUseSendMessageReturn,
      sendMessage: mockSendMessage,
      loading: true, // Currently sending
    });

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setInputValue("Test message");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should handle sendMessage directly", async () => {
    const mockSendMessage = jest.fn().mockResolvedValue(undefined);
    mockUseSendMessage.mockReturnValue({
      ...defaultUseSendMessageReturn,
      sendMessage: mockSendMessage,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Direct message");
    });

    expect(mockSendMessage).toHaveBeenCalledWith("Direct message");
  });

  it("should handle sendMessage errors and set connection state", async () => {
    const mockSendMessage = jest
      .fn()
      .mockRejectedValue(new Error("Send failed"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockUseSendMessage.mockReturnValue({
      ...defaultUseSendMessageReturn,
      sendMessage: mockSendMessage,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Failed message");
    });

    expect(result.current.isConnected).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error sending message:",
      expect.any(Error)
    );

    // Should attempt to reconnect after timeout
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.isConnected).toBe(true);

    consoleSpy.mockRestore();
  });

  it("should handle loadMore successfully", async () => {
    const mockFetchMore = jest.fn().mockResolvedValue(undefined);
    mockUseMessages.mockReturnValue({
      ...defaultUseMessagesReturn,
      fetchMore: mockFetchMore,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchMore).toHaveBeenCalled();
  });

  it("should handle loadMore errors and set connection state", async () => {
    const mockFetchMore = jest
      .fn()
      .mockRejectedValue(new Error("Fetch failed"));
    const mockRefetch = jest.fn();
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockUseMessages.mockReturnValue({
      ...defaultUseMessagesReturn,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.isConnected).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error loading more messages:",
      expect.any(Error)
    );

    // Should attempt to reconnect and refetch after timeout
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.isConnected).toBe(true);
    expect(mockRefetch).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should handle new message notifications when not at bottom", () => {
    let onMessageAddedCallback: ((message: Message) => void) | undefined;

    mockUseMessageSubscriptions.mockImplementation((options) => {
      onMessageAddedCallback = options?.onMessageAdded;
      return {
        newMessageData: undefined,
        updatedMessageData: undefined,
      };
    });

    const { result } = renderHook(() => useChat());

    // Set user not at bottom
    act(() => {
      result.current.setIsAtBottom(false);
    });

    expect(result.current.isAtBottom).toBe(false);

    // Simulate new message from another user
    const newMessage = createMockMessage(
      "3",
      "New message",
      MessageSender.Customer
    );

    act(() => {
      onMessageAddedCallback?.(newMessage);
    });

    expect(result.current.newMessagesCount).toBe(1);
  });

  it("should not increment notifications for admin messages", () => {
    let onMessageAddedCallback: ((message: Message) => void) | undefined;

    mockUseMessageSubscriptions.mockImplementation((options) => {
      onMessageAddedCallback = options?.onMessageAdded;
      return {
        newMessageData: undefined,
        updatedMessageData: undefined,
      };
    });

    const { result } = renderHook(() => useChat());

    // Set user not at bottom
    act(() => {
      result.current.setIsAtBottom(false);
    });

    // Simulate new message from admin
    const adminMessage = createMockMessage(
      "3",
      "Admin message",
      MessageSender.Admin
    );

    act(() => {
      onMessageAddedCallback?.(adminMessage);
    });

    expect(result.current.newMessagesCount).toBe(0);
  });

  it("should reset notifications when reaching bottom", () => {
    let onMessageAddedCallback: ((message: Message) => void) | undefined;

    mockUseMessageSubscriptions.mockImplementation((options) => {
      onMessageAddedCallback = options?.onMessageAdded;
      return {
        newMessageData: undefined,
        updatedMessageData: undefined,
      };
    });

    const { result } = renderHook(() => useChat());

    // Set user not at bottom
    act(() => {
      result.current.setIsAtBottom(false);
    });

    // Simulate new message to increment count
    const newMessage = createMockMessage(
      "3",
      "New message",
      MessageSender.Customer
    );
    act(() => {
      onMessageAddedCallback?.(newMessage);
    });

    expect(result.current.newMessagesCount).toBe(1);

    // When user scrolls to bottom with existing notifications, they should reset
    act(() => {
      result.current.setIsAtBottom(true);
    });

    expect(result.current.isAtBottom).toBe(true);
    expect(result.current.newMessagesCount).toBe(0); // Should be reset
  });

  it("should handle resetNewMessages", () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.resetNewMessages();
    });

    expect(result.current.newMessagesCount).toBe(0);
  });

  it("should handle message updates through subscription", () => {
    let onMessageUpdatedCallback: ((message: Message) => void) | undefined;
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    mockUseMessageSubscriptions.mockImplementation((options) => {
      onMessageUpdatedCallback = options?.onMessageUpdated;
      return {
        newMessageData: undefined,
        updatedMessageData: undefined,
      };
    });

    renderHook(() => useChat());

    // Simulate message update
    const updatedMessage = createMockMessage(
      "1",
      "Updated message",
      MessageSender.Customer,
      MessageStatus.Read
    );

    act(() => {
      onMessageUpdatedCallback?.(updatedMessage);
    });

    expect(consoleSpy).toHaveBeenCalledWith("Message updated:", updatedMessage);

    consoleSpy.mockRestore();
  });

  it("should properly forward all hook return values", () => {
    const customMessagesReturn = {
      messages: [],
      loading: true,
      error: new Error("Test error"),
      hasNextPage: true,
      hasPreviousPage: true,
      fetchMore: jest.fn(),
      refetch: jest.fn(),
    };

    const customSendMessageReturn = {
      sendMessage: jest.fn(),
      loading: true,
      error: new Error("Send error"),
    };

    mockUseMessages.mockReturnValue(customMessagesReturn);
    mockUseSendMessage.mockReturnValue(customSendMessageReturn);

    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toEqual(new Error("Test error"));
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPreviousPage).toBe(true);
    expect(result.current.sendingMessage).toBe(true);
    expect(result.current.sendError).toEqual(new Error("Send error"));
  });

  it("should handle trimmed text in sendMessage", async () => {
    const mockSendMessage = jest.fn().mockResolvedValue(undefined);
    mockUseSendMessage.mockReturnValue({
      ...defaultUseSendMessageReturn,
      sendMessage: mockSendMessage,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("  trimmed text  ");
    });

    expect(mockSendMessage).toHaveBeenCalledWith("trimmed text");
  });

  it("should not send empty trimmed text", async () => {
    const mockSendMessage = jest.fn().mockResolvedValue(undefined);
    mockUseSendMessage.mockReturnValue({
      ...defaultUseSendMessageReturn,
      sendMessage: mockSendMessage,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

// Setup and teardown for timer mocks
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
