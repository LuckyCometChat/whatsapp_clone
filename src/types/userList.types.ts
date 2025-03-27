import { User } from './index';

export interface UserListProps {
  onUserSelect: (user: User) => void;
  onLogout: () => void;
}

export interface UserWithStatus extends User {
  status: 'online' | 'offline';
} 