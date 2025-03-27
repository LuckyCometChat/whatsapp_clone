import { User } from './index';

export interface UserListProps {
  onUserSelect: (user: User) => void;
  onLogout: () => void;
  userStatuses: { [key: string]: 'online' | 'offline' };
}

export interface UserWithStatus extends User {
  status: 'online' | 'offline';
  isTyping?: boolean;
  getStatus?: () => 'online' | 'offline';
} 