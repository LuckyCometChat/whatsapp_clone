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
  status: 'sent' | 'delivered' | 'read';
  editedAt?: number;
  editedBy?: string;
  reactions?: Reaction[];
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