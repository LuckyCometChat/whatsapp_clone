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

  const updateReactions = async (
    reactionEvent: CometChat.ReactionEvent,
    action: CometChat.REACTION_ACTION
  ) => {
    try {
      if (!reactionEvent) return;
      
      const reaction = reactionEvent.getReaction();
      if (!reaction) return;
      
      const messageId = reaction.getMessageId();
      if (!messageId) return;

      setMessages((prevMessages) => {
        const updatedMessages = prevMessages.map((msg) => {
          if (msg.id === messageId.toString()) {
            try {
              const currentReactions = msg.reactions || [];
              
              // Get the user who reacted
              const reactedBy = reaction.getReactedBy();
              const reactedByMe = reactedBy && currentUser && reactedBy === currentUser.uid;
              
              const newReaction = {
                emoji: reaction.getReaction(),
                count: 1, 
                reactedByMe: reactedByMe || false
              };

              let updatedReactions;
              if (action === CometChat.REACTION_ACTION.REACTION_ADDED) {
                const existingIndex = currentReactions.findIndex(r => r.emoji === newReaction.emoji);
                if (existingIndex >= 0) {
                  updatedReactions = [...currentReactions];
                  updatedReactions[existingIndex] = {
                    ...updatedReactions[existingIndex],
                    count: updatedReactions[existingIndex].count + 1,
                    reactedByMe: true
                  };
                } else {
                  updatedReactions = [...currentReactions, newReaction];
                }
              } else {
                updatedReactions = currentReactions.map(r => {
                  if (r.emoji === newReaction.emoji) {
                    return {
                      ...r,
                      count: Math.max(0, r.count - 1),
                      reactedByMe: false
                    };
                  }
                  return r;
                }).filter(r => r.count > 0);
              }

              return {
                ...msg,
                reactions: updatedReactions
              };
            } catch (error) {
              console.error("Error updating message reactions:", error);
              return msg;
            }
          }
          return msg;
        });

        return updatedMessages;
      });
    } catch (error) {
      console.error("Error processing reaction event:", error);
    }
  };

  useEffect(() => {
    loadMessages();
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
          updateReactions(reactionEvent, CometChat.REACTION_ACTION.REACTION_ADDED);
        },
        onMessageReactionRemoved: (reactionEvent: CometChat.ReactionEvent) => {
          console.log("Reaction removed:", reactionEvent.getReaction());
          updateReactions(reactionEvent, CometChat.REACTION_ACTION.REACTION_REMOVED);
        }
      })
    );

    messageListenerRef.current = 'chat_message_listener';
    CometChat.addMessageListener(
      messageListenerRef.current,
      new CometChat.MessageListener({
        onTextMessageReceived: (textMessage: CometChat.TextMessage) => {
          try {
            if (!textMessage) return;
            
            const senderId = textMessage.getSender()?.getUid();
            if (!senderId) return;
            
            const receiver = textMessage.getReceiver() as CometChat.User;
            if (!receiver) return;
            
            const receiverId = receiver.getUid();
            if (!receiverId) return;

            if (
              (senderId === selectedUser.uid && receiverId === currentUser.uid) ||
              (senderId === currentUser.uid && receiverId === selectedUser.uid)
            ) {
              const messageText = textMessage.getText() || "";
              if (messageText !== "") {
                const convertedMessage: ChatMessage = {
                  id: textMessage.getId().toString(),
                  text: messageText,
                  sender: {
                    uid: senderId,
                    name: textMessage.getSender()?.getName() || '',
                    avatar: textMessage.getSender()?.getAvatar() || ''
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
              try {
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
              } catch (error) {
                console.error("Error marking message as delivered:", error);
              }
            }
          } catch (error) {
            console.error("Error processing text message:", error);
          }
        },

        onMediaMessageReceived: (mediaMessage: CometChat.MediaMessage) => {
          try {
            if (!mediaMessage) return;
            
            const senderId = mediaMessage.getSender()?.getUid();
            if (!senderId) return;
            
            const receiver = mediaMessage.getReceiver() as CometChat.User;
            if (!receiver) return;
            
            const receiverId = receiver.getUid();
            if (!receiverId) return;

            if (
              (senderId === selectedUser.uid && receiverId === currentUser.uid) ||
              (senderId === currentUser.uid && receiverId === selectedUser.uid)
            ) {
              // Handle different media types
              let text = '';
              let attachment = undefined;

              if (mediaMessage.getType() === CometChat.MESSAGE_TYPE.IMAGE) {
                text = 'Image';
                const mediaAttachment = mediaMessage.getAttachment();
                if (mediaAttachment) {
                  attachment = {
                    url: mediaAttachment.getUrl(),
                    type: mediaAttachment.getMimeType(),
                    name: 'image.jpg'
                  };
                }
              } else if (mediaMessage.getType() === CometChat.MESSAGE_TYPE.VIDEO) {
                text = 'Video';
                const mediaAttachment = mediaMessage.getAttachment();
                if (mediaAttachment) {
                  attachment = {
                    url: mediaAttachment.getUrl(),
                    type: mediaAttachment.getMimeType(),
                    name: 'video.mp4'
                  };
                }
              } else if (mediaMessage.getType() === CometChat.MESSAGE_TYPE.AUDIO) {
                text = 'Audio';
                const mediaAttachment = mediaMessage.getAttachment();
                if (mediaAttachment) {
                  attachment = {
                    url: mediaAttachment.getUrl(),
                    type: mediaAttachment.getMimeType(),
                    name: 'audio.mp3'
                  };
                }
              }

              const convertedMessage: ChatMessage = {
                id: mediaMessage.getId().toString(),
                text: text,
                sender: {
                  uid: senderId,
                  name: mediaMessage.getSender()?.getName() || '',
                  avatar: mediaMessage.getSender()?.getAvatar() || ''
                },
                sentAt: mediaMessage.getSentAt(),
                type: mediaMessage.getType(),
                status: 'sent',
                attachment: attachment,
                reactions: []
              };
              setMessages(prevMessages => [...prevMessages, convertedMessage]);
            }

            if (receiverId === currentUser.uid) {
              try {
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
              } catch (error) {
                console.error("Error marking media message as delivered:", error);
              }
            }
          } catch (error) {
            console.error("Error processing media message:", error);
          }
        },

        onMessagesDelivered: (messageReceipt: CometChat.MessageReceipt) => {
          try {
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
          } catch (error) {
            console.error("Error processing message delivery receipt:", error);
          }
        },

        onMessagesRead: (messageReceipt: CometChat.MessageReceipt) => {
          try {
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
          } catch (error) {
            console.error("Error processing message read receipt:", error);
          }
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
      CometChat.removeMessageListener(reactionListenerRef.current);
    };
  }, [selectedUser, currentUser.uid, onUserStatusChange]);

  const loadMessages = async () => {
    try {
      const fetchedMessages = await fetchMessages(selectedUser.uid);
      
      if (!fetchedMessages || fetchedMessages.length === 0) {
        setMessages([]);
        return;
      }

      const convertedMessages: ChatMessage[] = (fetchedMessages as unknown as CometChat.BaseMessage[])
        .filter(msg => msg && (msg as any).getCategory?.() !== "action")
        .map(msg => {
          if (!msg) return null;
          
          const isDeleted = (msg as any).getDeletedAt?.() !== undefined;
          const editedAt = (msg as any).getEditedAt?.();
          const editedBy = (msg as any).getEditedBy?.();
          const readAt = (msg as any).getReadAt?.();
          const deliveredAt = (msg as any).getDeliveredAt?.();
          let status: 'sent' | 'delivered' | 'seen' = 'sent';
          
          if (deliveredAt) {
            status = 'delivered';
          }
          if (readAt) {
            status = 'seen';
          }

          // Handle different message types
          let text = '';
          let attachment = undefined;

          try {
            if (msg.getType() === CometChat.MESSAGE_TYPE.TEXT) {
              text = (msg as CometChat.TextMessage).getText() || '';
            } else if (msg.getType() === CometChat.MESSAGE_TYPE.IMAGE) {
              text = 'Image';
              const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment();
              if (mediaAttachment) {
                attachment = {
                  url: mediaAttachment.getUrl(),
                  type: mediaAttachment.getMimeType(),
                  name: 'image.jpg'
                };
              }
            } else if (msg.getType() === CometChat.MESSAGE_TYPE.VIDEO) {
              text = 'Video';
              const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment();
              if (mediaAttachment) {
                attachment = {
                  url: mediaAttachment.getUrl(),
                  type: mediaAttachment.getMimeType(),
                  name: 'video.mp4'
                };
              }
            } else if (msg.getType() === CometChat.MESSAGE_TYPE.AUDIO) {
              text = 'Audio';
              const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment();
              if (mediaAttachment) {
                attachment = {
                  url: mediaAttachment.getUrl(),
                  type: mediaAttachment.getMimeType(),
                  name: 'audio.mp3'
                };
              }
            }
          } catch (error) {
            console.error("Error processing message type:", error);
            text = 'Unsupported message';
          }
          
          return {
            id: msg.getId().toString(),
            text: isDeleted ? "This message was deleted" : text,
            sender: {
              uid: msg.getSender()?.getUid() || '',
              name: msg.getSender()?.getName() || '',
              avatar: msg.getSender()?.getAvatar() || ''
            },
            sentAt: msg.getSentAt() || Date.now(),
            type: msg.getType() || 'text',
            status: status,
            editedAt: editedAt,
            editedBy: editedBy,
            attachment: attachment,
            reactions: (msg as any).getReactions?.()?.map((reaction: any) => ({
              emoji: reaction.getReaction(),
              count: reaction.getCount(),
              reactedByMe: reaction.getReactedByMe()
            })) || []
          };
        })
        .filter(msg => msg !== null) as ChatMessage[];

      const sortedMessages = convertedMessages.sort((a, b) => a.sentAt - b.sentAt);
      setMessages(sortedMessages);

      if (convertedMessages.length > 0 && fetchedMessages.length > 0) {
        try {
          const lastMessage = fetchedMessages[fetchedMessages.length - 1];
          if (lastMessage) {
            await CometChat.markAsDelivered(lastMessage);
          }
        } catch (error) {
          console.error("Error marking message as delivered:", error);
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await typeMessageEnded(selectedUser.uid);
      
      const sentMessage = await sendMessage(selectedUser.uid, newMessage);
      const cometChatMessage = sentMessage as unknown as CometChatMessage;
      const convertedMessage: ChatMessage = {
        id: cometChatMessage.id,
        text: cometChatMessage.text,
        sender: {
          uid: cometChatMessage.sender.uid,
          name: cometChatMessage.sender.name,
          avatar: cometChatMessage.sender.avatar
        },
        sentAt: cometChatMessage.sentAt,
        type: cometChatMessage.type,
        status: 'sent',
        reactions: (cometChatMessage as any).getReactions?.()?.map((reaction: any) => ({
          emoji: reaction.getReaction(),
          count: reaction.getCount(),
          reactedByMe: reaction.getReactedByMe()
        })) || []
      };
      setMessages(prevMessages => [...prevMessages, convertedMessage]);
      setNewMessage('');
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleLongPress = (message: ChatMessage, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMessageOptionsPosition({ x: pageX, y: pageY });
    setSelectedMessage(message);
    setShowMessageOptions(true);
  };

  const handleEditMessage = async () => {
    if (!selectedMessage) return;
    try {
      setEditingMessage(selectedMessage);
      setEditText(selectedMessage.text);
      setShowMessageOptions(false);
      console.log("Editing message:", selectedMessage);
    } catch (error) {
      console.error("Error preparing edit:", error);
      Alert.alert(
        "Error",
        "Failed to prepare message for editing. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMessage(selectedMessage.id);
              setMessages(prevMessages => 
                prevMessages.map(msg => 
                  msg.id === selectedMessage.id 
                    ? { ...msg, text: "This message was deleted" }
                    : msg
                )
              );
              setShowMessageOptions(false);
              Alert.alert("Success", "Message deleted successfully");
            } catch (error: any) {
              console.error("Error deleting message:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to delete message. Please try again.",
                [{ text: "OK" }]
              );
            }
          }
        }
      ]
    );
  };

  const handleEditSubmit = async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      const editedMessage = await EditMessage(editingMessage.id, editText);
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === editingMessage.id ? editedMessage : msg
        )
      );
      setEditingMessage(null);
      setEditText('');
      Alert.alert("Success", "Message edited successfully");
    } catch (error: any) {
      console.error("Error editing message:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to edit message. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDateHeading = (timestamp: number) => {
    const messageDate = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
  
    if (
      messageDate.getDate() === today.getDate() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getFullYear() === today.getFullYear()
    ) {
      return "Today";
    } else if (
      messageDate.getDate() === yesterday.getDate() &&
      messageDate.getMonth() === yesterday.getMonth() &&
      messageDate.getFullYear() === yesterday.getFullYear()
    ) {
      return "Yesterday";
    } else {
      return messageDate.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
      });
    }
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
                onPress={handleEditMessage}
              >
                <Text style={styles.optionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.optionButton}
                onPress={handleDeleteMessage}
              >
                <Text style={[styles.optionText, styles.deleteOption]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await CometChat.addReaction(messageId, emoji);
      
  
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || [];
            const existingIndex = currentReactions.findIndex(r => r.emoji === emoji);
            
            if (existingIndex >= 0) {
              const updatedReactions = [...currentReactions];
              updatedReactions[existingIndex] = {
                ...updatedReactions[existingIndex],
                count: updatedReactions[existingIndex].count + 1,
                reactedByMe: true
              };
              return { ...msg, reactions: updatedReactions };
            } else {
              return {
                ...msg,
                reactions: [...currentReactions, { emoji, count: 1, reactedByMe: true }]
              };
            }
          }
          return msg;
        })
      );
      
      setShowReactions(false);
    } catch (error) {
      console.error("Error adding reaction:", error);
      Alert.alert("Error", "Failed to add reaction. Please try again.");
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
      await CometChat.removeReaction(messageId, emoji);
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || [];
            const updatedReactions = currentReactions.map(r => {
              if (r.emoji === emoji) {
                return {
                  ...r,
                  count: Math.max(0, r.count - 1),
                  reactedByMe: false
                };
              }
              return r;
            }).filter(r => r.count > 0);
            
            return { ...msg, reactions: updatedReactions };
          }
          return msg;
        })
      );
    } catch (error) {
      console.error("Error removing reaction:", error);
      Alert.alert("Error", "Failed to remove reaction. Please try again.");
    }
  };

  const handleReactionPress = (message: ChatMessage) => {
    setSelectedMessageForReaction(message);
    setShowReactions(true);
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
                handleRemoveReaction(message.id, reaction.emoji);
              } else {
                handleAddReaction(message.id, reaction.emoji);
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
                    handleAddReaction(selectedMessageForReaction.id, emoji);
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

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera Permission",
            message: "This app needs access to your camera to take photos.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permissions through the image picker
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Storage Permission",
            message: "This app needs access to your storage to select media.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permissions through the image picker
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
            handleCameraPress();
          } else if (buttonIndex === 2) {
            handleGalleryPress();
          } else if (buttonIndex === 3) {
            handleAudioPress();
          } else if (buttonIndex === 4) {
            handleVideoPress();
          }
        }
      );
    } else {
      setShowAttachmentOptions(!showAttachmentOptions);
    }
  };

  const handleCameraPress = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Cannot access camera');
      return;
    }

    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
      includeBase64: false,
      saveToPhotos: true,
      quality: 0.8,
    };

    ImagePicker.launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.errorCode) {
        console.log('Camera Error: ', response.errorMessage);
      } else if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        const uri = response.assets[0].uri;
        const type = response.assets[0].type || 'image/jpeg';
        setMediaPreview({ uri, type });
        handleSendMediaMessage(uri, type, 'image');
        setShowAttachmentOptions(false);
      }
    });
  };

  const handleGalleryPress = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Cannot access photos');
      return;
    }

    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: false,
      quality: 0.8,
    };

    ImagePicker.launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled gallery');
      } else if (response.errorCode) {
        console.log('Gallery Error: ', response.errorMessage);
      } else if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        const uri = response.assets[0].uri;
        const type = response.assets[0].type || 'image/jpeg';
        setMediaPreview({ uri, type });
        handleSendMediaMessage(uri, type, 'image');
        setShowAttachmentOptions(false);
      }
    });
  };

  const handleAudioPress = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Cannot access files');
      return;
    }

    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.audio],
      });
      
      const file = result[0];
      handleSendMediaMessage(file.uri, file.type || 'audio/mpeg', 'audio');
      setShowAttachmentOptions(false);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled document picker');
      } else {
        console.error('Error selecting audio:', err);
      }
    }
  };

  const handleVideoPress = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Cannot access videos');
      return;
    }

    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'video',
      includeBase64: false,
      quality: 0.8,
    };

    ImagePicker.launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled video selection');
      } else if (response.errorCode) {
        console.log('Video Selection Error: ', response.errorMessage);
      } else if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        const uri = response.assets[0].uri;
        const type = response.assets[0].type || 'video/mp4';
        setMediaPreview({ uri, type });
        handleSendMediaMessage(uri, type, 'video');
        setShowAttachmentOptions(false);
      }
    });
  };

  const handleSendMediaMessage = async (uri: string, type: string, mediaCategory: 'image' | 'video' | 'audio') => {
    try {
      if (!uri || !type) {
        console.error("Invalid media file: missing URI or type");
        return;
      }
      
      // Extract filename from uri
      const uriParts = uri.split('/');
      const fileName = uriParts[uriParts.length - 1] || `${mediaCategory}.${type.split('/')[1] || 'file'}`;
      
      let messageType: typeof CometChat.MESSAGE_TYPE.IMAGE | 
                        typeof CometChat.MESSAGE_TYPE.VIDEO | 
                        typeof CometChat.MESSAGE_TYPE.AUDIO;
                        
      switch (mediaCategory) {
        case 'image':
          messageType = CometChat.MESSAGE_TYPE.IMAGE;
          break;
        case 'video':
          messageType = CometChat.MESSAGE_TYPE.VIDEO;
          break;
        case 'audio':
          messageType = CometChat.MESSAGE_TYPE.AUDIO;
          break;
        default:
          messageType = CometChat.MESSAGE_TYPE.IMAGE;
      }
      
      const mediaFile = {
        uri,
        type,
        name: fileName
      };
      
      const sentMessage = await sendMediaMessage(selectedUser.uid, mediaFile, messageType);
      if (sentMessage) {
        setMessages(prevMessages => [...prevMessages, sentMessage]);
        flatListRef.current?.scrollToEnd({ animated: true });
      }
      
      // Clear the media preview
      setMediaPreview(null);
    } catch (error) {
      console.error("Error sending media message:", error);
      Alert.alert("Error", "Failed to send media message. Please try again.");
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
                  <TouchableOpacity onPress={handleEditSubmit} style={[styles.editButton, styles.saveButton]}>
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
                          <Icon name="videocam" size={40} color="#075E54" />
                        </View>
                        <Icon name="play-circle" size={30} color="#075E54" style={styles.playButton} />
                      </View>
                    )}
                    {item.type === CometChat.MESSAGE_TYPE.AUDIO && item.attachment?.url && (
                      <View style={styles.audioContainer}>
                        <Icon name="musical-note" size={24} color="#075E54" />
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
                     <Text style={{ color: item.status === 'seen'  ? '#34B7F1' : '#666' }}>
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

  const markMessagesAsRead = async () => {
    try {
      const unreadMessages = messages.filter(
        msg => msg.sender.uid !== currentUser.uid && msg.status !== 'seen'
      );

      for (const msg of unreadMessages) {
        await CometChat.markAsRead(msg.id);
        setMessages(prevMessages =>
          prevMessages.map(message => {
            if (message.id === msg.id) {
              return {
                ...message,
                status: 'seen'
              };
            }
            return message;
          })
        );
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

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
            onPress={handleCameraPress}
          >
            <Icon name="camera" size={24} color="#075E54" />
            <Text style={styles.attachmentText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={handleGalleryPress}
          >
            <Icon name="image" size={24} color="#075E54" />
            <Text style={styles.attachmentText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={handleAudioPress}
          >
            <Icon name="musical-note" size={24} color="#075E54" />
            <Text style={styles.attachmentText}>Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={handleVideoPress}
          >
            <Icon name="videocam" size={24} color="#075E54" />
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
            <Icon name="attach" size={24} color="#128C7E" />
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
            onPress={handleSendMessage}
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