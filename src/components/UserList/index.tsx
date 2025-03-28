import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { fetchUsers, logoutCometChat } from '../../services/cometChat';
import { CometChatUser } from '../../types';
import { UserListProps, UserWithStatus } from '../../types/userList.types';
import { UserItem } from './UserItem';
import { styles } from './styles';
import { CometChat } from '@cometchat/chat-sdk-react-native';

const UserList: React.FC<UserListProps> = ({ onUserSelect, onLogout, userStatuses }) => {
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const typingTimeouts = React.useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    loadUsers();
    setupTypingListener();
    return () => {
      Object.values(typingTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const setupTypingListener = () => {
    const typingListenerId = 'user_list_typing_listener';
    CometChat.addMessageListener(
      typingListenerId,
      new CometChat.MessageListener({
        onTypingStarted: (typingIndicator: CometChat.TypingIndicator) => {
          const senderId = typingIndicator.getSender().getUid();
          setUsers(prevUsers => 
            prevUsers.map(user => 
              user.uid === senderId ? { ...user, isTyping: true } : user
            )
          );

         
          if (typingTimeouts.current[senderId]) {
            clearTimeout(typingTimeouts.current[senderId]);
          }

          
          typingTimeouts.current[senderId] = setTimeout(() => {
            setUsers(prevUsers => 
              prevUsers.map(user => 
                user.uid === senderId ? { ...user, isTyping: false } : user
              )
            );
          }, 3000);
        },
        onTypingEnded: (typingIndicator: CometChat.TypingIndicator) => {
          const senderId = typingIndicator.getSender().getUid();
          setUsers(prevUsers => 
            prevUsers.map(user => 
              user.uid === senderId ? { ...user, isTyping: false } : user
            )
          );
        }
      })
    );

    return () => {
      CometChat.removeMessageListener(typingListenerId);
    };
  };

  const loadUsers = async () => {
    try {
      const fetchedUsers = await fetchUsers();
      
      const convertedUsers: UserWithStatus[] = (fetchedUsers as unknown as CometChatUser[]).map(cometChatUser => {
        const status = userStatuses[cometChatUser.getUid()] || 'offline';
        return {
          uid: cometChatUser.getUid(),
          name: cometChatUser.getName(),
          avatar: cometChatUser.getAvatar(),
          status: status,
          isTyping: false,
          getStatus: () => userStatuses[cometChatUser.getUid()] || 'offline'
        };
      });
      setUsers(convertedUsers);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  // Update users when userStatuses changes
  useEffect(() => {
    loadUsers();
  }, [userStatuses]);

  const handleLogout = async () => {
    try {
      Object.values(typingTimeouts.current).forEach(timeout => clearTimeout(timeout));
      await logoutCometChat();
      onLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#075E54" barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <UserItem 
            user={item} 
            onPress={onUserSelect} 
          />
        )}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
};

export default UserList; 