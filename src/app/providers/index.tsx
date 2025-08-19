import { FC, ReactNode } from "react";

import { ApolloProviderWrapper } from "./apollo-provider";

interface Props {
  children: ReactNode;
}

export const Providers: FC<Props> = ({ children }) => {
  return <ApolloProviderWrapper>{children}</ApolloProviderWrapper>;
};
