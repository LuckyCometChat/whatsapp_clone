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
  reactions?: Reaction[];
  attachment?: {
    url: string;
    type: string;
    name: string;
  };
  parentMessageId?: string;
  threadCount?: number;
  isThreaded?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface User {
  uid: string;
  name: string;
  avatar?: string;
} 