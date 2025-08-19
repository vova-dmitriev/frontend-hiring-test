import cn from "clsx";
import { FC } from "react";

import styles from "./styles.module.css";

export interface NewMessagesBannerProps {
  count: number;
  onClick: () => void;
  className?: string;
}

export const NewMessagesBanner: FC<NewMessagesBannerProps> = ({
  count,
  onClick,
  className,
}) => {
  if (!count) return null;
  return (
    <div className={cn(styles.banner, className)} onClick={onClick}>
      {count} new message{count > 1 ? "s" : ""}
    </div>
  );
};
