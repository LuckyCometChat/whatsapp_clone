import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { fetchUsers, logoutCometChat, subscribeToUserStatus } from '../services/cometChat';
import { User, CometChatUser } from '../types/index';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface UserListProps {
  onUserSelect: (user: User) => void;
  onLogout: () => void;
  userStatuses: { [key: string]: 'online' | 'offline' };
  onGroupsPress: () => void;
}

interface UserWithStatus extends User {
  status: 'online' | 'offline';
  isTyping?: boolean;
  unreadCount: number;
}

const UserList: React.FC<UserListProps> = ({ onUserSelect, onLogout, userStatuses, onGroupsPress }) => {
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const unsubscribeFunctions = React.useRef<{ [key: string]: () => void }>({});
  const messageListenerRef = React.useRef<string | null>(null);

  useEffect(() => {
    loadUsers();
    setupTypingListener();
    setupMessageListener();
    return () => {
      Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
      if (messageListenerRef.current) {
        CometChat.removeMessageListener(messageListenerRef.current);
      }
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

  const setupMessageListener = () => {
    messageListenerRef.current = 'user_list_message_listener';
    CometChat.addMessageListener(
      messageListenerRef.current,
      new CometChat.MessageListener({
        onTextMessageReceived: async (textMessage: CometChat.TextMessage) => {
          const senderId = textMessage.getSender().getUid();
          const receiver = textMessage.getReceiver() as CometChat.User;
          const receiverId = receiver.getUid();
          const loggedInUser = await CometChat.getLoggedinUser();

          if (receiverId === loggedInUser?.getUid()) {
            setUsers(prevUsers => 
              prevUsers.map(user => 
                user.uid === senderId 
                  ? { ...user, unreadCount: user.unreadCount + 1 }
                  : user
              )
            );
          }
        },
        onMediaMessageReceived: async (mediaMessage: CometChat.MediaMessage) => {
          const senderId = mediaMessage.getSender().getUid();
          const receiver = mediaMessage.getReceiver() as CometChat.User;
          const receiverId = receiver.getUid();
          const loggedInUser = await CometChat.getLoggedinUser();

          if (receiverId === loggedInUser?.getUid()) {
            setUsers(prevUsers => 
              prevUsers.map(user => 
                user.uid === senderId 
                  ? { ...user, unreadCount: user.unreadCount + 1 }
                  : user
              )
            );
          }
        },
        onMessagesRead: (messageReceipt: CometChat.MessageReceipt) => {
          const senderId = messageReceipt.getSender().getUid();
          setUsers(prevUsers => 
            prevUsers.map(user => 
              user.uid === senderId 
                ? { ...user, unreadCount: 0 }
                : user
            )
          );
        }
      })
    );
  };

  const loadUsers = async () => {
    try {
      const fetchedUsers = await fetchUsers();
      
      const convertedUsers: UserWithStatus[] = (fetchedUsers as unknown as CometChatUser[]).map(user => ({
        uid: user.uid,
        name: user.name,
        avatar: user.avatar,
        status: user.getStatus() === 'online' ? 'online' : 'offline',
        isTyping: false,
        unreadCount: 0
      }));
      setUsers(convertedUsers);
      console.log('Users:', convertedUsers);

      convertedUsers.forEach(user => {
        const unsubscribe = subscribeToUserStatus(user.uid, (status) => {
          setUsers(prevUsers => 
            prevUsers.map(u => 
              u.uid === user.uid ? { ...u, status } : u
            )
          );
        });
        unsubscribeFunctions.current[user.uid] = unsubscribe;
      });
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const handleLogout = async () => {
    try {
      Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
      await logoutCometChat();
      onLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleUserSelect = (user: UserWithStatus) => {
    // Reset unread count when user is selected
    setUsers(prevUsers => 
      prevUsers.map(u => 
        u.uid === user.uid ? { ...u, unreadCount: 0 } : u
      )
    );
    onUserSelect(user);
  };

  const renderUser = ({ item }: { item: UserWithStatus }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.userAvatar}>
        {item.avatar ? (
          <Image 
            source={{ uri: item.avatar }} 
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        )}
        <View style={[
          styles.onlineIndicator,
          { backgroundColor: item.status === 'online' ? '#25D366' : '#ccc' }
        ]}>
          <View style={[
            styles.onlineIndicatorInner,
            { backgroundColor: item.status === 'online' ? '#fff' : '#f0f0f0' }
          ]} />
        </View>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={[
          styles.userStatus,
          { color: item.isTyping ? '#25D366' : item.status === 'online' ? '#25D366' : '#999' }
        ]}>
          {item.isTyping ? 'typing...' : item.status === 'online' ? 'Online' : 'Offline'}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#075E54" barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={onGroupsPress} style={styles.groupsButton}>
            <Text style={styles.buttonText}>Groups</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={renderUser}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10,
  },
  header: {
    backgroundColor: '#075E54',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  groupsButton: {
    marginRight: 15,
  },
  logoutButton: {
    marginLeft: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  listContainer: {
    paddingVertical: 5,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicatorInner: {
    width: 8,
    height: 8,
    borderRadius: 7,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default UserList; 