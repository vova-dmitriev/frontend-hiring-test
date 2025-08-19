import { gql } from "@apollo/client";

// Query to fetch messages with pagination
export const GET_MESSAGES = gql`
  query GetMessages($first: Int, $after: MessagesCursor) {
    messages(first: $first, after: $after) {
      edges {
        node {
          id
          text
          status
          updatedAt
          sender
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// Mutation to send a message
export const SEND_MESSAGE = gql`
  mutation SendMessage($text: String!) {
    sendMessage(text: $text) {
      id
      text
      status
      updatedAt
      sender
    }
  }
`;

// Subscription for receiving new messages
export const MESSAGE_ADDED_SUBSCRIPTION = gql`
  subscription MessageAdded {
    messageAdded {
      id
      text
      status
      updatedAt
      sender
    }
  }
`;

// Subscription for updating existing messages
export const MESSAGE_UPDATED_SUBSCRIPTION = gql`
  subscription MessageUpdated {
    messageUpdated {
      id
      text
      status
      updatedAt
      sender
    }
  }
`;
