import { useApolloClient, useSubscription } from "@apollo/client";
import { renderHook, waitFor } from "@testing-library/react";

import {
  Message,
  MessageSender,
  MessageStatus,
} from "../../../../../entities/message";
import * as cacheUtils from "../../cache-utils";
import { useMessageSubscriptions } from "../useMessageSubscriptions";

// Mock Apollo Client hooks
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useSubscription: jest.fn(),
  useApolloClient: jest.fn(),
}));

// Mock cache utils
jest.mock("../../cache-utils", () => ({
  upsertMessageInCache: jest.fn(),
}));

// Mock message data
const createMockMessage = (
  id: string,
  text: string,
  updatedAt: string = new Date().toISOString(),
  status: MessageStatus = MessageStatus.Sent,
  sender: MessageSender = MessageSender.Customer
): Message => ({
  __typename: "Message",
  id,
  text,
  status,
  updatedAt,
  sender,
});

describe("useMessageSubscriptions", () => {
  const mockUseSubscription = useSubscription as jest.MockedFunction<
    typeof useSubscription
  >;
  const mockUseApolloClient = useApolloClient as jest.MockedFunction<
    typeof useApolloClient
  >;
  const mockUpsertMessageInCache =
    cacheUtils.upsertMessageInCache as jest.MockedFunction<
      typeof cacheUtils.upsertMessageInCache
    >;

  const mockClient = { cache: {} } as ReturnType<typeof useApolloClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApolloClient.mockReturnValue(mockClient);
    mockUpsertMessageInCache.mockImplementation(() => {});
  });

  it("should return new message data from subscription", () => {
    const newMessage = createMockMessage("1", "New message");
    const onMessageAdded = jest.fn();

    // Mock the subscriptions to return data
    mockUseSubscription
      .mockReturnValueOnce({
        data: { messageAdded: newMessage },
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageAdded })
    );

    expect(result.current.newMessageData).toEqual(newMessage);
    expect(result.current.updatedMessageData).toBeUndefined();
  });

  it("should return updated message data from subscription", () => {
    const updatedMessage = createMockMessage(
      "1",
      "Updated message",
      new Date().toISOString(),
      MessageStatus.Read
    );
    const onMessageUpdated = jest.fn();

    // Mock the subscriptions to return data
    mockUseSubscription
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: { messageUpdated: updatedMessage },
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageUpdated })
    );

    expect(result.current.newMessageData).toBeUndefined();
    expect(result.current.updatedMessageData).toEqual(updatedMessage);
  });

  it("should work without callbacks", () => {
    const newMessage = createMockMessage("1", "New message");

    // Mock the subscriptions to return data
    mockUseSubscription
      .mockReturnValueOnce({
        data: { messageAdded: newMessage },
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() => useMessageSubscriptions());

    expect(result.current.newMessageData).toEqual(newMessage);
  });

  it("should handle subscription network errors", () => {
    const onMessageAdded = jest.fn();

    // Mock the subscriptions with error
    mockUseSubscription
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: new Error("Subscription error"),
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageAdded })
    );

    // Even with subscription error, hook should not crash
    expect(result.current.newMessageData).toBeUndefined();
  });

  it("should handle missing subscription data", () => {
    const onMessageAdded = jest.fn();

    // Mock the subscriptions to return no data
    mockUseSubscription
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageAdded })
    );

    expect(result.current.newMessageData).toBeUndefined();
  });

  it("should handle both subscriptions simultaneously", () => {
    const newMessage = createMockMessage("1", "New message");
    const updatedMessage = createMockMessage(
      "2",
      "Updated message",
      new Date().toISOString(),
      MessageStatus.Read
    );
    const onMessageAdded = jest.fn();
    const onMessageUpdated = jest.fn();

    // Mock both subscriptions to return data
    mockUseSubscription
      .mockReturnValueOnce({
        data: { messageAdded: newMessage },
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: { messageUpdated: updatedMessage },
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageAdded, onMessageUpdated })
    );

    expect(result.current.newMessageData).toEqual(newMessage);
    expect(result.current.updatedMessageData).toEqual(updatedMessage);
  });

  it("should handle loading state", () => {
    const onMessageAdded = jest.fn();

    // Mock the subscriptions in loading state
    mockUseSubscription
      .mockReturnValueOnce({
        data: undefined,
        loading: true,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageAdded })
    );

    expect(result.current.newMessageData).toBeUndefined();
    expect(result.current.updatedMessageData).toBeUndefined();
  });

  it("should handle empty message data in subscription response", () => {
    const onMessageAdded = jest.fn();

    // Mock subscription with empty messageAdded
    mockUseSubscription
      .mockReturnValueOnce({
        data: { messageAdded: null },
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageAdded })
    );

    expect(result.current.newMessageData).toBeNull();
  });

  it("should return undefined when subscription data is undefined", () => {
    const onMessageAdded = jest.fn();

    // Mock subscriptions with undefined data
    mockUseSubscription
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>)
      .mockReturnValueOnce({
        data: undefined,
        loading: false,
        error: undefined,
      } as ReturnType<typeof useSubscription>);

    const { result } = renderHook(() =>
      useMessageSubscriptions({ onMessageAdded })
    );

    expect(result.current.newMessageData).toBeUndefined();
    expect(result.current.updatedMessageData).toBeUndefined();
  });

  it("should handle subscription without options", () => {
    mockUseSubscription.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      restart: jest.fn(),
    });

    const { result } = renderHook(() => useMessageSubscriptions());

    expect(result.current.newMessageData).toBeUndefined();
    expect(result.current.updatedMessageData).toBeUndefined();
  });

  it("should handle errors when upsertMessageInCache throws for new messages", () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const newMessage = createMockMessage("1", "Error message");
    const onMessageAdded = jest.fn();

    // Mock upsertMessageInCache to throw an error
    mockUpsertMessageInCache.mockImplementationOnce(() => {
      throw new Error("Cache error");
    });

    // Mock useSubscription to trigger onData callback asynchronously
    mockUseSubscription.mockImplementation((query, options) => {
      if (
        query.loc?.source?.body?.includes("messageAdded") &&
        options?.onData
      ) {
        const arg = {
          client: mockClient,
          data: { data: { messageAdded: newMessage } },
        } as Parameters<NonNullable<typeof options.onData>>[0];
        Promise.resolve().then(() => options.onData!(arg));
      }
      return {
        data: { messageAdded: newMessage },
        loading: false,
        error: undefined,
        restart: jest.fn(),
      } as ReturnType<typeof useSubscription>;
    });

    renderHook(() => useMessageSubscriptions({ onMessageAdded }));

    return waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error handling new message:",
        expect.any(Error)
      );
      expect(onMessageAdded).not.toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it("should handle errors when upsertMessageInCache throws for updated messages", () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const updatedMessage = createMockMessage("2", "Error updated message");
    const onMessageUpdated = jest.fn();

    // Mock upsertMessageInCache to throw an error
    mockUpsertMessageInCache.mockImplementationOnce(() => {
      throw new Error("Cache update error");
    });

    // Mock useSubscription to trigger onData callback asynchronously
    mockUseSubscription.mockImplementation((query, options) => {
      if (
        query.loc?.source?.body?.includes("messageUpdated") &&
        options?.onData
      ) {
        const arg = {
          client: mockClient,
          data: { data: { messageUpdated: updatedMessage } },
        } as Parameters<NonNullable<typeof options.onData>>[0];
        Promise.resolve().then(() => options.onData!(arg));
      }
      return {
        data: { messageUpdated: updatedMessage },
        loading: false,
        error: undefined,
        restart: jest.fn(),
      } as ReturnType<typeof useSubscription>;
    });

    renderHook(() => useMessageSubscriptions({ onMessageUpdated }));

    return waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error handling updated message:",
        expect.any(Error)
      );
      expect(onMessageUpdated).not.toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it("should not call handlers when onData receives no data for messageAdded", () => {
    const onMessageAdded = jest.fn();

    mockUseSubscription.mockImplementation((query, options) => {
      if (
        query.loc?.source?.body?.includes("messageAdded") &&
        options?.onData
      ) {
        const arg = {
          client: mockClient,
          data: { data: null },
        } as Parameters<NonNullable<typeof options.onData>>[0];
        Promise.resolve().then(() => options.onData!(arg));
      }
      return {
        data: null,
        loading: false,
        error: undefined,
        restart: jest.fn(),
      } as ReturnType<typeof useSubscription>;
    });

    renderHook(() => useMessageSubscriptions({ onMessageAdded }));

    return waitFor(() => {
      expect(mockUpsertMessageInCache).not.toHaveBeenCalled();
      expect(onMessageAdded).not.toHaveBeenCalled();
    });
  });

  it("should not call handlers when onData receives no data for messageUpdated", () => {
    const onMessageUpdated = jest.fn();

    mockUseSubscription.mockImplementation((query, options) => {
      if (
        query.loc?.source?.body?.includes("messageUpdated") &&
        options?.onData
      ) {
        const arg = {
          client: mockClient,
          data: { data: null },
        } as Parameters<NonNullable<typeof options.onData>>[0];
        Promise.resolve().then(() => options.onData!(arg));
      }
      return {
        data: null,
        loading: false,
        error: undefined,
        restart: jest.fn(),
      } as ReturnType<typeof useSubscription>;
    });

    renderHook(() => useMessageSubscriptions({ onMessageUpdated }));

    return waitFor(() => {
      expect(mockUpsertMessageInCache).not.toHaveBeenCalled();
      expect(onMessageUpdated).not.toHaveBeenCalled();
    });
  });
});
