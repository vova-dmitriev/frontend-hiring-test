import { FC, useCallback, KeyboardEvent } from "react";

import styles from "./styles.module.css";

export interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const MessageInput: FC<MessageInputProps> = ({
  value,
  onChange,
  onSubmit,
  loading,
  disabled = false,
  placeholder = "Enter message...",
  className,
}) => {
  // Key press handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!loading && !disabled && value.trim()) {
          onSubmit();
        }
      }
    },
    [loading, disabled, value, onSubmit]
  );

  // Value change handler
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  // Send button click handler
  const handleSubmit = useCallback(() => {
    if (!loading && !disabled && value.trim()) {
      onSubmit();
    }
  }, [loading, disabled, value, onSubmit]);

  const isSubmitDisabled = loading || disabled || !value.trim();

  return (
    <div className={`${styles.footer} ${className || ""}`}>
      <input
        type="text"
        className={styles.textInput}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className={styles.sendButton}
      >
        {loading ? (
          <div className={styles.spinner}>
            <div className={styles.spinnerIcon}></div>
          </div>
        ) : (
          "Send"
        )}
      </button>
    </div>
  );
};
