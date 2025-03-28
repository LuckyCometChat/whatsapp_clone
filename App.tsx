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
      
      // First, get all users' status
      const fetchUsersStatus = async () => {
        try {
          const limit = 30;
          const usersRequest = new CometChat.UsersRequestBuilder()
            .setLimit(limit)
            .build();
          
          const users = await usersRequest.fetchNext();
          const statusUpdates: { [key: string]: 'online' | 'offline' } = {};
          users.forEach((user: CometChat.User) => {
            statusUpdates[user.getUid()] = user.getStatus() === CometChat.USER_STATUS.ONLINE ? 'online' : 'offline';
          });
          setUserStatuses(prev => ({
            ...prev,
            ...statusUpdates
          }));
        } catch (error) {
          console.error("Error fetching users status:", error);
        }
      };
      
      fetchUsersStatus();

      // Then listen for status changes
      CometChat.addUserListener(
        userStatusListenerRef.current,
        new CometChat.UserListener({
          onUserOnline: (onlineUser: CometChat.User) => {
            console.log("User online:", onlineUser.getUid());
            setUserStatuses(prev => ({
              ...prev,
              [onlineUser.getUid()]: 'online'
            }));
          },
          onUserOffline: (offlineUser: CometChat.User) => {
            console.log("User offline:", offlineUser.getUid());
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
    // Set the current user's status and initialize userStatuses
    setUserStatuses(prev => ({
      ...prev,
      [user.uid]: 'online' // Always set to online when logging in
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
          onUserStatusChange={(uid, status) => {
            setUserStatuses(prev => ({
              ...prev,
              [uid]: status
            }));
          }}
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