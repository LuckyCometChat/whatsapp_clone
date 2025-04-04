import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  Modal
} from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import { User, ChatMessage } from '../types/index';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { 
  handleSendMessage, 
  formatMessageTime, 
  formatDateHeading,
  convertCometChatMessageToChat
} from './ChatUtils';
import { fetchThreadMessages, sendThreadMessage, subscribeToThreadMessages, sendMediaThreadMessage, subscribeToUserStatus } from '../services/cometChat';

interface ThreadedChatProps {
  currentUser: User;
  selectedUser: User;
  parentMessage: ChatMessage;
  onClose: () => void;
  onThreadUpdate: (messageId: string, threadCount: number) => void;
  userStatuses?: { [key: string]: 'online' | 'offline' };
}

const ThreadedChat: React.FC<ThreadedChatProps> = ({ 
  currentUser, 
  selectedUser, 
  parentMessage, 
  onClose,
  onThreadUpdate,
  userStatuses = {}
}) => {
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [localUserStatuses, setLocalUserStatuses] = useState<{ [key: string]: 'online' | 'offline' }>(
    userStatuses || {}
  );
  const flatListRef = useRef<FlatList>(null);
  const threadListenerRef = useRef<(() => void) | null>(null);
  const statusListenerRefs = useRef<{ [key: string]: (() => void) | null }>({});

  // Track unique users in thread
  const [threadParticipants, setThreadParticipants] = useState<string[]>([]);

  useEffect(() => {
    loadThreadMessages();
    
    // Setup thread message listener
    threadListenerRef.current = subscribeToThreadMessages(parentMessage.id, (message) => {
      try {
        const convertedMessage = convertCometChatMessageToChat(message);
        if (convertedMessage) {
          setThreadMessages(prevMessages => [...prevMessages, convertedMessage]);
          // Update thread count in parent chat
          onThreadUpdate(parentMessage.id, (parentMessage.threadCount || 0) + 1);
          
          // Add sender to participants if not already included
          const senderId = convertedMessage.sender.uid;
          setThreadParticipants(prev => 
            prev.includes(senderId) ? prev : [...prev, senderId]
          );
          
          // Scroll to bottom when new message arrives
          if (flatListRef.current) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      } catch (error) {
        console.error("Error processing thread message:", error);
      }
    });
    
    // Setup user status listener for selected user
    setupUserStatusListener(selectedUser.uid);
    
    return () => {
      if (threadListenerRef.current) {
        threadListenerRef.current();
      }
      
      // Clean up all status listeners
      Object.keys(statusListenerRefs.current).forEach(uid => {
        if (statusListenerRefs.current[uid]) {
          statusListenerRefs.current[uid]();
        }
      });
    };
  }, [parentMessage.id, selectedUser.uid]);

  // Update all statuses if provided from props
  useEffect(() => {
    console.log("userStatuses updated:", userStatuses);
    setLocalUserStatuses(prev => ({...prev, ...userStatuses}));
  }, [userStatuses]);

  // Setup status listeners for new thread participants
  useEffect(() => {
    threadParticipants.forEach(uid => {
      if (uid !== currentUser.uid && !statusListenerRefs.current[uid]) {
        setupUserStatusListener(uid);
      }
    });
  }, [threadParticipants]);

  const setupUserStatusListener = (uid: string) => {
    // Don't setup duplicate listeners
    if (statusListenerRefs.current[uid]) return;
    
    console.log(`Setting up status listener for ${uid}`);
    statusListenerRefs.current[uid] = subscribeToUserStatus(uid, (status) => {
      console.log(`User status changed for ${uid}: ${status}`);
      setLocalUserStatuses(prev => ({
        ...prev,
        [uid]: status
      }));
    });
  };

  const loadThreadMessages = async () => {
    try {
      const fetchedMessages = await fetchThreadMessages(parentMessage.id);
      
      if (!fetchedMessages || !Array.isArray(fetchedMessages) || fetchedMessages.length === 0) {
        console.log("No thread messages to process");
        setThreadMessages([]);
        return;
      }
      
      const convertedMessages: ChatMessage[] = [];
      const participants = new Set<string>();
      
      for (const msg of fetchedMessages as unknown as CometChat.BaseMessage[]) {
        const converted = convertCometChatMessageToChat(msg);
        if (converted) {
          convertedMessages.push(converted);
          // Track unique participants
          participants.add(converted.sender.uid);
        }
      }
      
      // Add parent message sender as participant
      participants.add(parentMessage.sender.uid);
      
      // Convert Set to array and update state
      setThreadParticipants(Array.from(participants).filter(uid => uid !== currentUser.uid));
      
      const sortedMessages = convertedMessages.sort((a, b) => a.sentAt - b.sentAt);
      setThreadMessages(sortedMessages);
      
      // Scroll to bottom of thread
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 200);
    } catch (error) {
      console.error("Error loading thread messages:", error);
    }
  };

  const handleSendThreadMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const sentMessage = await sendThreadMessage(selectedUser.uid, newMessage, parentMessage.id);
      
      if (sentMessage) {
        setThreadMessages(prevMessages => [...prevMessages, sentMessage]);
        setNewMessage('');
        
        // Update thread count in parent chat
        onThreadUpdate(parentMessage.id, (parentMessage.threadCount || 0) + 1);
        
        // Scroll to bottom when new message is sent
        if (flatListRef.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    } catch (error) {
      console.error("Error sending thread message:", error);
    }
  };

  const renderParentMessage = () => {
    const isSentByMe = parentMessage.sender.uid === currentUser.uid;
    const messageTime = formatMessageTime(parentMessage.sentAt);
    const isDeleted = parentMessage.text === "This message was deleted";
    const isEdited = parentMessage.editedAt !== undefined;
    const isMediaMessage = parentMessage.type === CometChat.MESSAGE_TYPE.IMAGE || 
                          parentMessage.type === CometChat.MESSAGE_TYPE.VIDEO || 
                          parentMessage.type === CometChat.MESSAGE_TYPE.AUDIO;

    // Get status for parent message sender
    const senderStatus = isSentByMe ? 'online' : (localUserStatuses[parentMessage.sender.uid] || 'offline');

    return (
      <View style={styles.parentMessageContainer}>
        <Text style={styles.replyingToText}>Replying to</Text>
        <View style={[
          styles.messageWrapper,
          isSentByMe ? styles.sentMessageWrapper : styles.receivedMessageWrapper
        ]}>
          {!isSentByMe && (
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {parentMessage.sender.avatar ? (
                  <Image 
                    source={{ uri: parentMessage.sender.avatar }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {parentMessage.sender.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {/* Only show online indicator for parent message if not current user */}
              {!isSentByMe && (
                <View style={[
                  styles.onlineIndicator,
                  { 
                    backgroundColor: senderStatus === 'online' ? '#25D366' : '#ccc',
                    borderColor: senderStatus === 'online' ? '#f0f0f0' : '#ddd'
                  }
                ]} />
              )}
            </View>
          )}
          <View style={[
            styles.messageContainer,
            isSentByMe ? styles.sentMessage : styles.receivedMessage
          ]}>
            {!isSentByMe && (
              <Text style={styles.senderName}>{parentMessage.sender.name}</Text>
            )}
            
            {isMediaMessage && parentMessage.attachment ? (
              <View style={styles.mediaContainer}>
                {parentMessage.type === CometChat.MESSAGE_TYPE.IMAGE && (
                  <Image 
                    source={{ uri: parentMessage.attachment.url }} 
                    style={styles.imageMessage}
                    resizeMode="cover"
                  />
                )}
                
                {parentMessage.type === CometChat.MESSAGE_TYPE.VIDEO && (
                  <View style={styles.videoContainer}>
                    <Video
                      source={{ uri: parentMessage.attachment.url }}
                      style={styles.videoPlayer}
                      resizeMode="contain"
                      controls={true}
                      paused={true}
                    />
                    <Icon name="play" size={40} color="#fff" style={styles.playButton} />
                  </View>
                )}
              </View>
            ) : (
              <Text style={[
                styles.messageText,
                isDeleted && styles.deletedMessageText
              ]}>
                {parentMessage.text}
                {isEdited && !isDeleted && (
                  <Text style={styles.editedText}> (edited)</Text>
                )}
              </Text>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={styles.messageTime}>{messageTime}</Text>
            </View>
          </View>
          {isSentByMe && (
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {currentUser.avatar ? (
                  <Image source={{ uri: currentUser.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {currentUser.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {/* Don't show status indicator for current user */}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderThreadMessage = ({ item }: { item: ChatMessage }) => {
    const isSentByMe = item.sender.uid === currentUser.uid;
    const messageTime = formatMessageTime(item.sentAt);
    const isDeleted = item.text === "This message was deleted";
    const isEdited = item.editedAt !== undefined;
    const isMediaMessage = item.type === CometChat.MESSAGE_TYPE.IMAGE || 
                          item.type === CometChat.MESSAGE_TYPE.VIDEO || 
                          item.type === CometChat.MESSAGE_TYPE.AUDIO;
                          
    // Get status for the message sender
    const senderStatus = isSentByMe ? 'online' : (localUserStatuses[item.sender.uid] || 'offline');

    return (
      <View style={[
        styles.messageWrapper,
        isSentByMe ? styles.sentMessageWrapper : styles.receivedMessageWrapper
      ]}>
        {!isSentByMe && (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {item.sender.avatar ? (
                <Image source={{ uri: item.sender.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {item.sender.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={[
              styles.onlineIndicator,
              { 
                backgroundColor: senderStatus === 'online' ? '#25D366' : '#ccc',
                borderColor: senderStatus === 'online' ? '#f0f0f0' : '#ddd'
              }
            ]} />
          </View>
        )}
        
        <View style={[
          styles.messageContainer,
          isSentByMe ? styles.sentMessage : styles.receivedMessage,
          isDeleted && styles.deletedMessage
        ]}>
          {!isSentByMe && (
            <Text style={styles.senderName}>{item.sender.name}</Text>
          )}
          
          {isMediaMessage && item.attachment ? (
            <View style={styles.mediaContainer}>
              {item.type === CometChat.MESSAGE_TYPE.IMAGE && (
                <Image 
                  source={{ uri: item.attachment.url }} 
                  style={styles.imageMessage}
                  resizeMode="cover"
                />
              )}
              
              {item.type === CometChat.MESSAGE_TYPE.VIDEO && (
                <View style={styles.videoContainer}>
                  <Video
                    source={{ uri: item.attachment.url }}
                    style={styles.videoPlayer}
                    resizeMode="contain"
                    controls={true}
                    paused={true}
                  />
                  <Icon name="play" size={40} color="#fff" style={styles.playButton} />
                </View>
              )}
            </View>
          ) : (
            <Text style={[
              styles.messageText,
              isDeleted && styles.deletedMessageText
            ]}>
              {item.text}
              {isEdited && !isDeleted && (
                <Text style={styles.editedText}> (edited)</Text>
              )}
            </Text>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{messageTime}</Text>
          </View>
        </View>
        
        {isSentByMe && (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {currentUser.avatar ? (
                <Image source={{ uri: currentUser.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            {/* Don't show status indicator for current user */}
          </View>
        )}
      </View>
    );
  };

  const renderDateSeparator = ({ item, index }: { item: ChatMessage; index: number }) => {
    if (index === 0 || formatDateHeading(item.sentAt) !== formatDateHeading(threadMessages[index - 1].sentAt)) {
      return (
        <View style={styles.dateHeadingContainer}>
          <Text style={styles.dateHeadingText}>{formatDateHeading(item.sentAt)}</Text>
        </View>
      );
    }
    
    return null;
  };

  // Get status for selected user from local statuses
  const selectedUserStatus = localUserStatuses[selectedUser.uid] || 'offline';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#075E54" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderContent}>
          <View style={styles.userAvatar}>
            {selectedUser.avatar ? (
              <Image 
                source={{ uri: selectedUser.avatar }} 
                style={styles.headerAvatarImage}
              />
            ) : (
              <Text style={styles.userAvatarText}>
                {selectedUser.name.charAt(0).toUpperCase()}
              </Text>
            )}
            <View style={[
              styles.headerOnlineIndicator,
              { backgroundColor: selectedUserStatus === 'online' ? '#25D366' : '#ccc' }
            ]}>
              <View style={[
                styles.headerOnlineIndicatorInner,
                { backgroundColor: selectedUserStatus === 'online' ? '#fff' : '#f0f0f0' }
              ]} />
            </View>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.chatTitle}>Thread Reply</Text>
            <Text style={[
              styles.chatSubtitle,
              { color: selectedUserStatus === 'online' ? '#25D366' : '#999' }
            ]}>
              {isTyping ? 'typing...' : selectedUserStatus === 'online' ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
      
      {renderParentMessage()}
      
      <FlatList
        ref={flatListRef}
        data={threadMessages}
        keyExtractor={(item) => item.id}
        renderItem={(props) => (
          <>
            {renderDateSeparator(props)}
            {renderThreadMessage(props)}
          </>
        )}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      <View style={styles.divider} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.chatInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a reply..."
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={handleSendThreadMessage}
            disabled={!newMessage.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4DDD6', // WhatsApp chat background color
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
  header: {
    backgroundColor: '#075E54',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  backButton: {
    marginRight: 10,
    padding: 5,
  },
  backButtonText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '300',
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextContainer: {
    marginLeft: 10,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  chatSubtitle: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  replyingToText: {
    fontSize: 14,
    color: '#075E54',
    fontWeight: 'bold',
    padding: 10,
    paddingBottom: 0
  },
  parentMessageContainer: {
    padding: 10,
    backgroundColor: '#F2F6F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8E9'
  },
  messagesContainer: {
    paddingVertical: 10,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  sentMessageWrapper: {
    justifyContent: 'flex-end',
  },
  receivedMessageWrapper: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginHorizontal: 5,
    position: 'relative',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageContainer: {
    maxWidth: '70%',
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  sentMessage: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 0,
  },
  receivedMessage: {
    backgroundColor: 'white',
    borderTopLeftRadius: 0,
  },
  deletedMessage: {
    backgroundColor: '#f0f0f0',
    opacity: 0.7,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#075E54',
    marginBottom: 2
  },
  messageText: {
    color: 'black',
    fontSize: 16,
  },
  editedText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  deletedMessageText: {
    color: '#666',
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#25D366',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  divider: {
    height: 1,
    backgroundColor: '#D8D8D8',
    width: '100%'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#F6F6F6',
    marginBottom: Platform.OS === "android" ? 20 : 0,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  mediaContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 5,
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  videoContainer: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#1c2227',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  videoPlayer: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  playButton: {
    position: 'absolute',
  },
  dateHeadingContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  dateHeadingText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "bold",
  },
  headerOnlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOnlineIndicatorInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default ThreadedChat; 