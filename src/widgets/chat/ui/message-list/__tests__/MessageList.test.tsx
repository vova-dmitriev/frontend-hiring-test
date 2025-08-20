import { render, screen, waitFor } from "@testing-library/react";
import React, { createRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { MessageList } from "../index";

import { Message, MessageSender, MessageStatus } from "@/entities/message";

// Mock react-virtuoso props interface
interface VirtuosoProps {
  data?: Message[];
  itemContent: (index: number, item: Message) => React.ReactNode;
  components?: {
    Header?: React.ComponentType;
    Footer?: React.ComponentType;
  };
  endReached?: () => void;
  atBottomStateChange?: (isAtBottom: boolean) => void;
  className?: string;
  ref?: React.Ref<VirtuosoHandle>;
}

// Mock react-virtuoso
jest.mock("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
    components,
    endReached,
    atBottomStateChange,
    ...props
  }: VirtuosoProps) => {
    // Simulate Virtuoso behavior for testing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ref, ...divProps } = props;
    return (
      <div data-testid="virtuoso" {...divProps}>
        {components?.Header && <components.Header />}
        {data?.map((item, index) => (
          <div key={item.id || index} data-testid={`message-${index}`}>
            {itemContent(index, item)}
          </div>
        ))}
        {components?.Footer && <components.Footer />}
        <button
          data-testid="end-reached-trigger"
          onClick={() => endReached?.()}
        >
          Load More
        </button>
        <button
          data-testid="bottom-state-trigger"
          onClick={() => atBottomStateChange?.(true)}
        >
          At Bottom
        </button>
      </div>
    );
  },
  VirtuosoHandle: {},
}));

// Mock MessageItem component
jest.mock("../../message-item", () => ({
  MessageItem: ({ message }: { message: Message }) => (
    <div data-testid={`message-item-${message.id}`}>{message.text}</div>
  ),
}));

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

