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
  isDeleted?: boolean;
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

export interface Group {
  guid: string;
  name: string;
  type: string;
  description?: string;
  owner?: string;
  icon?: string;
  createdAt?: number;
  membersCount?: number;
  tags?: string[];
}

export interface GroupMember {
  uid: string;
  name: string;
  avatar?: string;
  scope?: string;
  joinedAt?: number;
  status?: 'online' | 'offline';
}

export interface CometChatUser {
  uid: string;
  name: string;
  avatar: string;
  getUid: () => string;
  getName: () => string;
  getAvatar: () => string;
  getStatus: () => string;
} 