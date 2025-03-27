import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { initCometChat } from './src/services/cometChat';
import { User } from './src/types';
import Login from './src/components/Login';
import UserList from './src/components/UserList';
import Chat from './src/components/Chat';
import { CometChat } from '@cometchat/chat-sdk-react-native';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStatuses, setUserStatuses] = useState<{ [key: string]: 'online' | 'offline' }>({});
  const userStatusListenerRef = useRef<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initCometChat();
        console.log("CometChat initialization successful");
      } catch (error) {
        console.error("CometChat initialization error:", error);
        Alert.alert("Initialization Error", JSON.stringify(error));
      }
    };
    initializeApp();
  }, []);

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      // Add user status listener
      userStatusListenerRef.current = 'user_status_listener';
      CometChat.addUserListener(
        userStatusListenerRef.current,
        new CometChat.UserListener({
          onUserOnline: (onlineUser: CometChat.User) => {
            setUserStatuses(prev => ({
              ...prev,
              [onlineUser.getUid()]: 'online'
            }));
          },
          onUserOffline: (offlineUser: CometChat.User) => {
            setUserStatuses(prev => ({
              ...prev,
              [offlineUser.getUid()]: 'offline'
            }));
          }
        })
      );

      return () => {
        if (userStatusListenerRef.current) {
          CometChat.removeUserListener(userStatusListenerRef.current);
        }
      };
    }
  }, [isLoggedIn, currentUser]);

  const handleLogin = (user: User, status: 'online' | 'offline') => {
    setCurrentUser(user);
    setUserStatuses(prev => ({
      ...prev,
      [user.uid]: status
    }));
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedUser(null);
    setUserStatuses({});
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
  };

  const handleBack = () => {
    setSelectedUser(null);
  };

  return (
    <View style={styles.container}>
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : !selectedUser ? (
        <UserList 
          onUserSelect={handleUserSelect} 
          onLogout={handleLogout}
          userStatuses={userStatuses}
        />
      ) : (
        <Chat
          currentUser={currentUser!}
          selectedUser={selectedUser}
          onBack={handleBack}
          userStatuses={userStatuses}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;