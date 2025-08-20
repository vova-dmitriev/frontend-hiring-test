import { InMemoryCache } from "@apollo/client";

import {
  MessageStatus,
  MessageSender,
  Message,
} from "../../../../entities/message";
import { GET_MESSAGES } from "../../api";
import { upsertMessageInCache, removeTempMessagesByText } from "../cache-utils";

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

const createMockMessageEdge = (message: Message) => ({
  __typename: "MessageEdge" as const,
  node: message,
  cursor: `cursor_${message.id}`,
});

const createMockMessagePage = (messages: Message[]) => ({
  __typename: "MessagePage" as const,
  edges: messages.map(createMockMessageEdge),
  pageInfo: {
    __typename: "MessagePageInfo" as const,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: messages.length > 0 ? `cursor_${messages[0].id}` : null,
    endCursor:
      messages.length > 0 ? `cursor_${messages[messages.length - 1].id}` : null,
  },
});

describe("cache-utils", () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  describe("upsertMessageInCache", () => {
    it("should add a new message to empty cache", () => {
      // Setup: Write empty messages to cache
      const emptyPage = createMockMessagePage([]);
      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: emptyPage },
      });

      // Test: Add new message
      const newMessage = createMockMessage("1", "New message");
      upsertMessageInCache(cache, newMessage);

      // Verify: Message was added
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(1);
      expect(result?.messages.edges[0].node).toEqual(newMessage);
      expect(result?.messages.edges[0].cursor).toBe("cursor_1");
    });

    it("should add a new message to existing messages", () => {
      // Setup: Write existing messages to cache
      const existingMessage = createMockMessage("1", "Existing message");
      const existingPage = createMockMessagePage([existingMessage]);
      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: existingPage },
      });

      // Test: Add new message
      const newMessage = createMockMessage("2", "New message");
      upsertMessageInCache(cache, newMessage);

      // Verify: Both messages are present
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(2);
      expect(result?.messages.edges[0].node).toEqual(existingMessage);
      expect(result?.messages.edges[1].node).toEqual(newMessage);
    });

    it("should update existing message with newer timestamp", () => {
      // Setup: Write existing message to cache
      const existingMessage = createMockMessage(
        "1",
        "Original text",
        "2023-01-01T00:00:00.000Z"
      );
      const existingPage = createMockMessagePage([existingMessage]);
      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: existingPage },
      });

      // Test: Update message with newer timestamp
      const updatedMessage = createMockMessage(
        "1",
        "Updated text",
        "2023-01-02T00:00:00.000Z"
      );
      upsertMessageInCache(cache, updatedMessage);

      // Verify: Message was updated
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(1);
      expect(result?.messages.edges[0].node.text).toBe("Updated text");
      expect(result?.messages.edges[0].node.updatedAt).toBe(
        "2023-01-02T00:00:00.000Z"
      );
    });

    it("should ignore update with older timestamp", () => {
      // Setup: Write existing message to cache
      const existingMessage = createMockMessage(
        "1",
        "Original text",
        "2023-01-02T00:00:00.000Z"
      );
      const existingPage = createMockMessagePage([existingMessage]);
      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: existingPage },
      });

      // Test: Try to update message with older timestamp
      const staleMessage = createMockMessage(
        "1",
        "Stale text",
        "2023-01-01T00:00:00.000Z"
      );
      upsertMessageInCache(cache, staleMessage);

      // Verify: Message was not updated
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(1);
      expect(result?.messages.edges[0].node.text).toBe("Original text");
      expect(result?.messages.edges[0].node.updatedAt).toBe(
        "2023-01-02T00:00:00.000Z"
      );
    });

    it("should handle missing cache gracefully", () => {
      // Test: Try to upsert message when cache is empty
      const newMessage = createMockMessage("1", "New message");

      // Should not throw error
      expect(() => {
        upsertMessageInCache(cache, newMessage);
      }).not.toThrow();

      // Cache should still be empty
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });
      expect(result).toBeNull();
    });
  });

  describe("removeTempMessagesByText", () => {
    it("should remove temporary messages with matching text", () => {
      // Setup: Write messages including temp ones to cache
      const permanentMessage = createMockMessage("1", "Permanent message");
      const tempMessage1 = createMockMessage("temp-123", "Temp message");
      const tempMessage2 = createMockMessage("temp-456", "Another temp");
      const duplicateTempMessage = createMockMessage(
        "temp-789",
        "Temp message"
      );

      const messagesPage = createMockMessagePage([
        permanentMessage,
        tempMessage1,
        tempMessage2,
        duplicateTempMessage,
      ]);

      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: messagesPage },
      });

      // Test: Remove temp messages with specific text
      removeTempMessagesByText(cache, "Temp message");

      // Verify: Only matching temp messages were removed
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(2);
      expect(result?.messages.edges[0].node.id).toBe("1");
      expect(result?.messages.edges[1].node.id).toBe("temp-456");
    });

    it("should not remove permanent messages with matching text", () => {
      // Setup: Write messages including permanent one with same text as temp
      const permanentMessage = createMockMessage("1", "Shared text");
      const tempMessage = createMockMessage("temp-123", "Shared text");

      const messagesPage = createMockMessagePage([
        permanentMessage,
        tempMessage,
      ]);

      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: messagesPage },
      });

      // Test: Remove temp messages with specific text
      removeTempMessagesByText(cache, "Shared text");

      // Verify: Only temp message was removed
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(1);
      expect(result?.messages.edges[0].node.id).toBe("1");
    });

    it("should handle no matching messages gracefully", () => {
      // Setup: Write messages without matching text
      const message1 = createMockMessage("1", "Message 1");
      const message2 = createMockMessage("temp-123", "Message 2");

      const messagesPage = createMockMessagePage([message1, message2]);

      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: messagesPage },
      });

      // Test: Try to remove messages with non-matching text
      removeTempMessagesByText(cache, "Non-existent text");

      // Verify: No messages were removed
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(2);
    });

    it("should handle missing cache gracefully", () => {
      // Test: Try to remove temp messages when cache is empty

      // Should not throw error
      expect(() => {
        removeTempMessagesByText(cache, "Some text");
      }).not.toThrow();

      // Cache should still be empty
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });
      expect(result).toBeNull();
    });

    it("should handle empty messages list", () => {
      // Setup: Write empty messages to cache
      const emptyPage = createMockMessagePage([]);
      cache.writeQuery({
        query: GET_MESSAGES,
        data: { messages: emptyPage },
      });

      // Test: Try to remove temp messages
      removeTempMessagesByText(cache, "Some text");

      // Verify: Cache is still empty
      const result = cache.readQuery<{ messages: any }>({
        query: GET_MESSAGES,
      });

      expect(result?.messages.edges).toHaveLength(0);
    });
  });
});
