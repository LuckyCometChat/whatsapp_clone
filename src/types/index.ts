import { CometChat } from '@cometchat/chat-sdk-react-native';

export interface User {
  uid: string;
  name: string;
  avatar?: string;
}

export interface CometChatUser {
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

export interface ChatMessage {
  id: string;
  text: string;
  sender: User;
  sentAt: number;
  type: string;
  status: 'sent' | 'delivered' | 'seen';
} 