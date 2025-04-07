import React, { useState } from 'react';
import Login from './components/Login';
import UserList from './components/UserList';
import Chat from './components/Chat';
import GroupList from './components/GroupList';
import GroupChat from './components/GroupChat';
import { User, Group } from './types';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [userStatuses, setUserStatuses] = useState<{ [key: string]: 'online' | 'offline' }>({});

  const handleLoginSuccess = (user: User, status: 'online' | 'offline') => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    setUserStatuses(prev => ({
      ...prev,
      [user.uid]: status
    }));
  };

  const handleUserStatusChange = (uid: string, status: 'online' | 'offline') => {
    setUserStatuses(prev => ({
      ...prev,
      [uid]: status
    }));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedUser(null);
    setSelectedGroup(null);
    setShowGroups(false);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
  };

  const renderContent = () => {
    if (!isLoggedIn) {
      return <Login onLogin={handleLoginSuccess} />;
    }

    if (selectedGroup && currentUser) {
      return (
        <GroupChat
          currentUser={currentUser}
          selectedGroup={selectedGroup}
          onBack={() => setSelectedGroup(null)}
        />
      );
    }

    if (showGroups && currentUser) {
      return (
        <GroupList
          currentUser={currentUser}
          onGroupSelect={(group) => setSelectedGroup(group)}
          onBack={() => setShowGroups(false)}
        />
      );
    }

    if (selectedUser && currentUser) {
      return (
        <Chat
          currentUser={currentUser}
          selectedUser={selectedUser}
          onBack={() => setSelectedUser(null)}
          userStatuses={userStatuses}
          onUserStatusChange={handleUserStatusChange}
        />
      );
    }

    return (
      <UserList
        onUserSelect={handleUserSelect}
        onLogout={handleLogout}
        userStatuses={userStatuses}
        onGroupsPress={() => setShowGroups(true)}
      />
    );
  };

  return (
    <div className="App">
      {renderContent()}
    </div>
  );
};

export default App; 