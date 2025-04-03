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
  Alert,
  Modal,
  ActionSheetIOS,
  PermissionsAndroid
} from 'react-native';
import { fetchMessages, sendMessage, subscribeToUserStatus, EditMessage, deleteMessage, subscribeToMessageDeletion, subscribeToMessageEdit, typeMessageStarted, typeMessageEnded, sendMediaMessage } from '../services/cometChat';
import { User, ChatMessage, CometChatMessage, Reaction } from '../types/index';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import * as ImagePicker from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { 
  updateReactions,
  loadMessages,
  handleSendMessage,
  handleEditMessage,
  handleDeleteMessage,
  handleAddReaction,
  handleRemoveReaction,
  handleCameraPress,
  handleGalleryPress,
  handleAudioPress,
  handleVideoPress,
  handleSendMediaMessage,
  formatMessageTime,
  formatDateHeading,
  markMessagesAsRead
} from './ChatUtils';

interface ChatProps {
  currentUser: User;
  selectedUser: User;
  onBack: () => void;
  userStatuses: { [key: string]: 'online' | 'offline' };
  onUserStatusChange: (uid: string, status: 'online' | 'offline') => void;
}

const Chat: React.FC<ChatProps> = ({ currentUser, selectedUser, onBack, userStatuses, onUserStatusChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [messageOptionsPosition, setMessageOptionsPosition] = useState({ x: 0, y: 0 });
  const flatListRef = useRef<FlatList>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessage | null>(null);
  const reactionListenerRef = useRef<string | null>(null);
  const messageListenerRef = useRef<string | null>(null);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ uri: string; type: string } | null>(null);

  const userStatus = userStatuses[selectedUser.uid] || 'offline';

  useEffect(() => {
    loadMessages(selectedUser, currentUser, setMessages);
    unsubscribeRef.current = subscribeToUserStatus(selectedUser.uid, (status) => {
      if (selectedUser.uid === selectedUser.uid) {
        const updatedStatus = status === 'online' ? 'online' : 'offline';
        if (onUserStatusChange) {
          onUserStatusChange(selectedUser.uid, updatedStatus);
        }
      }
    });

    const typingListenerId = 'chat_typing_listener';
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

    const userStatusListenerId = 'user_status_listener';
    CometChat.addUserListener(
      userStatusListenerId,
      new CometChat.UserListener({
        onUserOnline: (onlineUser: CometChat.User) => {
          if (onlineUser.getUid() === selectedUser.uid) {
            const status = onlineUser.getStatus();
            if (status === 'online') {
              if (onUserStatusChange) {
                onUserStatusChange(selectedUser.uid, 'online');
              }
            }
          }
        },
        onUserOffline: (offlineUser: CometChat.User) => {
          if (offlineUser.getUid() === selectedUser.uid) {
            const status = offlineUser.getStatus();
            if (status === 'offline') {
              if (onUserStatusChange) {
                onUserStatusChange(selectedUser.uid, 'offline');
              }
            }
          }
        }
      })
    );

    const unsubscribeDeletion = subscribeToMessageDeletion((deletedMessage) => {
      const messageId = deletedMessage.getId().toString(); 
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId
            ? { ...msg, text: "This message was deleted" }
            : msg
        )
      );
    });

    const unsubscribeEdit = subscribeToMessageEdit((editedMessage) => {
      setMessages(prevMessages => 
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

    reactionListenerRef.current = 'reaction_listener';
    CometChat.addMessageListener(
      reactionListenerRef.current,
      new CometChat.MessageListener({
        onMessageReactionAdded: (reactionEvent: CometChat.ReactionEvent) => {
          console.log("Reaction added:", reactionEvent.getReaction());
          updateReactions(reactionEvent, CometChat.REACTION_ACTION.REACTION_ADDED, currentUser, setMessages);
        },
        onMessageReactionRemoved: (reactionEvent: CometChat.ReactionEvent) => {
          console.log("Reaction removed:", reactionEvent.getReaction());
          updateReactions(reactionEvent, CometChat.REACTION_ACTION.REACTION_REMOVED, currentUser, setMessages);
        }
      })
    );

    messageListenerRef.current = 'chat_message_listener';
    CometChat.addMessageListener(
      messageListenerRef.current,
      new CometChat.MessageListener({
        onTextMessageReceived: (textMessage: CometChat.TextMessage) => {
          const senderId = textMessage.getSender().getUid();
          const receiver = textMessage.getReceiver() as CometChat.User;
          const receiverId = receiver.getUid();

          if (
            (senderId === selectedUser.uid && receiverId === currentUser.uid) ||
            (senderId === currentUser.uid && receiverId === selectedUser.uid)
          ) {
            if (textMessage.getData().text !== "") {
              const convertedMessage: ChatMessage = {
                id: textMessage.getId().toString(),
                text: textMessage.getText(),
                sender: {
                  uid: textMessage.getSender().getUid(),
                  name: textMessage.getSender().getName(),
                  avatar: textMessage.getSender().getAvatar()
                },
                sentAt: textMessage.getSentAt(),
                type: textMessage.getType(),
                status: 'sent',
                reactions: []
              };
              setMessages(prevMessages => [...prevMessages, convertedMessage]);
            }
          }

          if (receiverId === currentUser.uid) {
            CometChat.markAsDelivered(textMessage).then(() => {
              setMessages(prevMessages =>
                prevMessages.map(msg => {
                  if (msg.id === textMessage.getId().toString()) {
                    return {
                      ...msg,
                      status: 'seen'
                    };
                  }
                  return msg;
                })
              );
            });
          }
        },

        onMediaMessageReceived: (mediaMessage: CometChat.MediaMessage) => {
          const senderId = mediaMessage.getSender().getUid();
          const receiver = mediaMessage.getReceiver() as CometChat.User;
          const receiverId = receiver.getUid();

          if (
            (senderId === selectedUser.uid && receiverId === currentUser.uid) ||
            (senderId === currentUser.uid && receiverId === selectedUser.uid)
          ) {
            const attachment = mediaMessage.getAttachment();
            const convertedMessage: ChatMessage = {
              id: mediaMessage.getId().toString(),
              text: mediaMessage.getType() === CometChat.MESSAGE_TYPE.IMAGE ? 'Image' :
                    mediaMessage.getType() === CometChat.MESSAGE_TYPE.VIDEO ? 'Video' :
                    mediaMessage.getType() === CometChat.MESSAGE_TYPE.AUDIO ? 'Audio' : 'Media',
              sender: {
                uid: mediaMessage.getSender().getUid(),
                name: mediaMessage.getSender().getName(),
                avatar: mediaMessage.getSender().getAvatar()
              },
              sentAt: mediaMessage.getSentAt(),
              type: mediaMessage.getType(),
              status: 'sent',
              reactions: [],
              attachment: attachment ? {
                url: attachment.getUrl(),
                type: attachment.getMimeType(),
                name: attachment.getName()
              } : undefined
            };
            setMessages(prevMessages => [...prevMessages, convertedMessage]);
          }

          if (receiverId === currentUser.uid) {
            CometChat.markAsDelivered(mediaMessage).then(() => {
              setMessages(prevMessages =>
                prevMessages.map(msg => {
                  if (msg.id === mediaMessage.getId().toString()) {
                    return {
                      ...msg,
                      status: 'seen'
                    };
                  }
                  return msg;
                })
              );
            });
          }
        },

        onMessagesDelivered: (messageReceipt: CometChat.MessageReceipt) => {
          const messageId = messageReceipt.getMessageId().toString();
          setMessages(prevMessages =>
            prevMessages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  status: 'delivered'
                };
              }
              return msg;
            })
          );
        },

        onMessagesRead: (messageReceipt: CometChat.MessageReceipt) => {
          const messageId = messageReceipt.getMessageId().toString();
          setMessages(prevMessages =>
            prevMessages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  status: 'seen'
                };
              }
              return msg;
            })
          );
        }
      })
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      unsubscribeDeletion();
      unsubscribeEdit();
      CometChat.removeMessageListener(typingListenerId);
      CometChat.removeUserListener(userStatusListenerId);
      if (reactionListenerRef.current) {
        CometChat.removeMessageListener(reactionListenerRef.current);
      }
      if (messageListenerRef.current) {
        CometChat.removeMessageListener(messageListenerRef.current);
      }
    };
  }, [selectedUser, currentUser.uid, onUserStatusChange]);

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

  const handleAttachmentPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Share Audio', 'Share Video'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleCameraPress(setMediaPreview, handleSendMediaMessageWrapper, setShowAttachmentOptions);
          } else if (buttonIndex === 2) {
            handleGalleryPress(setMediaPreview, handleSendMediaMessageWrapper, setShowAttachmentOptions);
          } else if (buttonIndex === 3) {
            handleAudioPress(handleSendMediaMessageWrapper, setShowAttachmentOptions);
          } else if (buttonIndex === 4) {
            handleVideoPress(setMediaPreview, handleSendMediaMessageWrapper, setShowAttachmentOptions);
          }
        }
      );
    } else {
      setShowAttachmentOptions(!showAttachmentOptions);
    }
  };

  const handleSendMediaMessageWrapper = async (uri: string, type: string, mediaCategory: 'image' | 'video' | 'audio') => {
    await handleSendMediaMessage(uri, type, mediaCategory, selectedUser, setMessages, flatListRef, setMediaPreview);
  };

  const debouncedTypingIndicator = useRef<NodeJS.Timeout | null>(null);
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

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isSentByMe = item.sender.uid === currentUser.uid;
    const messageTime = formatMessageTime(item.sentAt);
    const isEditing = editingMessage?.id === item.id;
    const isDeleted = item.text === "This message was deleted";
    const isEdited = item.editedAt !== undefined;
    const isMediaMessage = item.type === CometChat.MESSAGE_TYPE.IMAGE || 
                          item.type === CometChat.MESSAGE_TYPE.VIDEO || 
                          item.type === CometChat.MESSAGE_TYPE.AUDIO;
  
    const showDateHeading =
      index === 0 ||
      formatDateHeading(item.sentAt) !== formatDateHeading(messages[index - 1].sentAt);
  
    return (
      <>
        {showDateHeading && (
          <View style={styles.dateHeadingContainer}>
            <Text style={styles.dateHeadingText}>
              {formatDateHeading(item.sentAt)}
            </Text>
          </View>
        )}
        <TouchableOpacity
          onLongPress={(event) => handleLongPress(item, event)}
          style={[
            styles.messageWrapper,
            isSentByMe ? styles.sentMessageWrapper : styles.receivedMessageWrapper,
          ]}
        >
          {!isSentByMe && (
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {selectedUser.avatar ? (
                  <Image 
                    source={{ uri: selectedUser.avatar }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.onlineIndicator} />
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
                    onPress={() => handleEditMessage(selectedMessage, editText, setMessages, setEditingMessage, setEditText)} 
                    style={[styles.editButton, styles.saveButton]}
                  >
                    <Text style={styles.editButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {isMediaMessage ? (
                  <View style={styles.mediaContainer}>
                    {item.type === CometChat.MESSAGE_TYPE.IMAGE && item.attachment?.url && (
                      <Image 
                        source={{ uri: item.attachment.url }} 
                        style={styles.imageMessage}
                        resizeMode="cover"
                      />
                    )}
                    {item.type === CometChat.MESSAGE_TYPE.VIDEO && item.attachment?.url && (
                      <View style={styles.videoContainer}>
                        <View style={styles.videoPlaceholder}>
                          <Icon name="videocam-outline" size={40} color="#075E54" />
                        </View>
                        <Icon name="play-circle-outline" size={30} color="#075E54" style={styles.playButton} />
                      </View>
                    )}
                    {item.type === CometChat.MESSAGE_TYPE.AUDIO && item.attachment?.url && (
                      <View style={styles.audioContainer}>
                        <Icon name="musical-notes-outline" size={24} color="#075E54" />
                        <Text style={styles.audioText}>Audio Message</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={[
                    styles.messageText,
                    isDeleted && styles.deletedMessageText
                  ]}>{item.text}</Text>
                )}
                {!isDeleted && (
                  <View style={styles.messageFooter}>
                    <Text style={styles.messageTime}>{messageTime}</Text>
                    {isSentByMe && (
                      <Text style={{ color: item.status === 'seen' ? '#34B7F1' : '#666' }}>
                        {item.status === 'seen' ? '✓✓' : item.status === 'delivered' ? '✓✓' : '✓'}
                      </Text>
                    )}
                    {isEdited && (
                      <Text style={styles.editedText}>edited</Text>
                    )}
                  </View>
                )}
                {renderReactions(item)}
              </>
            )}
          </View>
          {isSentByMe && (
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {currentUser.avatar ? (
                  <Image 
                    source={{ uri: currentUser.avatar }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {currentUser.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.onlineIndicator} />
            </View>
          )}
        </TouchableOpacity>
      </>
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
                handleRemoveReaction(message.id, reaction.emoji, setMessages);
              } else {
                handleAddReaction(message.id, reaction.emoji, setMessages);
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
                onPress={() => handleDeleteMessage(selectedMessage, setMessages)}
              >
                <Text style={[styles.optionText, styles.deleteOption]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
                    handleAddReaction(selectedMessageForReaction.id, emoji, setMessages);
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

  const renderAttachmentOptions = () => (
    <Modal
      visible={showAttachmentOptions}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAttachmentOptions(false)}
    >
      <TouchableOpacity 
        style={styles.attachmentOverlay}
        activeOpacity={1}
        onPress={() => setShowAttachmentOptions(false)}
      >
        <View style={styles.attachmentContainer}>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={() => handleCameraPress(setMediaPreview, handleSendMediaMessageWrapper, setShowAttachmentOptions)}
          >
            {/* <Icon name="camera-outline" size={24} color="#075E54" /> */}
            <Text style={styles.attachmentText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={() => handleGalleryPress(setMediaPreview, handleSendMediaMessageWrapper, setShowAttachmentOptions)}
          >
            {/* <Icon name="images-outline" size={24} color="#075E54" /> */}
            <Text style={styles.attachmentText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={() => handleAudioPress(handleSendMediaMessageWrapper, setShowAttachmentOptions)}
          >
            {/* <Icon name="musical-notes-outline" size={24} color="#075E54" /> */}
            <Text style={styles.attachmentText}>Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={() => handleVideoPress(setMediaPreview, handleSendMediaMessageWrapper, setShowAttachmentOptions)}
          >
            {/* <Icon name="videocam-outline" size={24} color="#075E54" /> */}
            <Text style={styles.attachmentText}>Video</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={styles.header.backgroundColor} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
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
              { backgroundColor: userStatus === 'online' ? '#25D366' : '#ccc' }
            ]}>
              <View style={[
                styles.headerOnlineIndicatorInner,
                { backgroundColor: userStatus === 'online' ? '#fff' : '#f0f0f0' }
              ]} />
            </View>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.chatTitle}>
              {selectedUser.name}
            </Text>
            <Text style={[
              styles.chatSubtitle,
              { color: userStatus === 'online' ? '#25D366' : '#999' }
            ]}>
              {isTyping ? 'typing...' : userStatus === 'online' ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        inverted={false}
      />
      {renderMessageOptions()}
      {renderAttachmentOptions()}
      {renderReactionPicker()}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={handleAttachmentPress}
          >
            {/* <Icon name="add-circle-outline" size={24} color="#128C7E" /> */}
            <Text style={{ fontSize: 20, color: "#128C7E" }}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            value={newMessage}
            onChangeText={(text) => {
              setNewMessage(text);
              handleTyping();
            }}
            onFocus={handleTyping}
            onBlur={handleTypingEnd}
            placeholder="Type a message"
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={() => handleSendMessage(newMessage, selectedUser, currentUser, setMessages, setNewMessage, flatListRef)}
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
    backgroundColor: '#f0f0f0',
    marginTop: Platform.OS === 'android' ? 10:0,
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
  editingMessage: {
    backgroundColor: '#E8F5E9',
  },
  messageText: {
    color: 'black',
    fontSize: 16,
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
    marginRight: 4,
  },
  messageStatus: {
    fontSize: 12,
    color: '#666',
    letterSpacing: -1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginRight: Platform.OS === "android" ? 10 : 0,
    marginLeft: Platform.OS === "android" ? 10 : 0,
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
  deletedMessage: {
    backgroundColor: '#f0f0f0',
    opacity: 0.7,
  },
  deletedMessageText: {
    color: '#666',
    fontStyle: 'italic',
  },
  editedText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 4,
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
  messageContentContainer: {
    maxWidth: '70%',
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
  attachButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  attachmentContainer: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  attachmentOption: {
    alignItems: 'center',
    padding: 10,
  },
  attachmentText: {
    marginTop: 5,
    color: '#075E54',
    fontSize: 12,
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
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  playButton: {
    position: 'absolute',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  audioText: {
    marginLeft: 10,
    color: '#075E54',
    fontSize: 14,
  },
});

export default Chat;