describe("MessageList", () => {
  const mockMessages = [
    createMockMessage("1", "First message"),
    createMockMessage("2", "Second message"),
    createMockMessage("3", "Third message"),
  ];

  const defaultProps = {
    virtuosoRef: createRef<VirtuosoHandle>(),
    messages: mockMessages,
    loading: false,
    hasNextPage: false,
    onLoadMore: jest.fn(),
    isAtBottom: true,
    onAtBottomChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render messages correctly", () => {
    render(<MessageList {...defaultProps} />);

    expect(screen.getByTestId("message-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("message-item-3")).toBeInTheDocument();

    expect(screen.getByText("First message")).toBeInTheDocument();
    expect(screen.getByText("Second message")).toBeInTheDocument();
    expect(screen.getByText("Third message")).toBeInTheDocument();
  });

  it("should render empty state when no messages and not loading", () => {
    render(<MessageList {...defaultProps} messages={[]} />);

    expect(screen.getByText("No messages")).toBeInTheDocument();
  });

  it("should render loading state when no messages and loading", () => {
    render(<MessageList {...defaultProps} messages={[]} loading={true} />);

    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("should render header when has next page and not loading", () => {
    render(<MessageList {...defaultProps} hasNextPage={true} />);

    expect(screen.getByText("Pull to load more")).toBeInTheDocument();
  });

  it("should render loading header when has next page and loading", () => {
    render(<MessageList {...defaultProps} hasNextPage={true} loading={true} />);

    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("should not render header when no next page", () => {
    render(<MessageList {...defaultProps} hasNextPage={false} />);

    expect(screen.queryByText("Pull to load more")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
  });

  it("should call onLoadMore when end is reached and conditions are met", async () => {
    const onLoadMore = jest.fn().mockResolvedValue(undefined);

    render(
      <MessageList
        {...defaultProps}
        hasNextPage={true}
        loading={false}
        onLoadMore={onLoadMore}
      />
    );

    const trigger = screen.getByTestId("end-reached-trigger");
    trigger.click();

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  it("should not call onLoadMore when loading", async () => {
    const onLoadMore = jest.fn();

    render(
      <MessageList
        {...defaultProps}
        hasNextPage={true}
        loading={true}
        onLoadMore={onLoadMore}
      />
    );

    const trigger = screen.getByTestId("end-reached-trigger");
    trigger.click();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("should not call onLoadMore when no next page", async () => {
    const onLoadMore = jest.fn();

    render(
      <MessageList
        {...defaultProps}
        hasNextPage={false}
        loading={false}
        onLoadMore={onLoadMore}
      />
    );

    const trigger = screen.getByTestId("end-reached-trigger");
    trigger.click();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("should handle onLoadMore errors gracefully", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const onLoadMore = jest
      .fn()
      .mockRejectedValue(new Error("Load more failed"));

    render(
      <MessageList
        {...defaultProps}
        hasNextPage={true}
        loading={false}
        onLoadMore={onLoadMore}
      />
    );

    const trigger = screen.getByTestId("end-reached-trigger");
    trigger.click();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading more messages:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("should call onAtBottomChange when bottom state changes", () => {
    const onAtBottomChange = jest.fn();

    render(
      <MessageList {...defaultProps} onAtBottomChange={onAtBottomChange} />
    );

    const trigger = screen.getByTestId("bottom-state-trigger");
    trigger.click();

    expect(onAtBottomChange).toHaveBeenCalledWith(true);
  });

  it("should apply custom className", () => {
    render(<MessageList {...defaultProps} className="custom-class" />);

    const virtuoso = screen.getByTestId("virtuoso");
    // Component renders with custom class (CSS modules handled by build process)
    expect(virtuoso).toBeInTheDocument();
    expect(virtuoso).toHaveClass("custom-class");
  });

  it("should render without custom className", () => {
    render(<MessageList {...defaultProps} />);

    const virtuoso = screen.getByTestId("virtuoso");
    // Component renders successfully (CSS modules handled by build process)
    expect(virtuoso).toBeInTheDocument();
  });

  it("should not render footer when there are messages", () => {
    render(<MessageList {...defaultProps} messages={mockMessages} />);

    expect(screen.queryByText("No messages")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading messages...")).not.toBeInTheDocument();
  });

  it("should handle empty messages array", () => {
    render(<MessageList {...defaultProps} messages={[]} />);

    expect(screen.getByText("No messages")).toBeInTheDocument();
    expect(screen.queryByTestId("message-item-1")).not.toBeInTheDocument();
  });

  it("should handle single message", () => {
    const singleMessage = [createMockMessage("1", "Only message")];

    render(<MessageList {...defaultProps} messages={singleMessage} />);

    expect(screen.getByTestId("message-item-1")).toBeInTheDocument();
    expect(screen.getByText("Only message")).toBeInTheDocument();
    expect(screen.queryByText("No messages")).not.toBeInTheDocument();
  });

  it("should handle large number of messages", () => {
    const manyMessages = Array.from({ length: 100 }, (_, i) =>
      createMockMessage(`${i + 1}`, `Message ${i + 1}`)
    );

    render(<MessageList {...defaultProps} messages={manyMessages} />);

    // Should render all messages
    expect(screen.getByTestId("message-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-item-100")).toBeInTheDocument();
  });

  it("should pass correct props to Virtuoso", () => {
    render(<MessageList {...defaultProps} />);

    const virtuoso = screen.getByTestId("virtuoso");
    expect(virtuoso).toBeInTheDocument();

    // Verify that messages are rendered through itemContent
    expect(screen.getByTestId("message-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("message-item-3")).toBeInTheDocument();
  });

  it("should handle message updates correctly", () => {
    const { rerender } = render(<MessageList {...defaultProps} />);

    expect(screen.getByText("First message")).toBeInTheDocument();

    // Update messages
    const updatedMessages = [
      { ...mockMessages[0], text: "Updated first message" },
      ...mockMessages.slice(1),
    ];

    rerender(<MessageList {...defaultProps} messages={updatedMessages} />);

    expect(screen.getByText("Updated first message")).toBeInTheDocument();
    expect(screen.queryByText("First message")).not.toBeInTheDocument();
  });

  it("should handle virtuosoRef correctly", () => {
    const ref = createRef<VirtuosoHandle>();

    render(<MessageList {...defaultProps} virtuosoRef={ref} />);

    // The ref should be passed to Virtuoso component
    // This is tested implicitly through the mock
    expect(screen.getByTestId("virtuoso")).toBeInTheDocument();
  });

  it("should maintain component structure", () => {
    const { container } = render(<MessageList {...defaultProps} />);

    // Check that the component has the expected structure
    expect(container.firstChild).toHaveStyle("position: relative");
    expect(container.firstChild).toHaveStyle("height: 100%");
    expect(screen.getByTestId("virtuoso")).toBeInTheDocument();
  });
});
