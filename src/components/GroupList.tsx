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
  Platform,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { fetchGroups, joinGroup, fetchUsers } from '../services/cometChat';
import { Group, User } from '../types';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface GroupListProps {
  onGroupSelect: (group: Group) => void;
  onBack: () => void;
  currentUser: User;
}

interface GroupWithUnreadCount extends Group {
  unreadCount: number;
}

const GroupList: React.FC<GroupListProps> = ({ onGroupSelect, onBack, currentUser }) => {
  const [groups, setGroups] = useState<GroupWithUnreadCount[]>([]);
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const messageListenerRef = useRef<string | null>(null);

  useEffect(() => {
    loadGroups();
    loadUsers();
    setupGroupListeners();
    
    return () => {
      if (messageListenerRef.current) {
        CometChat.removeMessageListener(messageListenerRef.current);
      }
    };
  }, []);

  const setupGroupListeners = () => {
    messageListenerRef.current = 'group_list_listener';
    CometChat.addMessageListener(
      messageListenerRef.current,
      new CometChat.MessageListener({
        onTextMessageReceived: async (textMessage: CometChat.TextMessage) => {
          if (textMessage.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP) {
            const receiverId = textMessage.getReceiverId();
            const loggedInUser = await CometChat.getLoggedinUser();

            // Only increment unread count if the message is not from the current user
            if (textMessage.getSender().getUid() !== loggedInUser?.getUid()) {
              setGroups(prevGroups => 
                prevGroups.map(group => 
                  group.guid === receiverId 
                    ? { ...group, unreadCount: group.unreadCount + 1 }
                    : group
                )
              );
            }
          }
        },
        onMediaMessageReceived: async (mediaMessage: CometChat.MediaMessage) => {
          if (mediaMessage.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP) {
            const receiverId = mediaMessage.getReceiverId();
            const loggedInUser = await CometChat.getLoggedinUser();

            // Only increment unread count if the message is not from the current user
            if (mediaMessage.getSender().getUid() !== loggedInUser?.getUid()) {
              setGroups(prevGroups => 
                prevGroups.map(group => 
                  group.guid === receiverId 
                    ? { ...group, unreadCount: group.unreadCount + 1 }
                    : group
                )
              );
            }
          }
        }
      })
    );
  };

  const loadGroups = async () => {
    try {
      const fetchedGroups = await fetchGroups();
      if (Array.isArray(fetchedGroups)) {
        const convertedGroups: GroupWithUnreadCount[] = fetchedGroups.map(group => ({
          guid: group.getGuid(),
          name: group.getName(),
          type: group.getType(),
          description: group.getDescription(),
          owner: group.getOwner(),
          icon: group.getIcon(),
          createdAt: group.getCreatedAt(),
          membersCount: group.getMembersCount(),
          tags: group.getTags() as string[],
          unreadCount: 0
        }));
        setGroups(convertedGroups);
        console.log('Groups:', convertedGroups);
      }
    } catch (error) {
      console.error("Error loading groups:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const fetchedUsers = await fetchUsers();
      if (Array.isArray(fetchedUsers)) {
        const users = fetchedUsers.map(user => ({
          uid: user.getUid(),
          name: user.getName(),
          avatar: user.getAvatar()
        }));
        // Filter out the current user
        const filteredUsers = users.filter(user => user.uid !== currentUser.uid);
        setAvailableUsers(filteredUsers);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinGroupId.trim()) {
      Alert.alert("Error", "Please enter a group ID");
      return;
    }

    try {
      const group = await CometChat.getGroup(joinGroupId.trim());
      
      if (!group) {
        Alert.alert("Error", "Group not found");
        return;
      }
      
      await joinGroup(
        joinGroupId.trim(),
        group.getType() as typeof CometChat.GROUP_TYPE.PUBLIC | typeof CometChat.GROUP_TYPE.PRIVATE | typeof CometChat.GROUP_TYPE.PASSWORD,
        group.getType() === CometChat.GROUP_TYPE.PASSWORD ? joinPassword : undefined
      );

      // Reset form and close modal
      setJoinGroupId('');
      setJoinPassword('');
      setShowJoinGroupModal(false);
      
      // Reload groups
      loadGroups();
      
      Alert.alert("Success", "Joined group successfully");
    } catch (error) {
      console.error("Error joining group:", error);
      Alert.alert("Error", "Failed to join group");
    }
  };

  const handleGroupSelect = (group: GroupWithUnreadCount) => {
    // Reset unread count
    setGroups(prevGroups => 
      prevGroups.map(g => 
        g.guid === group.guid ? { ...g, unreadCount: 0 } : g
      )
    );
    onGroupSelect(group);
  };

  const renderGroup = ({ item }: { item: GroupWithUnreadCount }) => (
    <TouchableOpacity 
      style={styles.groupItem}
      onPress={() => handleGroupSelect(item)}
    >
      <View style={styles.groupAvatar}>
        {item.icon ? (
          <Image 
            source={{ uri: item.icon }} 
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      
      <View style={styles.groupInfo}>
        <View style={styles.nameContainer}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupType}>{item.type === 'public' ? 'Public' : item.type === 'private' ? 'Private' : 'Password'}</Text>
        </View>
        
        {item.description ? (
          <Text style={styles.groupDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : (
          <Text style={styles.groupDescription} numberOfLines={1}>
            {`${item.membersCount || 0} member${(item.membersCount || 0) !== 1 ? 's' : ''}`}
          </Text>
        )}
      </View>
      
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderJoinGroupModal = () => (
    <Modal
      visible={showJoinGroupModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowJoinGroupModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Join Group</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Group ID"
            value={joinGroupId}
            onChangeText={setJoinGroupId}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password (if required)"
            value={joinPassword}
            onChangeText={setJoinPassword}
            secureTextEntry={true}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowJoinGroupModal(false);
                setJoinGroupId('');
                setJoinPassword('');
              }}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.joinCreateButton]}
              onPress={handleJoinGroup}
            >
              <Text style={styles.modalButtonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#075E54" barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={styles.headerSpacer}></View>
      </View>
      
      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptySubText}>Join an existing group</Text>
          <TouchableOpacity
            style={styles.emptyCreateButton}
            onPress={() => setShowJoinGroupModal(true)}
          >
            <Text style={styles.emptyCreateButtonText}>Join Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.guid}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContainer}
        />
      )}
      
      {renderJoinGroupModal()}
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
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSpacer: {
    width: 50, // Same width as backButton to keep title centered
  },
  listContainer: {
    paddingVertical: 5,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE5DD',
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  groupInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 8,
  },
  groupType: {
    fontSize: 12,
    color: '#128C7E',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupDescription: {
    fontSize: 14,
    color: '#757575',
  },
  unreadBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#075E54',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyCreateButton: {
    backgroundColor: '#128C7E',
    padding: 12,
    borderRadius: 4,
  },
  emptyCreateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#075E54',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCE0E0',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#DCE0E0',
  },
  joinCreateButton: {
    backgroundColor: '#128C7E',
  },
  modalButtonText: {
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default GroupList; 