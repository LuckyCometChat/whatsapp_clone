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
  Modal,
  Alert
} from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import { User, ChatMessage, Reaction } from '../types/index';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { 
  handleSendMessage, 
  formatMessageTime, 
  formatDateHeading,
  convertCometChatMessageToChat,
  handleEditMessage,
  handleDeleteMessage,
  handleAddReaction,
  handleRemoveReaction,
  updateReactions
} from './ChatUtils';
import { 
  fetchThreadMessages, 
  sendThreadMessage,
  sendGroupThreadMessage, 
  subscribeToThreadMessages, 
  sendMediaThreadMessage,
  sendGroupMediaThreadMessage, 
  subscribeToUserStatus, 
  typeMessageStarted, 
  typeMessageEnded, 
  subscribeToMessageEdit, 
  EditMessage, 
  deleteMessage,
  subscribeToMessageDeletion,
  subscribeToReactions
} from '../services/cometChat';

interface ThreadedChatProps {
  currentUser: User;
  selectedUser: User;
  parentMessage: ChatMessage;
  onClose: () => void;
  onThreadUpdate: (messageId: string, threadCount: number) => void;
  userStatuses?: { [key: string]: 'online' | 'offline' };
  receiverType?: 'user' | 'group';
}

const ThreadedChat: React.FC<ThreadedChatProps> = ({ 
  currentUser, 
  selectedUser, 
  parentMessage, 
  onClose,
  onThreadUpdate,
  userStatuses = {},
  receiverType = 'user'
}) => {
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [localUserStatuses, setLocalUserStatuses] = useState<{ [key: string]: 'online' | 'offline' }>(
    userStatuses || {}
  );
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [messageOptionsPosition, setMessageOptionsPosition] = useState({ x: 0, y: 0 });
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessage | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const threadListenerRef = useRef<(() => void) | null>(null);
  const statusListenerRefs = useRef<{ [key: string]: (() => void) | null }>({});
  const debouncedTypingIndicator = useRef<NodeJS.Timeout | null>(null);
  const reactionListenerRef = useRef<string | null>(null);
  
 
  const [threadParticipants, setThreadParticipants] = useState<string[]>([]);

  useEffect(() => {
    loadThreadMessages();
    
    const listenerID = subscribeToThreadMessages(parentMessage.id, (message) => {
      try {
        const convertedMessage = convertCometChatMessageToChat(message);
        if (convertedMessage) {
          setThreadMessages(prevMessages => [...prevMessages, convertedMessage]);
     
          onThreadUpdate(parentMessage.id, (parentMessage.threadCount || 0) + 1);
          
      
          const senderId = convertedMessage.sender.uid;
          setThreadParticipants(prev => 
            prev.includes(senderId) ? prev : [...prev, senderId]
          );
          
  
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
    
    threadListenerRef.current = listenerID;
    
    setupUserStatusListener(selectedUser.uid);
    
    const typingListenerId = `thread_typing_listener_${parentMessage.id}`;
    CometChat.addMessageListener(
      typingListenerId,
      new CometChat.MessageListener({
        onTypingStarted: (typingIndicator: CometChat.TypingIndicator) => {
          const senderId = typingIndicator.getSender().getUid();
          if (senderId === selectedUser.uid) {
            setIsTyping(true);
          }
        },
        onTypingEnded: (typingIndicator: CometChat.TypingIndicator) => {
          const senderId = typingIndicator.getSender().getUid();
          if (senderId === selectedUser.uid) {
            setIsTyping(false);
          }
        }
      })
    );
    

    const unsubscribeEdit = subscribeToMessageEdit((editedMessage) => {
      setThreadMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === editedMessage.getId().toString()
            ? {
                ...msg,
                text: (editedMessage as CometChat.TextMessage).getText(),
                editedAt: editedMessage.getEditedAt(),
                editedBy: editedMessage.getEditedBy()
              }
            : msg
        )
      );
    });
    

    const unsubscribeDeletion = subscribeToMessageDeletion((deletedMessage) => {
      const messageId = deletedMessage.getId().toString(); 
      

      const isThreadMessage = deletedMessage.getParentMessageId()?.toString() === parentMessage.id;
      
  
      setThreadMessages(prevMessages => {
        const updatedMessages = prevMessages.map(msg => 
          msg.id === messageId
            ? { ...msg, text: "This message was deleted", isDeleted: true }
            : msg
        );
        
 
        const activeMessageCount = updatedMessages.filter(msg => !msg.isDeleted).length;
        

        onThreadUpdate(parentMessage.id, activeMessageCount);
        
        return updatedMessages;
      });
    });
    

    reactionListenerRef.current = 'thread_reaction_listener';
    CometChat.addMessageListener(
      reactionListenerRef.current,
      new CometChat.MessageListener({
        onMessageReactionAdded: (reactionEvent: CometChat.ReactionEvent) => {
          console.log("Thread reaction added:", reactionEvent.getReaction());
          updateReactions(reactionEvent, CometChat.REACTION_ACTION.REACTION_ADDED, currentUser, setThreadMessages);
        },
        onMessageReactionRemoved: (reactionEvent: CometChat.ReactionEvent) => {
          console.log("Thread reaction removed:", reactionEvent.getReaction());
          updateReactions(reactionEvent, CometChat.REACTION_ACTION.REACTION_REMOVED, currentUser, setThreadMessages);
        }
      })
    );
    
    return () => {
      if (threadListenerRef.current) {
        threadListenerRef.current();
      }
      
      Object.keys(statusListenerRefs.current).forEach(uid => {
        if (statusListenerRefs.current[uid]) {
          statusListenerRefs.current[uid]();
        }
      });
      

      CometChat.removeMessageListener(typingListenerId);
      

      unsubscribeEdit();
      unsubscribeDeletion();
      

      if (reactionListenerRef.current) {
        CometChat.removeMessageListener(reactionListenerRef.current);
      }
    };
  }, [parentMessage.id, selectedUser.uid]);

  
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
        
        // Explicitly set thread count to 0 and force parent update
        console.log(`No thread messages found for ${parentMessage.id}, setting count to 0`);
        onThreadUpdate(parentMessage.id, 0); 
        return;
      }
      
      const convertedMessages: ChatMessage[] = [];
      const participants = new Set<string>();
      let deletedCount = 0;
      
      for (const msg of fetchedMessages as unknown as CometChat.BaseMessage[]) {
        const converted = convertCometChatMessageToChat(msg);
        if (converted) {
          // Mark deleted messages and count them
          if (converted.text === "This message was deleted") {
            converted.isDeleted = true;
            deletedCount++;
          }
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
      
      // Count active (non-deleted) messages
      const activeMessageCount = sortedMessages.length - deletedCount;
      console.log(`Loaded ${sortedMessages.length} thread messages, ${deletedCount} deleted, active count: ${activeMessageCount}`);
      
      // Always update thread count in parent chat with current accurate count
      onThreadUpdate(parentMessage.id, activeMessageCount);
      
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
      let sentMessage;
      
      if (receiverType === 'group') {
        sentMessage = await sendGroupThreadMessage(selectedUser.uid, newMessage, parentMessage.id);
      } else {
        sentMessage = await sendThreadMessage(selectedUser.uid, newMessage, parentMessage.id);
      }
      
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

  const handleTyping = () => {
    if (debouncedTypingIndicator.current) {
      clearTimeout(debouncedTypingIndicator.current);
    }
    
    debouncedTypingIndicator.current = setTimeout(async () => {
      try {
        await typeMessageStarted(selectedUser.uid);
      } catch (error) {
        console.error("Error starting typing indicator:", error);
      }
    }, 100);
  };

  const handleTypingEnd = async () => {
    if (debouncedTypingIndicator.current) {
      clearTimeout(debouncedTypingIndicator.current);
      debouncedTypingIndicator.current = null;
    }
    
    try {
      await typeMessageEnded(selectedUser.uid);
    } catch (error) {
      console.error("Error ending typing indicator:", error);
    }
  };

  const handleLongPress = (message: ChatMessage, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMessageOptionsPosition({ x: pageX, y: pageY });
    setSelectedMessage(message);
    setShowMessageOptions(true);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleEditThreadMessage = async () => {
    if (!editingMessage || !editText.trim()) return;
    
    try {
      const editedMessage = await EditMessage(editingMessage.id, editText);
      
      setThreadMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === editingMessage.id
            ? {
                ...msg,
                text: editText,
                editedAt: Date.now()
              }
            : msg
        )
      );
      
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      console.error("Error editing thread message:", error);
    }
  };

  const handleThreadMessageDelete = async (message: ChatMessage) => {
    if (!message) return;
    
    try {
      await deleteMessage(message.id);
      
      setThreadMessages(prevMessages => {
        const updatedMessages = prevMessages.map(msg => 
          msg.id === message.id
            ? { ...msg, text: "This message was deleted", isDeleted: true }
            : msg
        );
        
        // Count active messages (excluding deleted ones)
        const activeMessageCount = updatedMessages.filter(msg => !msg.isDeleted).length;
        
        // Always update the thread count in parent chat with current accurate count
        onThreadUpdate(parentMessage.id, activeMessageCount);
        
        return updatedMessages;
      });
      
      setShowMessageOptions(false);

      // Emit a special call to force update the thread count on both sides
      console.log(`Thread message deleted: ${message.id}, updating parent ${parentMessage.id} count`);
    } catch (error) {
      console.error("Error deleting thread message:", error);
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

  const renderReactions = (message: ChatMessage) => {
    if (!message.reactions || message.reactions.length === 0) return null;

    return (
      <View style={styles.reactionsContainer}>
        {message.reactions.map((reaction, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.reactionBubble,
              reaction.reactedByMe && styles.reactedBubble
            ]}
            onPress={() => {
              if (reaction.reactedByMe) {
                handleRemoveReaction(message.id, reaction.emoji, setThreadMessages);
              } else {
                handleAddReaction(message.id, reaction.emoji, setThreadMessages);
              }
            }}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionCount}>{reaction.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderReactionPicker = () => (
    <Modal
      visible={showReactions}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowReactions(false)}
    >
      <View style={styles.reactionPickerContainer}>
        <View style={styles.reactionPicker}>
          <View style={styles.reactionPickerHeader}>
            <Text style={styles.reactionPickerTitle}>Add Reaction</Text>
            <TouchableOpacity 
              onPress={() => setShowReactions(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.reactionGrid}>
            {['😊', '😂', '👍', '❤️', '😍', '😭', '😅', '😆'].map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reactionOption}
                onPress={() => {
                  if (selectedMessageForReaction) {
                    handleAddReaction(selectedMessageForReaction.id, emoji, setThreadMessages);
                    setShowReactions(false);
                  }
                }}
              >
                <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderThreadMessage = ({ item }: { item: ChatMessage }) => {
    const isSentByMe = item.sender.uid === currentUser.uid;
    const messageTime = formatMessageTime(item.sentAt);
    const isDeleted = item.text === "This message was deleted";
    const isEdited = item.editedAt !== undefined;
    const isMediaMessage = item.type === CometChat.MESSAGE_TYPE.IMAGE || 
                          item.type === CometChat.MESSAGE_TYPE.VIDEO || 
                          item.type === CometChat.MESSAGE_TYPE.AUDIO;
    const isEditing = editingMessage?.id === item.id;
                          
    // Get status for the message sender
    const senderStatus = isSentByMe ? 'online' : (localUserStatuses[item.sender.uid] || 'offline');

    return (
      <TouchableOpacity
        onLongPress={(event) => handleLongPress(item, event)}
        activeOpacity={0.8}
        delayLongPress={200}
        style={[
          styles.messageWrapper,
          isSentByMe ? styles.sentMessageWrapper : styles.receivedMessageWrapper
        ]}
      >
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
          isEditing && styles.editingMessage,
          isDeleted && styles.deletedMessage
        ]}>
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={cancelEdit} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleEditThreadMessage}
                  style={[styles.editButton, styles.saveButton]}
                >
                  <Text style={styles.editButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
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
              
              {renderReactions(item)}
            </>
          )}
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
      </TouchableOpacity>
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

  const renderMessageOptions = () => (
    <Modal
      visible={showMessageOptions}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowMessageOptions(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowMessageOptions(false)}
      >
        <View style={[
          styles.messageOptions,
          {
            top: messageOptionsPosition.y - 100,
            left: messageOptionsPosition.x - 100,
          }
        ]}>
          <TouchableOpacity 
            style={styles.optionButton}
            onPress={() => {
              setShowMessageOptions(false);
              if (selectedMessage) {
                setSelectedMessageForReaction(selectedMessage);
                setShowReactions(true);
              }
            }}
          >
            <Text style={styles.optionText}>React</Text>
          </TouchableOpacity>
          
          {selectedMessage?.sender.uid === currentUser.uid && (
            <>
              <TouchableOpacity 
                style={styles.optionButton}
                onPress={() => {
                  setEditingMessage(selectedMessage);
                  setEditText(selectedMessage.text);
                  setShowMessageOptions(false);
                }}
              >
                <Text style={styles.optionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.optionButton}
                onPress={() => handleThreadMessageDelete(selectedMessage)}
              >
                <Text style={[styles.optionText, styles.deleteOption]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
          
          {/* Add a disabled "Reply in thread" option with an alert explaining why it's not available */}
          <TouchableOpacity 
            style={[styles.optionButton, { opacity: 0.5 }]}
            onPress={() => {
              setShowMessageOptions(false);
              Alert.alert(
                "Nested Threads Not Supported",
                "You cannot create a thread within a thread. Please use the current thread for your replies.",
                [{ text: "OK" }]
              );
            }}
          >
            <Text style={[styles.optionText, { color: '#999' }]}>Reply in thread</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
      
      {renderMessageOptions()}
      {renderReactionPicker()}
      
      <View  />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.chatInput}
            value={newMessage}
            onChangeText={(text) => {
              setNewMessage(text);
              handleTyping();
            }}
            onFocus={handleTyping}
            onBlur={handleTypingEnd}
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
    backgroundColor: '#E4DDD6', 
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
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
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

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  messageOptions: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#075E54',
  },
  deleteOption: {
    color: '#FF3B30',
  },
  editingMessage: {
    backgroundColor: '#E8F5E9',
  },
  editContainer: {
    width: '100%',
  },
  editInput: {
    color: 'black',
    fontSize: 16,
    padding: 0,
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#25D366',
  },
  editButtonText: {
    color: '#075E54',
    fontSize: 14,
    fontWeight: '500',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  reactedBubble: {
    backgroundColor: '#e3f2fd',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
  },
  reactionPickerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  reactionPicker: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  reactionPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  reactionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  reactionOption: {
    padding: 8,
    margin: 4,
  },
  reactionOptionEmoji: {
    fontSize: 24,
  },
  reactionPickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#075E54',
  },
});

export default ThreadedChat; 