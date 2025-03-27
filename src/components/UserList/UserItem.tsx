import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { UserWithStatus } from '../../types/userList.types';
import { styles } from './styles';

interface UserItemProps {
  user: UserWithStatus;
  onPress: (user: UserWithStatus) => void;
}

export const UserItem: React.FC<UserItemProps> = ({ user, onPress }) => (
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
        { backgroundColor: user.status === 'online' ? '#25D366' : '#ccc' }
      ]}>
        <View style={[
          styles.onlineIndicatorInner,
          { backgroundColor: user.status === 'online' ? '#fff' : '#f0f0f0' }
        ]} />
      </View>
    </View>
    <View style={styles.userInfo}>
      <Text style={styles.userName}>{user.name}</Text>
      <Text style={[
        styles.userStatus,
        { color: user.status === 'online' ? '#25D366' : '#999' }
      ]}>
        {user.status === 'online' ? 'Online' : 'Offline'}
      </Text>
    </View>
  </TouchableOpacity>
); 