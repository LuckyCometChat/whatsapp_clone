import { CometChat } from '@cometChat/chat-sdk-react-native';

export interface User {
  uid: string;
  name: string;
  avatar?: string;
  getStatus?: () => 'online' | 'offline';
}

export interface CometChatUser extends CometChat.User {
  uid: string;
  name: string;
  avatar?: string;
}

export interface CometChatMessage {
  id: string;
  text: string;
  sender: CometChatUser;
  sentAt: number;
  type: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: {
    uid: string;
    name: string;
    avatar?: string;
  };
  sentAt: number;
  type: string;
  status: 'sent' | 'delivered' | 'seen';
  editedAt?: number;
  editedBy?: string;
  isDeleted?: boolean;
  attachment?: {
    url: string;
    type: string;
    name: string;
  };
  reactions?: {
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }[];
  threadCount?: number;
  parentMessageId?: string;
  isLocalOnly?: boolean;
} 