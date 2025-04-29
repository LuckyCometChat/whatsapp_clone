import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { initCometChat as initCometChatCalls } from './src/services/cometCall';
import { AppInitializer } from './src/services';
import { User, Group } from './src/types';
import Login from './src/components/Login';
import UserList from './src/components/UserList';
import Chat from './src/components/Chat';
import GroupList from './src/components/GroupList';
import GroupChat from './src/components/GroupChat';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import RNCallKeep from 'react-native-callkeep';
// import CallKeepHelper from './path-to/CallKeepHelper';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStatuses, setUserStatuses] = useState<{ [key: string]: 'online' | 'offline' }>({});
  const userStatusListenerRef = useRef<string | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize CometChat Calls
        await initCometChatCalls();
        console.log("CometChat Calls initialization successful");
      } catch (error) {
        console.error("CometChat Calls initialization error:", error);
        Alert.alert("Initialization Error", JSON.stringify(error));
      }
    };
    initializeApp();
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
          onUserStatusChange={(uid, status) => {
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