import { CometChat } from '@cometChat/chat-sdk-react-native';

export interface User {
  uid: string;
  name: string;
  avatar?: string;
}

export interface CometChatUser extends CometChat.User {
  uid: string;
  name: string;
  avatar?: string;
}

export interface CometChatMessage extends CometChat.TextMessage {
  id: string;
  text: string;
  sender: CometChatUser;
  sentAt: number;
  type: string;
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
} 