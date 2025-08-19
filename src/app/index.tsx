import { FC } from "react";

import { Providers } from "./providers";

import { ChatWidget } from "@/widgets/chat";

export const App: FC = () => {
  return (
    <Providers>
      <ChatWidget />
    </Providers>
  );
};
