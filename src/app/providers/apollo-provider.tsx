import { ApolloProvider } from "@apollo/client";
import { client } from "@shared/api";
import { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export const ApolloProviderWrapper: FC<Props> = ({ children }) => {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
};
