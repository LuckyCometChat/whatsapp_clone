import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { UserWithStatus } from '../../types/userList.types';
import { styles } from './styles';

interface UserItemProps {
  user: UserWithStatus;
  onPress: (user: UserWithStatus) => void;
}

export const UserItem: React.FC<UserItemProps> = ({ user, onPress }) => {
  const isOnline = user.status === 'online';

  return (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => onPress(user)}
    >
      <View style={styles.userAvatar}>
        {user.avatar ? (
          <Image 
            source={{ uri: user.avatar }} 
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>
            {user.name.charAt(0).toUpperCase()}
          </Text>
        )}
        <View style={[
          styles.onlineIndicator,
          { backgroundColor: isOnline ? '#25D366' : '#ccc' }
        ]}>
          <View style={[
            styles.onlineIndicatorInner,
            { backgroundColor: isOnline ? '#fff' : '#f0f0f0' }
          ]} />
        </View>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={[
          styles.userStatus,
          { color: user.isTyping ? '#25D366' : isOnline ? '#25D366' : '#999' }
        ]}>
          {user.isTyping ? 'typing...' : isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}; 