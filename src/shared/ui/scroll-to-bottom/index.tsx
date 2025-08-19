import styles from "./styles.module.css";

type ScrollToBottomButtonProps = {
  onClick: () => void;
};

export const ScrollToBottomButton = ({
  onClick,
}: ScrollToBottomButtonProps) => {
  return (
    <button
      className={styles.scrollToBottomButton}
      onClick={onClick}
      title="Scroll to bottom"
    >
      ⬇
    </button>
  );
};
