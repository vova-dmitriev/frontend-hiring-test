import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MessageInput, MessageInputProps } from "../index";

describe("MessageInput", () => {
  const defaultProps: MessageInputProps = {
    value: "",
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    loading: false,
    disabled: false,
    placeholder: "Enter message...",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render with default props", () => {
    render(<MessageInput {...defaultProps} />);

    const input = screen.getByRole("textbox");
    const button = screen.getByRole("button", { name: /send/i });

    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Enter message...");
    expect(input).toHaveValue("");
    expect(input).not.toBeDisabled();
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled(); // Should be disabled when no text
  });

  it("should display the provided value", () => {
    render(<MessageInput {...defaultProps} value="Hello, world!" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Hello, world!");
  });

  it("should call onChange when text is typed", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<MessageInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "Hello");

    expect(onChange).toHaveBeenCalledTimes(5); // One call per character
    expect(onChange).toHaveBeenNthCalledWith(1, "H");
    expect(onChange).toHaveBeenNthCalledWith(2, "e");
    expect(onChange).toHaveBeenNthCalledWith(3, "l");
    expect(onChange).toHaveBeenNthCalledWith(4, "l");
    expect(onChange).toHaveBeenNthCalledWith(5, "o");
  });

  it("should enable submit button when there is text", () => {
    render(<MessageInput {...defaultProps} value="Hello" />);

    const button = screen.getByRole("button", { name: /send/i });
    expect(button).not.toBeDisabled();
  });

  it("should disable submit button when text is only whitespace", () => {
    render(<MessageInput {...defaultProps} value="   " />);

    const button = screen.getByRole("button", { name: /send/i });
    expect(button).toBeDisabled();
  });

  it("should call onSubmit when send button is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <MessageInput {...defaultProps} value="Hello" onSubmit={onSubmit} />
    );

    const button = screen.getByRole("button", { name: /send/i });
    await user.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("should call onSubmit when Enter key is pressed", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <MessageInput {...defaultProps} value="Hello" onSubmit={onSubmit} />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("should not call onSubmit when Shift+Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <MessageInput {...defaultProps} value="Hello" onSubmit={onSubmit} />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should not submit when loading", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <MessageInput
        {...defaultProps}
        value="Hello"
        loading={true}
        onSubmit={onSubmit}
      />
    );

    const button = screen.getByRole("button");
    await user.click(button);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should not submit when disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <MessageInput
        {...defaultProps}
        value="Hello"
        disabled={true}
        onSubmit={onSubmit}
      />
    );

    const button = screen.getByRole("button");
    await user.click(button);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should not submit when text is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(<MessageInput {...defaultProps} value="" onSubmit={onSubmit} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should show loading spinner when loading", () => {
    render(<MessageInput {...defaultProps} loading={true} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();

    // When loading, button should not contain "Send" text
    expect(screen.queryByText("Send")).not.toBeInTheDocument();

    // Button should be disabled when loading
    expect(button).toBeDisabled();
  });

  it("should disable input when disabled prop is true", () => {
    render(<MessageInput {...defaultProps} disabled={true} />);

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("should use custom placeholder", () => {
    render(
      <MessageInput {...defaultProps} placeholder="Type your message here..." />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "Type your message here...");
  });

  it("should apply custom className", () => {
    render(<MessageInput {...defaultProps} className="custom-class" />);

    const container = screen.getByRole("textbox").closest("div");
    expect(container).toHaveClass("custom-class");
  });

  it("should focus input on mount", () => {
    render(<MessageInput {...defaultProps} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
  });

  it("should handle onSubmit returning a promise", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <MessageInput {...defaultProps} value="Hello" onSubmit={onSubmit} />
    );

    const button = screen.getByRole("button", { name: /send/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("should prevent form submission on Enter when conditions are not met", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    // Test with loading state
    render(
      <MessageInput
        {...defaultProps}
        value="Hello"
        loading={true}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should handle key down events correctly", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <MessageInput {...defaultProps} value="Hello" onSubmit={onSubmit} />
    );

    const input = screen.getByRole("textbox");

    // Test Enter key
    await user.type(input, "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    onSubmit.mockClear();

    // Test other keys (should not trigger submit)
    await user.type(input, "{Space}");
    await user.type(input, "a");
    await user.type(input, "{Tab}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should handle onChange events correctly", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<MessageInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "Test");

    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenNthCalledWith(1, "T");
    expect(onChange).toHaveBeenNthCalledWith(2, "e");
    expect(onChange).toHaveBeenNthCalledWith(3, "s");
    expect(onChange).toHaveBeenNthCalledWith(4, "t");
  });

  it("should handle button click when submit conditions are met", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <MessageInput
        {...defaultProps}
        value="Valid message"
        onSubmit={onSubmit}
      />
    );

    const button = screen.getByRole("button", { name: /send/i });
    await user.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("should not handle button click when submit conditions are not met", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    // Test with whitespace only
    render(<MessageInput {...defaultProps} value="   " onSubmit={onSubmit} />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
