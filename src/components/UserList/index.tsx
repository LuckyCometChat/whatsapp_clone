import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { fetchUsers, logoutCometChat, subscribeToUserStatus } from '../../services/cometChat';
import { CometChatUser } from '../../types';
import { UserListProps, UserWithStatus } from '../../types/userList.types';
import { UserItem } from './UserItem';
import { styles } from './styles';

const UserList: React.FC<UserListProps> = ({ onUserSelect, onLogout }) => {
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const unsubscribeFunctions = React.useRef<{ [key: string]: () => void }>({});

  useEffect(() => {
    loadUsers();
    return () => {
      Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const loadUsers = async () => {
    try {
      const fetchedUsers = await fetchUsers();
      
      const convertedUsers: UserWithStatus[] = (fetchedUsers as unknown as CometChatUser[]).map(user => ({
        uid: user.uid,
        name: user.name,
        avatar: user.avatar,
        status: 'offline'
      }));
      setUsers(convertedUsers);

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
        renderItem={({ item }) => <UserItem user={item} onPress={onUserSelect} />}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
};

export default UserList; 