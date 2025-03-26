import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { fetchUsers, logoutCometChat, subscribeToUserStatus } from '../services/cometChat';
import { User, CometChatUser } from '../types';

interface UserListProps {
  onUserSelect: (user: User) => void;
  onLogout: () => void;
}

interface UserWithStatus extends User {
  status: 'online' | 'offline';
}

const UserList: React.FC<UserListProps> = ({ onUserSelect, onLogout }) => {
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const unsubscribeFunctions = React.useRef<{ [key: string]: () => void }>({});

  useEffect(() => {
    loadUsers();
    return () => {
      // Cleanup subscriptions when component unmounts
      Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const loadUsers = async () => {
    try {
      const fetchedUsers = await fetchUsers();
      // Convert fetched users to our User type with initial offline status
      const convertedUsers: UserWithStatus[] = (fetchedUsers as unknown as CometChatUser[]).map(user => ({
        uid: user.uid,
        name: user.name,
        avatar: user.avatar,
        status: 'offline'
      }));
      setUsers(convertedUsers);

      // Subscribe to status updates for each user
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
      // Cleanup all subscriptions before logout
      Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
      await logoutCometChat();
      onLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const renderUser = ({ item }: { item: UserWithStatus }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => onUserSelect(item)}
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
          { color: item.status === 'online' ? '#25D366' : '#999' }
        ]}>
          {item.status === 'online' ? 'Online' : 'Offline'}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
  logoutButton: {
    padding: 8,
  },
  logoutButtonText: {
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
    bottom: 0,
    right: 0,
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
    borderRadius: 4,
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
});

export default UserList; 