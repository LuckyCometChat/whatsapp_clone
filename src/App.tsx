import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import RNCallKeep from 'react-native-callkeep';
import { initCallKeep, initPushNotifications } from './services/pushNotifications';
import messaging from '@react-native-firebase/messaging';

// Define User and Group types if not available
interface User {
  uid: string;
  name: string;
  avatar?: string;
}

interface Group {
  guid: string;
  name: string;
  icon?: string;
}

// Mock components for now - replace with actual imports
const Login = (props: { onLogin: (user: User, status: 'online' | 'offline') => void }) => <View />;
const UserList = (props: { 
  onUserSelect: (user: User) => void, 
  onLogout: () => void, 
  userStatuses: { [key: string]: 'online' | 'offline' },
  onGroupsPress: () => void
}) => <View />;
const Chat = (props: { 
  currentUser: User, 
  selectedUser: User, 
  onBack: () => void,
  userStatuses: { [key: string]: 'online' | 'offline' },
  onUserStatusChange: (uid: string, status: 'online' | 'offline') => void
}) => <View />;
const GroupList = (props: { 
  onGroupSelect: (group: Group) => void, 
  onBack: () => void, 
  currentUser: User
}) => <View />;
const GroupChat = (props: { 
  currentUser: User, 
  selectedGroup: Group, 
  onBack: () => void
}) => <View />;

// Simple AppInitializer component
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flex: 1 }}>{children}</View>
);

// Mock function for CometChat calls initialization
const initCometChatCalls = async () => {
  console.log("CometChat calls initialized");
  return true;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStatuses, setUserStatuses] = useState<{ [key: string]: 'online' | 'offline' }>({});
  const userStatusListenerRef = useRef<string | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const callKeepHelperRef = useRef<any>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize CometChat Calls
        await initCometChatCalls();
        console.log("CometChat Calls initialization successful");

        // Initialize push notifications which includes CallKeep setup
        await initPushNotifications();
        
        // Store the CallKeep helper instance
        callKeepHelperRef.current = initCallKeep();
        
        // Set up background message handler for calls
        messaging().setBackgroundMessageHandler(async (remoteMessage) => {
          try {
            console.log('Background message received in App.js:', remoteMessage);
            // Process call notifications in the background handler
            // The actual implementation is in pushNotifications.tsx
          } catch (error) {
            console.error('Error in background message handler:', error);
          }
        });
      } catch (error) {
        console.error("App initialization error:", error);
        Alert.alert("Initialization Error", JSON.stringify(error));
      }
    };
    initializeApp();

    // Clean up when component unmounts
    return () => {
      // Clean up any listeners
      if (callKeepHelperRef.current) {
        callKeepHelperRef.current.removeEventListeners();
      }
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      userStatusListenerRef.current = 'user_status_listener';
      
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

      // listen for status changes
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
    setUserStatuses(prev => ({
      ...prev,
      [user.uid]: 'online' 
    }));
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedUser(null);
    setSelectedGroup(null);
    setShowGroups(false);
    setUserStatuses({});
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSelectedGroup(null);
  };

  const handleGroupSelect = (group: Group) => {
    setSelectedGroup(group);
    setSelectedUser(null);
  };

  const handleBack = () => {
    if (selectedUser) {
      setSelectedUser(null);
    } else if (selectedGroup) {
      setSelectedGroup(null);
    } else if (showGroups) {
      setShowGroups(false);
    }
  };

  const toggleView = () => {
    setShowGroups(!showGroups);
    setSelectedUser(null);
    setSelectedGroup(null);
  };

  const renderContent = () => {
    if (!isLoggedIn) {
      return <Login onLogin={handleLogin} />;
    }

    if (selectedUser) {
      return (
        <Chat
          currentUser={currentUser!}
          selectedUser={selectedUser}
          onBack={handleBack}
          userStatuses={userStatuses}
          onUserStatusChange={(uid: string, status: 'online' | 'offline') => {
            setUserStatuses(prev => ({
              ...prev,
              [uid]: status
            }));
          }}
        />
      );
    }

    if (selectedGroup) {
      return (
        <GroupChat
          currentUser={currentUser!}
          selectedGroup={selectedGroup}
          onBack={handleBack}
        />
      );
    }

    if (showGroups) {
      return (
        <GroupList
          onGroupSelect={handleGroupSelect}
          onBack={toggleView}
          currentUser={currentUser!}
        />
      );
    }

    return (
      <UserList 
        onUserSelect={handleUserSelect}
        onLogout={handleLogout}
        userStatuses={userStatuses}
        onGroupsPress={toggleView}
      />
    );
  };

  return (
    <AppInitializer>
      <View style={styles.container}>
        {renderContent()}
      </View>
    </AppInitializer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App; 