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
  ScrollView,
  ActivityIndicator,
  ActionSheetIOS,
  PermissionsAndroid
} from 'react-native';
import {
  fetchGroupMessages,
  sendGroupMessage,
  editGroupMessage,
  deleteMessage,
  subscribeToMessageDeletion,
  subscribeToMessageEdit,
  subscribeToReactions,
  typeGroupMessageStarted,
  typeGroupMessageEnded,
  sendGroupMediaMessage,
  fetchGroupMembers,
  subscribeToGroupMessages,
  subscribeToGroupTyping,
  getMessageById,
  updateMessage,
  addReactionToMessage,
  removeReactionFromMessage,
  leaveGroup,
  deleteGroup,
  removeMembersFromGroup,
  addMembersToGroup,
  subscribeToGroupEvents,
  fetchUsers
} from '../services/cometChat';
import { Group, User, ChatMessage, GroupMember } from '../types';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import * as ImagePicker from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import Video from 'react-native-video';

interface GroupChatProps {
  currentUser: User;
  selectedGroup: Group;
  onBack: () => void;
}

// Define a local message type that extends ChatMessage
interface LocalChatMessage extends ChatMessage {
  isLocalOnly?: boolean;
}

const GroupChat: React.FC<GroupChatProps> = ({ currentUser, selectedGroup, onBack }) => {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [messageOptionsPosition, setMessageOptionsPosition] = useState({ x: 0, y: 0 });
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessage | null>(null);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ uri: string; type: string } | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPicking, setIsPicking] = useState<boolean>(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [memberToKick, setMemberToKick] = useState<GroupMember | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [confirmationAction, setConfirmationAction] = useState<'leave' | 'delete' | 'kick' | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageListenerRef = useRef<string | null>(null);
  const typingListenerRef = useRef<() => void | null>(null);
  const deletionListenerRef = useRef<() => void | null>(null);
  const editListenerRef = useRef<() => void | null>(null);
  const reactionListenerRef = useRef<() => void | null>(null);
  const groupEventsListenerRef = useRef<() => void | null>(null);

  useEffect(() => {
    loadMessages();
    loadGroupMembers();
    setupMessageListeners();
    
    return () => {
      if (messageListenerRef.current) {
        CometChat.removeMessageListener(messageListenerRef.current);
      }
      if (typingListenerRef.current) typingListenerRef.current();
      if (deletionListenerRef.current) deletionListenerRef.current();
      if (editListenerRef.current) editListenerRef.current();
      if (reactionListenerRef.current) reactionListenerRef.current();
      if (groupEventsListenerRef.current) groupEventsListenerRef.current();
    };
  }, [selectedGroup.guid]);

  useEffect(() => {
    console.log("CometChat API methods check");
    import('../services/cometChat').then(cometChatService => {
      console.log("CometChat service methods available:", {
        getMessageById: !!cometChatService.getMessageById,
        updateMessage: !!cometChatService.updateMessage
      });
    });
  }, []);

  const loadMessages = async () => {
    try {
      const fetchedMessages = await fetchGroupMessages(selectedGroup.guid);
      
      if (Array.isArray(fetchedMessages)) {
        const filteredMessages = fetchedMessages.filter(message => {
          try {
            if ((message as any).getCategory && (message as any).getCategory() === "action") {
              console.log("Skipping action message");
              return false;
            }
            return true;
          } catch (error) {
            console.error("Error checking message category:", error);
            return true;
          }
        });
        
        const formattedMessages: LocalChatMessage[] = filteredMessages.map(message => {
          let metadata;
          try {
            if ((message as any).getMetadata && typeof (message as any).getMetadata === 'function') {
              metadata = (message as any).getMetadata();
              console.log(`Message ${message.getId()} metadata:`, metadata);
            } else if ((message as any).metadata) {
              metadata = (message as any).metadata;
              console.log(`Message ${message.getId()} direct metadata:`, metadata);
            }
          } catch (error) {
            console.log("Error getting metadata:", error);
            metadata = undefined;
          }
          
          const reactions = metadata?.reactions;
          
          let formattedReactions: {emoji: string; count: number; reactedByMe: boolean}[] = [];
          
          if (reactions && typeof reactions === 'object') {
            try {
              formattedReactions = Object.entries(reactions).map(([emoji, users]) => {
                console.log(`Processing reaction ${emoji} with users:`, users);
                const userObj = users as Record<string, any>;
                
          
                const reactedByMe = Object.keys(userObj).includes(currentUser.uid);
                
                return {
                  emoji,
                  count: Object.keys(userObj).length,
                  reactedByMe: reactedByMe
                };
              });
              
              console.log(`Formatted ${formattedReactions.length} reactions for message ${message.getId()}`);
            } catch (error) {
              console.error(`Error formatting reactions for message ${message.getId()}:`, error);
            }
          }
          
          let attachment;
          try {
            if (message.getType() !== CometChat.MESSAGE_TYPE.TEXT) {
              const mediaMessage = message as CometChat.MediaMessage;
              if (mediaMessage.getAttachment && typeof mediaMessage.getAttachment === 'function') {
                const attachmentObj = mediaMessage.getAttachment();
                if (attachmentObj) {
                  attachment = {
                    url: attachmentObj.getUrl(),
                    type: attachmentObj.getMimeType(),
                    name: attachmentObj.getName()
                  };
                }
              }
            }
          } catch (error) {
            console.error("Error processing attachment:", error);
          }
          
          // Check for deleted messages
          const isDeleted = (message as any).getDeletedAt && (message as any).getDeletedAt();
          
          // Properly check for message status
          let status: 'sent' | 'delivered' | 'seen' = 'sent';
          try {
            if ((message as any).getDeliveredAt && (message as any).getDeliveredAt()) {
              status = 'delivered';
            }
            if ((message as any).getReadAt && (message as any).getReadAt()) {
              status = 'seen';
            }
          } catch (error) {
            console.log("Error getting message status:", error);
          }
          
          return {
            id: message.getId().toString(),
            text: isDeleted 
              ? "This message was deleted"
              : message.getType() === CometChat.MESSAGE_TYPE.TEXT 
                ? (message as CometChat.TextMessage).getText() 
                : message.getType().charAt(0).toUpperCase() + message.getType().slice(1),
            sender: {
              uid: message.getSender().getUid(),
              name: message.getSender().getName(),
              avatar: message.getSender().getAvatar()
            },
            sentAt: message.getSentAt(),
            type: message.getType(),
            status: status,
            reactions: formattedReactions,
            attachment: attachment,
            isDeleted: isDeleted,
            editedAt: (message as any).getEditedAt ? (message as any).getEditedAt() : undefined,
            editedBy: (message as any).getEditedBy ? (message as any).getEditedBy() : undefined
          };
        });
        
        setMessages(formattedMessages);
        
        // Scroll to the bottom
        if (flatListRef.current && formattedMessages.length > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 200);
        }
      }
    } catch (error) {
      console.error("Error loading group messages:", error);
      Alert.alert("Error", "Failed to load messages. Please try again.");
    }
  };
  
  const loadGroupMembers = async () => {
    try {
      const fetchedMembers = await fetchGroupMembers(selectedGroup.guid);
      
      if (Array.isArray(fetchedMembers)) {
        const members: GroupMember[] = fetchedMembers.map(member => ({
          uid: member.getUid(),
          name: member.getName(),
          avatar: member.getAvatar(),
          scope: member.getScope(),
          joinedAt: member.getJoinedAt()
        }));
        console.log("Fetched group members:", members);
        
        // Check if current user is admin
        const currentMember = members.find(member => member.uid === currentUser.uid);
        setIsAdmin(
          currentMember?.scope === CometChat.GROUP_MEMBER_SCOPE.ADMIN || 
          currentUser.uid === selectedGroup.owner
        );
        
        setGroupMembers(members);
      }
    } catch (error) {
      console.error("Error loading group members:", error);
    }
  };
  
  const setupMessageListeners = () => {
    // Set up typing indicators
    typingListenerRef.current = subscribeToGroupTyping(selectedGroup.guid, (user, isTyping) => {
      if (isTyping) {
        setTypingUsers(prev => {
          if (!prev.some(u => u.uid === user.getUid())) {
            return [...prev, {
              uid: user.getUid(),
              name: user.getName(),
              avatar: user.getAvatar()
            }];
          }
          return prev;
        });
      } else {
        setTypingUsers(prev => prev.filter(u => u.uid !== user.getUid()));
      }
    });

    // Set up message deletion listener
    deletionListenerRef.current = subscribeToMessageDeletion((deletedMessage) => {
      // Skip if not for this group
      if (
        deletedMessage.getReceiverType() !== CometChat.RECEIVER_TYPE.GROUP || 
        deletedMessage.getReceiverId() !== selectedGroup.guid
      ) {
        return;
      }
      
      const messageId = deletedMessage.getId().toString();
      console.log("Message deleted in group:", messageId);
      
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId
            ? { ...msg, text: "This message was deleted", isDeleted: true }
            : msg
        )
      );
    });

    // Improved edit listener for real-time updates
    editListenerRef.current = subscribeToMessageEdit((editedMessage) => {
      if (
        editedMessage.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP && 
        editedMessage.getReceiverId() === selectedGroup.guid
      ) {
        console.log("Message edited in real-time:", editedMessage);
        
        // Get any metadata that may have updated (like reactions)
        let metadata;
        try {
          if ((editedMessage as any).getMetadata && typeof (editedMessage as any).getMetadata === 'function') {
            metadata = (editedMessage as any).getMetadata();
          }
        } catch (error) {
          console.log("Error getting metadata in edit listener:", error);
        }
        
        // Format reactions if present
        let formattedReactions: {emoji: string; count: number; reactedByMe: boolean}[] = [];
        if (metadata?.reactions) {
          try {
            formattedReactions = Object.entries(metadata.reactions).map(([emoji, users]) => {
              const userObj = users as Record<string, any>;
              return {
                emoji,
                count: Object.keys(userObj).length,
                reactedByMe: Object.keys(userObj).includes(currentUser.uid)
              };
            });
          } catch (error) {
            console.error("Error formatting reactions in edit listener:", error);
          }
        }
        
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === editedMessage.getId().toString()
              ? {
                  ...msg,
                  text: (editedMessage as CometChat.TextMessage).getText(),
                  editedAt: (editedMessage as any).getEditedAt?.(),
                  editedBy: (editedMessage as any).getEditedBy?.(),
                  reactions: formattedReactions.length > 0 ? formattedReactions : msg.reactions
                }
              : msg
          )
        );
      }
    });

    // Set up main message listener for real-time updates
    messageListenerRef.current = `group_chat_listener_${selectedGroup.guid}`;
    CometChat.addMessageListener(
      messageListenerRef.current,
      new CometChat.MessageListener({
        onTextMessageReceived: (textMessage: CometChat.TextMessage) => {
          // Only process messages for this group
          if (textMessage.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP && 
              textMessage.getReceiverId() === selectedGroup.guid) {
            
            // Skip action messages
            if ((textMessage as any).getCategory && (textMessage as any).getCategory() === 'action') {
              console.log("Skipping action message:", textMessage);
              return;
            }
            
            console.log("Group text message received:", textMessage);
            
            // Get metadata for reactions
            let metadata;
            try {
              if ((textMessage as any).getMetadata && typeof (textMessage as any).getMetadata === 'function') {
                metadata = (textMessage as any).getMetadata();
              }
            } catch (error) {
              console.log("Error getting metadata in message listener:", error);
            }
            
            // Format reactions if present
            let reactions: {emoji: string; count: number; reactedByMe: boolean}[] = [];
            if (metadata?.reactions) {
              try {
                reactions = Object.entries(metadata.reactions).map(([emoji, users]) => {
                  const userObj = users as Record<string, any>;
                  return {
                    emoji,
                    count: Object.keys(userObj).length,
                    reactedByMe: Object.keys(userObj).includes(currentUser.uid)
                  };
                });
              } catch (error) {
                console.error("Error formatting reactions in message listener:", error);
              }
            }
            
            const convertedMessage: LocalChatMessage = {
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
              reactions: reactions
            };
            
            setMessages(prevMessages => [...prevMessages, convertedMessage]);
            
            // Scroll to the bottom
            if (flatListRef.current) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }
        },
        
        onMediaMessageReceived: (mediaMessage: CometChat.MediaMessage) => {
          // Only process messages for this group
          if (mediaMessage.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP && 
              mediaMessage.getReceiverId() === selectedGroup.guid) {
            
            // Skip action messages
            if ((mediaMessage as any).getCategory && (mediaMessage as any).getCategory() === 'action') {
              console.log("Skipping action message:", mediaMessage);
              return;
            }
            
            console.log("Group media message received:", mediaMessage);
            
            const attachment = mediaMessage.getAttachment();
            let messageText = 'Media';
            
            if (mediaMessage.getType() === CometChat.MESSAGE_TYPE.IMAGE) {
              messageText = 'Image';
            } else if (mediaMessage.getType() === CometChat.MESSAGE_TYPE.VIDEO) {
              messageText = 'Video';
            } else if (mediaMessage.getType() === CometChat.MESSAGE_TYPE.AUDIO) {
              messageText = 'Audio';
            } else if (mediaMessage.getType() === CometChat.MESSAGE_TYPE.FILE) {
              messageText = 'File';
            }
            
            // Get metadata for reactions
            let metadata;
            try {
              if ((mediaMessage as any).getMetadata && typeof (mediaMessage as any).getMetadata === 'function') {
                metadata = (mediaMessage as any).getMetadata();
              }
            } catch (error) {
              console.log("Error getting metadata in media message listener:", error);
            }
            
            // Format reactions if present
            let reactions: {emoji: string; count: number; reactedByMe: boolean}[] = [];
            if (metadata?.reactions) {
              try {
                reactions = Object.entries(metadata.reactions).map(([emoji, users]) => {
                  const userObj = users as Record<string, any>;
                  return {
                    emoji,
                    count: Object.keys(userObj).length,
                    reactedByMe: Object.keys(userObj).includes(currentUser.uid)
                  };
                });
              } catch (error) {
                console.error("Error formatting reactions in media message listener:", error);
              }
            }
            
            const convertedMessage: LocalChatMessage = {
              id: mediaMessage.getId().toString(),
              text: messageText,
              sender: {
                uid: mediaMessage.getSender().getUid(),
                name: mediaMessage.getSender().getName(),
                avatar: mediaMessage.getSender().getAvatar()
              },
              sentAt: mediaMessage.getSentAt(),
              type: mediaMessage.getType(),
              status: 'sent',
              reactions: reactions,
              attachment: attachment ? {
                url: attachment.getUrl(),
                type: attachment.getMimeType(),
                name: mediaMessage.getType() === CometChat.MESSAGE_TYPE.VIDEO 
                      ? 'video.mp4' 
                      : (attachment.getName() || 'media')
              } : undefined
            };
            
            setMessages(prevMessages => [...prevMessages, convertedMessage]);
            
            // Scroll to the bottom
            if (flatListRef.current) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }
        },
        
        onMessageDeleted: (message: CometChat.BaseMessage) => {
          // Skip if not for this group
          if (
            message.getReceiverType() !== CometChat.RECEIVER_TYPE.GROUP || 
            message.getReceiverId() !== selectedGroup.guid
          ) {
            return;
          }
          
          console.log("Message deleted:", message);
          const messageId = message.getId().toString();
          
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === messageId
                ? { ...msg, text: "This message was deleted", isDeleted: true }
                : msg
            )
          );
        },
        
        onMessageEdited: (message: CometChat.BaseMessage) => {
          // Skip if not for this group
          if (
            message.getReceiverType() !== CometChat.RECEIVER_TYPE.GROUP || 
            message.getReceiverId() !== selectedGroup.guid
          ) {
            return;
          }
          
          console.log("Message edited:", message);
          
          // Get any metadata that may have updated (like reactions)
          let metadata;
          try {
            if ((message as any).getMetadata && typeof (message as any).getMetadata === 'function') {
              metadata = (message as any).getMetadata();
            }
          } catch (error) {
            console.log("Error getting metadata in onMessageEdited:", error);
          }
          
          // Format reactions if present
          let formattedReactions: {emoji: string; count: number; reactedByMe: boolean}[] = [];
          if (metadata?.reactions) {
            try {
              formattedReactions = Object.entries(metadata.reactions).map(([emoji, users]) => {
                const userObj = users as Record<string, any>;
                return {
                  emoji,
                  count: Object.keys(userObj).length,
                  reactedByMe: Object.keys(userObj).includes(currentUser.uid)
                };
              });
            } catch (error) {
              console.error("Error formatting reactions in onMessageEdited:", error);
            }
          }
          
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === message.getId().toString()
                ? {
                    ...msg,
                    text: (message as CometChat.TextMessage).getText(),
                    editedAt: (message as any).getEditedAt?.(),
                    editedBy: (message as any).getEditedBy?.(),
                    reactions: formattedReactions.length > 0 ? formattedReactions : msg.reactions
                  }
                : msg
            )
          );
        }
      })
    );

    // Add a reaction listener
    reactionListenerRef.current = subscribeToReactions((message) => {
      // Only process for this group
      if (message.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP &&
          message.getReceiverId() === selectedGroup.guid) {
        console.log("Reaction updated for message:", message.getId());
        
        // Get metadata for reactions
        let metadata;
        try {
          if ((message as any).getMetadata && typeof (message as any).getMetadata === 'function') {
            metadata = (message as any).getMetadata();
            console.log("Reaction metadata:", metadata);
          } else if ((message as any).metadata) {
            metadata = (message as any).metadata;
          }
        } catch (error) {
          console.error("Error getting metadata from reaction callback:", error);
          return;
        }
        
        // Format reactions
        const reactions = metadata?.reactions;
        if (!reactions) {
          console.log("No reactions in metadata");
          return;
        }
        
        let formattedReactions: {emoji: string; count: number; reactedByMe: boolean}[] = [];
        try {
          formattedReactions = Object.entries(reactions).map(([emoji, users]) => {
            // Ensure users is an object before using Object.keys
            const userObj = users as Record<string, any>;
            return {
              emoji,
              count: Object.keys(userObj).length,
              reactedByMe: Object.keys(userObj).includes(currentUser.uid)
            };
          });
        } catch (error) {
          console.error("Error formatting reactions in reaction callback:", error);
          return;
        }
        
        // Update the message in state
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === message.getId().toString()
              ? {
                  ...msg,
                  reactions: formattedReactions
                }
              : msg
          )
        );
      }
    });

    // Set up group events listener
    groupEventsListenerRef.current = subscribeToGroupEvents((action, message, userUid, groupGuid) => {
      console.log(`Group action: ${action} by user: ${userUid} in group: ${groupGuid}`);
      
      // Only handle events for current group
      if (groupGuid === selectedGroup.guid) {
        // Reload group members when membership changes
        if (['joined', 'left', 'kicked', 'banned', 'unbanned', 'added', 'changed'].includes(action)) {
          loadGroupMembers();
        }
        
        // Handle if current user is kicked from group
        if (action === 'kicked' && userUid === currentUser.uid) {
          Alert.alert(
            "Removed from Group",
            "You have been removed from this group.",
            [{ text: "OK", onPress: onBack }]
          );
        }
      }
    });
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      endTyping();
      const sentMessage = await sendGroupMessage(selectedGroup.guid, newMessage.trim());
      console.log("Group message sent:", sentMessage);
      
      
      const localMessage: LocalChatMessage = {
        id: Date.now().toString(), 
        text: newMessage.trim(),
        sender: {
          uid: currentUser.uid,
          name: currentUser.name,
          avatar: currentUser.avatar
        },
        sentAt: Date.now(),
        type: CometChat.MESSAGE_TYPE.TEXT,
        status: 'sent',
        reactions: []
      };

      setMessages(prevMessages => [...prevMessages, localMessage]);
      setNewMessage('');
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error("Error sending group message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };
  
  const handleEditMessage = async () => {
    if (!editingMessage || !editText.trim() || isLoading) return;
    
    setIsLoading(true);
    
    try {
      
      const localEditedMessage = {
        ...editingMessage,
        text: editText.trim(),
        editedAt: Date.now()
      };
      
     
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === editingMessage.id ? localEditedMessage : msg
        )
      );
      
      
      setEditingMessage(null);
      setEditText('');
      
      console.log(`Attempting to edit message with ID: ${editingMessage.id}`);
      try {
        await editGroupMessage(editingMessage.id, editText.trim());
        console.log(`Successfully edited message with ID: ${editingMessage.id}`);
      } catch (apiError) {
        console.error(`API error when editing message with ID ${editingMessage.id}:`, apiError);
        Alert.alert(
          "Error", 
          `Failed to edit message (ID: ${editingMessage.id}). The message may have been deleted or not found.`
        );
      }
    } catch (error) {
      console.error(`Error in handleEditMessage for message ID ${editingMessage?.id}:`, error);
      Alert.alert("Error", "Failed to edit message. Please try again.");
      
      // Revert local change on error
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === editingMessage?.id ? editingMessage : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteMessage = async (messageId: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setShowMessageOptions(false);
    
    try {
      console.log(`Attempting to delete message with ID: ${messageId}`);
      
    
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId
            ? { ...msg, text: "This message was deleted", isDeleted: true }
            : msg
        )
      );
      
  
      try {
        await deleteMessage(messageId);
        console.log(`Successfully deleted message with ID: ${messageId}`);
      } catch (apiError) {
        console.error(`API error when deleting message with ID ${messageId}:`, apiError);
        Alert.alert(
          "Error", 
          `Failed to delete message (ID: ${messageId}). The message may have been deleted already or not found.`
        );
      }
    } catch (error) {
      console.error(`Error in handleDeleteMessage for message ID ${messageId}:`, error);
      Alert.alert("Error", "Failed to delete message. Please try again.");
      loadMessages();
    } finally {
      setIsLoading(false);
    }
  };
  
  const startTyping = () => {
    try {
      typeGroupMessageStarted(selectedGroup.guid);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        endTyping();
      }, 5000);
    } catch (error) {
      console.error("Error starting typing indicator:", error);
    }
  };
  
  const endTyping = () => {
    try {
      typeGroupMessageEnded(selectedGroup.guid);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    } catch (error) {
      console.error("Error ending typing indicator:", error);
    }
  };
  
  const handleTyping = () => {
    startTyping();
  };
  
  const requestCameraPermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }
    
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
      console.error(err);
      return false;
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }
    
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
      console.error(err);
      return false;
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    console.log(`Adding reaction ${emoji} to message ${messageId}`);
    
    try {
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            const updatedReactions = [...(msg.reactions || [])];
            const existingIndex = updatedReactions.findIndex(r => r.emoji === emoji);
            
            if (existingIndex >= 0) {
              updatedReactions[existingIndex] = {
                ...updatedReactions[existingIndex],
                count: updatedReactions[existingIndex].count + 1,
                reactedByMe: true
              };
            } else {
              updatedReactions.push({
                emoji,
                count: 1,
                reactedByMe: true
              });
            }
            
            return {
              ...msg,
              reactions: updatedReactions
            };
          }
          return msg;
        })
      );
      
     
      try {
        console.log(`Calling addReactionToMessage service with messageId: ${messageId}, emoji: ${emoji}`);
        const result = await addReactionToMessage(messageId, emoji, currentUser.uid, currentUser.name);
        console.log("Reaction added successfully, result:", result);
        setTimeout(() => {
          loadMessages();
        }, 1000);
      } catch (apiError) {
        console.error(`API error when adding reaction ${emoji} to message ${messageId}:`, apiError);
        if (apiError instanceof Error) {
          console.log("Error message:", apiError.message);
          console.log("Error stack:", apiError.stack);
        }
      }
    } catch (error) {
      console.error("Error in handleAddReaction:", error);
      Alert.alert("Error", "Failed to add reaction. Please try again.");
      loadMessages();
    } finally {
      setIsLoading(false);
      setShowReactions(false);
    }
  };
  
  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    console.log(`Removing reaction ${emoji} from message ${messageId}`);
    
    try {
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            const updatedReactions = [...(msg.reactions || [])].map(r => {
              if (r.emoji === emoji) {
                return {
                  ...r,
                  count: Math.max(0, r.count - 1),
                  reactedByMe: false
                };
              }
              return r;
            }).filter(r => r.count > 0);
            
            return {
              ...msg,
              reactions: updatedReactions
            };
          }
          return msg;
        })
      );
      
     
      try {
        console.log(`Calling removeReactionFromMessage service with messageId: ${messageId}, emoji: ${emoji}`);
        const result = await removeReactionFromMessage(messageId, emoji, currentUser.uid);
        console.log("Reaction removed successfully, result:", result);
        
      
        setTimeout(() => {
          loadMessages();
        }, 1000);
      } catch (apiError) {
        console.error(`API error when removing reaction ${emoji} from message ${messageId}:`, apiError);
        
      
        if (apiError instanceof Error) {
          console.log("Error message:", apiError.message);
          console.log("Error stack:", apiError.stack);
        }
      }
    } catch (error) {
      console.error("Error in handleRemoveReaction:", error);
      Alert.alert("Error", "Failed to remove reaction. Please try again.");
      
      // Reload messages on error
      loadMessages();
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAttachmentPress = () => {
    if (isPicking) return;
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose Image', 'Share Document'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleCameraPress();
          } else if (buttonIndex === 2) {
            handleGalleryPress();
          } else if (buttonIndex === 3) {
            handleDocumentPress();
          }
        }
      );
    } else {
      setShowAttachmentOptions(true);
    }
  };
  
  const handleCameraPress = async () => {
    if (isPicking) return;
    
    setShowAttachmentOptions(false);
    setIsPicking(true);
    
    try {
      // Request camera permission
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Cannot access camera');
        setIsPicking(false);
        return;
      }
      
      const result = await ImagePicker.launchCamera({
        mediaType: 'mixed',
        quality: 0.8,
      });
      
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.uri) {
          setMediaPreview({
            uri: asset.uri,
            type: asset.type || 'image/jpeg'
          });
        }
      }
    } catch (error) {
      console.error("Error capturing media:", error);
      Alert.alert("Error", "Failed to capture media. Please try again.");
    } finally {
      setIsPicking(false);
    }
  };
  
  const handleGalleryPress = async () => {
    if (isPicking) return;
    
    setShowAttachmentOptions(false);
    setIsPicking(true);
    
    try {
      // Request storage permission
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Cannot access gallery');
        setIsPicking(false);
        return;
      }
      
      const result = await ImagePicker.launchImageLibrary({
        mediaType: 'mixed',
        quality: 0.8,
      });
      
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.uri) {
          setMediaPreview({
            uri: asset.uri,
            type: asset.type || 'image/jpeg'
          });
        }
      }
    } catch (error) {
      console.error("Error picking media from gallery:", error);
      Alert.alert("Error", "Failed to pick media. Please try again.");
    } finally {
      setIsPicking(false);
    }
  };
  
  const handleDocumentPress = async () => {
    if (isPicking) return;
    
    setShowAttachmentOptions(false);
    setIsPicking(true);
    
    try {
      // Request storage permission
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Cannot access files');
        setIsPicking(false);
        return;
      }
      
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: false,
      });
      
      if (result && result.length > 0) {
        setMediaPreview({
          uri: result[0].uri,
          type: result[0].type || 'application/octet-stream'
        });
      }
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        console.error("Error picking document:", error);
        Alert.alert("Error", "Failed to pick document. Please try again.");
      }
    } finally {
      setIsPicking(false);
    }
  };
  
  const handleSendMediaMessage = async () => {
    if (!mediaPreview || isLoading) return;
    
    setIsLoading(true);
    
    try {

      const uriParts = mediaPreview.uri.split('/');
      const fileName = uriParts[uriParts.length - 1] || `media_${Date.now()}`;
      
      const mediaFile = {
        uri: mediaPreview.uri,
        type: mediaPreview.type,
        name: fileName
      };
      
      // Determine message type
      let messageType;
      let messageText;
      if (mediaPreview.type.includes('image')) {
        messageType = CometChat.MESSAGE_TYPE.IMAGE;
        messageText = 'Image';
      } else if (mediaPreview.type.includes('video')) {
        messageType = CometChat.MESSAGE_TYPE.VIDEO;
        messageText = 'Video';
      } else if (mediaPreview.type.includes('audio')) {
        messageType = CometChat.MESSAGE_TYPE.AUDIO;
        messageText = 'Audio';
      } else {
        messageType = CometChat.MESSAGE_TYPE.FILE;
        messageText = 'File';
      }
      

      const tempId = `temp_${Date.now()}`;
      const localMessage: LocalChatMessage = {
        id: tempId,
        text: messageText,
        sender: {
          uid: currentUser.uid,
          name: currentUser.name,
          avatar: currentUser.avatar
        },
        sentAt: Date.now(),
        type: messageType,
        status: 'sent',
        reactions: [],
        attachment: {
          url: mediaPreview.uri, // Use local URI for immediate display
          type: mediaPreview.type,
          name: fileName
        },
        isLocalOnly: true // Flag to identify this is a local message
      };
      
      // Add local message to state
      setMessages(prevMessages => [...prevMessages, localMessage]);
      
      // Scroll to the bottom to show the message
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
      
      // Actually send the message
      const sentMessage = await sendGroupMediaMessage(
        selectedGroup.guid,
        mediaFile,
        messageType
      );
      
      // Once the message is sent, update the local message with the real one
      if (sentMessage) {
        // Update message with the real one
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            (msg as any).isLocalOnly && msg.id === tempId 
              ? {
                  ...sentMessage,
                  reactions: sentMessage.reactions || []
                }
              : msg
          )
        );
      }
      
      // Clear the media preview
      setMediaPreview(null);
    } catch (error) {
      console.error("Error sending media message:", error);
      Alert.alert("Error", "Failed to send media. Please try again.");
      
      // Remove the temporary message on error
      setMessages(prevMessages => prevMessages.filter(msg => !(msg as any).isLocalOnly));
    } finally {
      setIsLoading(false);
    }
  };
  
  const cancelMediaPreview = () => {
    setMediaPreview(null);
  };
  
  const handleLongPress = (message: ChatMessage, event: any) => {
    if (message.isDeleted) return;
    
    setSelectedMessage(message);
    setShowMessageOptions(true);
    setMessageOptionsPosition({
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY
    });
  };
  
  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };
  
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };
  
  const formatDateHeading = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
      return date.toLocaleDateString(undefined, options);
    }
  };
  
  const renderMessage = ({ item, index }: { item: LocalChatMessage; index: number }) => {
    const isSentByMe = item.sender.uid === currentUser.uid;
    const messageTime = formatMessageTime(item.sentAt);
    const isDeleted = item.isDeleted;
    const isEdited = item.editedAt !== undefined;
    const isMediaMessage = item.type === CometChat.MESSAGE_TYPE.IMAGE || 
                          item.type === CometChat.MESSAGE_TYPE.VIDEO || 
                          item.type === CometChat.MESSAGE_TYPE.AUDIO ||
                          item.type === CometChat.MESSAGE_TYPE.FILE;
    // Use the extended type for isLocalOnly  
    const isLocalOnlyMessage = item.isLocalOnly === true;

    const showDateHeading =
      index === 0 ||
      formatDateHeading(item.sentAt) !== formatDateHeading(messages[index - 1].sentAt);

    const showSenderName = !isSentByMe && (
      index === 0 || 
      messages[index - 1].sender.uid !== item.sender.uid ||
      showDateHeading
    );

   
    const hasValidAttachment = item.attachment && 
                              typeof item.attachment.url === 'string' &&
                              item.attachment.url.length > 0;

    return (
      <>
        {showDateHeading && (
          <View style={styles.dateHeadingContainer}>
            <Text style={styles.dateHeadingText}>
              {formatDateHeading(item.sentAt)}
            </Text>
          </View>
        )}
        
        <View
          style={[
            styles.messageRowContainer,
            isSentByMe ? styles.sentMessageRowContainer : styles.receivedMessageRowContainer,
          ]}
        >
          {!isSentByMe && (
            <View style={styles.avatarContainer}>
              {item.sender.avatar ? (
                <Image 
                  source={{ uri: item.sender.avatar }} 
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallbackView}>
                  <Text style={styles.avatarFallbackText}>
                    {item.sender.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          <View style={styles.messageWrapper}>
            <TouchableOpacity
              onLongPress={(event) => {
                if (!isLocalOnlyMessage && !isDeleted) handleLongPress(item, event)
              }}
              style={[
                styles.messageContainer,
                isSentByMe ? styles.sentMessage : styles.receivedMessage,
                isDeleted && styles.deletedMessage,
                isLocalOnlyMessage && styles.localMessage
              ]}
              activeOpacity={0.8}
              delayLongPress={200}
              disabled={isLocalOnlyMessage || isDeleted}
            >
              {showSenderName && (
                <Text style={styles.senderName}>{item.sender.name}</Text>
              )}
              
              {isMediaMessage && hasValidAttachment ? (
                <View style={styles.mediaContainer}>
                  {item.type === CometChat.MESSAGE_TYPE.IMAGE && (
                    <Image 
                      source={{ uri: item.attachment?.url }} 
                      style={styles.imageMessage}
                      resizeMode="cover"
                    />
                  )}
                  {item.type === CometChat.MESSAGE_TYPE.VIDEO && (
                    <TouchableOpacity
                      onPress={() => {
                        if (item.attachment?.url) {
                          setPlayingVideo(playingVideo === item.attachment.url ? null : item.attachment.url);
                        }
                      }}
                      disabled={isLocalOnlyMessage}
                    >
                      {playingVideo === item.attachment?.url ? (
                        <Video
                          source={{ uri: item.attachment.url }}
                          style={styles.videoPlayer}
                          resizeMode="contain"
                          controls={true}
                        />
                      ) : (
                        <View style={styles.videoPlaceholder}>
                          <Text style={styles.playButton}>Play</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  {item.type === CometChat.MESSAGE_TYPE.AUDIO && (
                    <View style={styles.audioContainer}>
                      <Text style={styles.audioText}>Audio Message</Text>
                    </View>
                  )}
                  {item.type === CometChat.MESSAGE_TYPE.FILE && (
                    <View style={styles.audioContainer}>
                      <Text style={styles.audioText}>Document</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={[
                  styles.messageText,
                  isDeleted && styles.deletedMessageText
                ]}>
                  {item.text}
                </Text>
              )}
              
              <View style={styles.messageFooter}>
                <Text style={styles.messageTime}>{messageTime}</Text>
                {isSentByMe && !isLocalOnlyMessage && (
                  <View style={styles.messageStatusContainer}>
                    {item.status === 'seen' && (
                      <Text style={styles.messageStatusSeen}>✓✓</Text>
                    )}
                    {item.status === 'delivered' && (
                      <Text style={styles.messageStatusDelivered}>✓✓</Text>
                    )}
                    {item.status === 'sent' && (
                      <Text style={styles.messageStatusSent}>✓</Text>
                    )}
                  </View>
                )}
                {isEdited && !isDeleted && (
                  <Text style={styles.editedText}>edited</Text>
                )}
                {isLocalOnlyMessage && (
                  <ActivityIndicator size="small" color="#075E54" style={styles.sendingIndicator} />
                )}
              </View>
            </TouchableOpacity>
            
            {item.reactions && item.reactions.length > 0 && !isLocalOnlyMessage && (
              <View style={styles.reactionsContainer}>
                {renderReactions(item)}
              </View>
            )}
          </View>
          
          {isSentByMe && (
            <View style={styles.avatarContainer}>
              {currentUser.avatar ? (
                <Image 
                  source={{ uri: currentUser.avatar }} 
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallbackView}>
                  <Text style={styles.avatarFallbackText}>
                    {currentUser.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </>
    );
  };
  
  const renderReactions = (message: LocalChatMessage) => {
    if (!message.reactions || message.reactions.length === 0) return null;
    
    console.log(`Rendering ${message.reactions.length} reactions for message ${message.id}`);
    
    return (
      <View style={styles.reactionsList}>
        {message.reactions.map((reaction, index) => (
          <TouchableOpacity
            key={`${reaction.emoji}_${index}`}
            style={[
              styles.reactionBubble,
              reaction.reactedByMe ? styles.reactedBubble : null
            ]}
            onPress={() => reaction.reactedByMe 
              ? handleRemoveReaction(message.id, reaction.emoji)
              : handleAddReaction(message.id, reaction.emoji)
            }
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionCount}>{reaction.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    
    let typingText = '';
    if (typingUsers.length === 1) {
      typingText = `${typingUsers[0].name} is typing...`;
    } else if (typingUsers.length === 2) {
      typingText = `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    } else {
      typingText = 'Several people are typing...';
    }
    
    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>{typingText}</Text>
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
        <View 
          style={[
            styles.messageOptionsContainer,
            {
              top: messageOptionsPosition.y - 100,
              left: selectedMessage?.sender.uid === currentUser.uid ? messageOptionsPosition.x - 150 : messageOptionsPosition.x
            }
          ]}
        >
          {selectedMessage?.sender.uid === currentUser.uid && !selectedMessage?.isDeleted && (
            <>
              <TouchableOpacity 
                style={styles.messageOption}
                onPress={() => {
                  setShowMessageOptions(false);
                  setEditingMessage(selectedMessage);
                  setEditText(selectedMessage?.text || '');
                }}
              >
                <Text style={styles.messageOptionText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.messageOption}
                onPress={() => {
                  if (selectedMessage) {
                    handleDeleteMessage(selectedMessage.id);
                  }
                }}
              >
                <Text style={[styles.messageOptionText, { color: '#FF0000' }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
          
          {!selectedMessage?.isDeleted && (
            <>
              <TouchableOpacity 
                style={styles.messageOption}
                onPress={() => {
                  setShowMessageOptions(false);
                  setSelectedMessageForReaction(selectedMessage);
                  setShowReactions(true);
                }}
              >
                <Text style={styles.messageOptionText}>React</Text>
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
                    handleAddReaction(selectedMessageForReaction.id, emoji);
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
  
  const renderAttachmentOptions = () => (
    <Modal
      visible={showAttachmentOptions}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAttachmentOptions(false)}
    >
      <View style={styles.attachmentOverlay}>
        <View style={styles.attachmentContainer}>
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={handleCameraPress}
            disabled={isPicking}
          >
            <View style={styles.attachmentIconCircle}>
              <Text style={styles.attachmentIconText}>📷</Text>
            </View>
            <Text style={styles.attachmentText}>Camera</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={handleGalleryPress}
            disabled={isPicking}
          >
            <View style={styles.attachmentIconCircle}>
              <Text style={styles.attachmentIconText}>🖼️</Text>
            </View>
            <Text style={styles.attachmentText}>Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.attachmentOption}
            onPress={handleDocumentPress}
            disabled={isPicking}
          >
            <View style={styles.attachmentIconCircle}>
              <Text style={styles.attachmentIconText}>📄</Text>
            </View>
            <Text style={styles.attachmentText}>Document</Text>
          </TouchableOpacity>
        </View>
        
        {isPicking && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#075E54" />
          </View>
        )}
      </View>
    </Modal>
  );
  
  const renderMediaPreview = () => {
    if (!mediaPreview) return null;
    
    return (
      <View style={styles.mediaPreviewContainer}>
        <View style={styles.mediaPreviewContent}>
          {mediaPreview.type.includes('image') ? (
            <Image 
              source={{ uri: mediaPreview.uri }} 
              style={styles.mediaPreviewImage}
              resizeMode="contain"
            />
          ) : mediaPreview.type.includes('video') ? (
            <Video
              source={{ uri: mediaPreview.uri }}
              style={styles.mediaPreviewVideo}
              resizeMode="contain"
              controls={true}
            />
          ) : (
            <View style={styles.filePreview}>
              <Text style={styles.filePreviewText}>Document</Text>
            </View>
          )}
        </View>
        
        <View style={styles.mediaPreviewActions}>
          <TouchableOpacity 
            style={styles.mediaPreviewCancel}
            onPress={cancelMediaPreview}
            disabled={isLoading}
          >
            <Text style={[styles.mediaActionText, isLoading && styles.disabledText]}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mediaPreviewSend}
            onPress={handleSendMediaMessage}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#075E54" />
            ) : (
              <Text style={styles.mediaActionText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const renderGroupInfo = () => (
    <Modal
      visible={showGroupInfo}
      animationType="slide"
      onRequestClose={() => setShowGroupInfo(false)}
    >
      <SafeAreaView style={styles.groupInfoContainer}>
        <View style={styles.groupInfoHeader}>
          <TouchableOpacity 
            style={styles.groupInfoBackButton}
            onPress={() => setShowGroupInfo(false)}
          >
            <Text style={{ fontSize: 24, color: "#075E54" }}>←</Text>
          </TouchableOpacity>
          <Text style={styles.groupInfoTitle}>Group Info</Text>
        </View>
        
        <View style={styles.groupInfoContent}>
          <View style={styles.groupInfoAvatar}>
            {selectedGroup.icon ? (
              <Image 
                source={{ uri: selectedGroup.icon }} 
                style={styles.groupInfoAvatarImage}
              />
            ) : (
              <View style={styles.groupInfoAvatarPlaceholder}>
                <Text style={styles.groupInfoAvatarText}>
                  {selectedGroup.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={styles.groupInfoName}>{selectedGroup.name}</Text>
          
          {selectedGroup.description && (
            <Text style={styles.groupInfoDescription}>{selectedGroup.description}</Text>
          )}
          
          <Text style={styles.groupInfoType}>
            {selectedGroup.type === 'public' ? 'Public Group' : 
             selectedGroup.type === 'private' ? 'Private Group' : 
             'Password Protected Group'}
          </Text>
          
          <View style={styles.groupActionsContainer}>
            {isAdmin && (
              <TouchableOpacity 
                style={styles.groupAction}
                onPress={() => setShowAddMembersModal(true)}
              >
                <View style={styles.groupActionIcon}>
                  <Text>👥</Text>
                </View>
                <Text style={styles.groupActionText}>Add People</Text>
              </TouchableOpacity>
            )}
            
            {isAdmin ? (
              <TouchableOpacity 
                style={styles.groupAction}
                onPress={() => showConfirmationDialog('delete')}
              >
                <View style={styles.groupActionIcon}>
                  <Text style={{ color: 'red', fontSize: 16 }}>🗑️ </Text>
                </View>
                <Text style={[styles.groupActionText, { color: 'red' }]}>Delete Group</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.groupAction}
                onPress={() => showConfirmationDialog('leave')}
              >
                <View style={styles.groupActionIcon}>
                  <Text>❌</Text>
                </View>
                <Text style={styles.groupActionText}>Leave Group</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.groupInfoMembersTitle}>
            {`${groupMembers.length} Members`}
          </Text>
          
          <FlatList
            data={groupMembers}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <View style={styles.memberAvatar}>
                  {item.avatar ? (
                    <Image 
                      source={{ uri: item.avatar }} 
                      style={styles.memberAvatarImage}
                    />
                  ) : (
                    <Text style={styles.memberAvatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  <Text style={styles.memberStatus}>
                    {item.scope === CometChat.GROUP_MEMBER_SCOPE.ADMIN ? 'Admin' : 
                     item.scope === CometChat.GROUP_MEMBER_SCOPE.MODERATOR ? 'Moderator' : 
                     'Member'}
                  </Text>
                </View>
                {item.uid === currentUser.uid && (
                  <Text style={styles.youLabel}>You</Text>
                )}
                {isAdmin && item.uid !== currentUser.uid && (
                  <TouchableOpacity 
                    style={styles.kickButton}
                    onPress={() => showConfirmationDialog('kick', item)}
                  >
                    <Text style={styles.kickButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );

  const handleLeaveGroup = async () => {
    setShowConfirmation(false);
    setIsLoading(true);
    
    try {
      await leaveGroup(selectedGroup.guid);
      Alert.alert(
        "Success",
        "You have left the group.",
        [{ text: "OK", onPress: onBack }]
      );
    } catch (error) {
      console.error("Error leaving group:", error);
      Alert.alert("Error", "Failed to leave the group. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteGroup = async () => {
    setShowConfirmation(false);
    setIsLoading(true);
    
    try {
      await deleteGroup(selectedGroup.guid);
      Alert.alert(
        "Success",
        "Group has been deleted.",
        [{ text: "OK", onPress: onBack }]
      );
    } catch (error) {
      console.error("Error deleting group:", error);
      Alert.alert("Error", "Failed to delete the group. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKickMember = async () => {
    if (!memberToKick) return;
    
    setShowConfirmation(false);
    setIsLoading(true);
    
    try {
      await removeMembersFromGroup(selectedGroup.guid, [memberToKick.uid]);
      Alert.alert("Success", `${memberToKick.name} has been removed from the group.`);
      loadGroupMembers();
    } catch (error) {
      console.error("Error kicking member:", error);
      Alert.alert("Error", "Failed to remove member from the group. Please try again.");
    } finally {
      setIsLoading(false);
      setMemberToKick(null);
    }
  };
  
  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      setShowAddMembersModal(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Format users for API
      const members = selectedUsers.map(uid => ({ uid }));
      
      await addMembersToGroup(selectedGroup.guid, members);
      Alert.alert("Success", "Members have been added to the group.");
      loadGroupMembers();
      setShowAddMembersModal(false);
      setSelectedUsers([]);
    } catch (error) {
      console.error("Error adding members:", error);
      Alert.alert("Error", "Failed to add members to the group. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadAvailableUsers = async () => {
    setIsLoading(true);
    try {
      const users = await fetchUsers();
      if (Array.isArray(users)) {
        const formattedUsers: User[] = users.map(user => ({
          uid: user.getUid(),
          name: user.getName(),
          avatar: user.getAvatar()
        }));
        setAvailableUsers(formattedUsers);
      }
    } catch (error) {
      console.error("Error loading available users:", error);
      Alert.alert("Error", "Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const showConfirmationDialog = (action: 'leave' | 'delete' | 'kick', member?: GroupMember) => {
    if (action === 'kick' && member) {
      setMemberToKick(member);
    }
    
    setConfirmationAction(action);
    setShowConfirmation(true);
  };

  const renderConfirmationModal = () => {
    let title = '';
    let message = '';
    let confirmAction = () => {};
    
    switch (confirmationAction) {
      case 'leave':
        title = "Leave Group";
        message = "Are you sure you want to leave this group?";
        confirmAction = handleLeaveGroup;
        break;
      case 'delete':
        title = "Delete Group";
        message = "Are you sure you want to delete this group? This action cannot be undone.";
        confirmAction = handleDeleteGroup;
        break;
      case 'kick':
        title = "Remove Member";
        message = `Are you sure you want to remove ${memberToKick?.name} from this group?`;
        confirmAction = handleKickMember;
        break;
    }
    
    return (
      <Modal
        visible={showConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationContainer}>
            <Text style={styles.confirmationTitle}>{title}</Text>
            <Text style={styles.confirmationMessage}>{message}</Text>
            
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.cancelButton]}
                onPress={() => setShowConfirmation(false)}
                disabled={isLoading}
              >
                <Text style={styles.confirmationButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.confirmButton]}
                onPress={confirmAction}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmationButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };
  
  const renderAddMembersModal = () => {
    return (
      <Modal
        visible={showAddMembersModal}
        animationType="slide"
        onRequestClose={() => setShowAddMembersModal(false)}
        onShow={loadAvailableUsers}
      >
        <SafeAreaView style={styles.addMembersContainer}>
          <View style={styles.addMembersHeader}>
            <TouchableOpacity 
              style={styles.addMembersBackButton}
              onPress={() => {
                setShowAddMembersModal(false);
                setSelectedUsers([]);
              }}
              disabled={isLoading}
            >
              <Text style={{ fontSize: 24, color: "#075E54" }}>←</Text>
            </TouchableOpacity>
            <Text style={styles.addMembersTitle}>Add Members</Text>
          </View>
          
          <View style={styles.addMembersContent}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#888"
            />
            
            <FlatList
              data={availableUsers.filter(user => 
                !groupMembers.some(member => member.uid === user.uid)
              )}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.userItem}
                  onPress={() => {
                    setSelectedUsers(prev => 
                      prev.includes(item.uid)
                        ? prev.filter(uid => uid !== item.uid)
                        : [...prev, item.uid]
                    );
                  }}
                >
                  <View style={styles.userAvatar}>
                    {item.avatar ? (
                      <Image 
                        source={{ uri: item.avatar }} 
                        style={styles.userAvatarImage}
                      />
                    ) : (
                      <Text style={styles.userAvatarText}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.userName}>{item.name}</Text>
                  
                  {selectedUsers.includes(item.uid) && (
                    <View style={styles.selectedUserCheck}>
                      <Text style={styles.selectedUserCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyListText}>
                  No users available to add
                </Text>
              )}
            />
          </View>
          
          <View style={styles.addMembersFooter}>
            <TouchableOpacity 
              style={[
                styles.addMembersButton,
                selectedUsers.length === 0 && styles.disabledButton
              ]}
              onPress={handleAddMembers}
              disabled={selectedUsers.length === 0 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addMembersButtonText}>
                  Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#075E54" barStyle="light-content" />
      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.groupInfoButton}
            onPress={() => setShowGroupInfo(true)}
          >
            <View style={styles.groupAvatar}>
              {selectedGroup.icon ? (
                <Image 
                  source={{ uri: selectedGroup.icon }} 
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {selectedGroup.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{selectedGroup.name}</Text>
              <Text style={styles.headerSubtitle}>
                {typingUsers.length > 0 
                  ? typingUsers.length === 1 
                    ? `${typingUsers[0].name} is typing...` 
                    : 'Several people are typing...'
                  : `${groupMembers.length} members`
                }
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        
        {mediaPreview ? (
          renderMediaPreview()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />
        )}
        
        {renderTypingIndicator()}
        
        {editingMessage ? (
          <View style={styles.editContainer}>
            <View style={styles.editContent}>
              <Text style={styles.editLabel}>Edit Message</Text>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus={true}
                multiline={true}
              />
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity 
                style={styles.editCancel}
                onPress={cancelEdit}
              >
                <Text style={{ color: '#FF0000' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.editSave}
                onPress={handleEditMessage}
              >
                <Text style={{ color: '#075E54' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TouchableOpacity 
              style={styles.attachButton}
              onPress={handleAttachmentPress}
            >
              <Text style={{ fontSize: 20, color: "#128C7E" }}>📎</Text>
            </TouchableOpacity>
            
            <TextInput
              style={styles.chatInput}
              placeholder="Type a message"
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                if (text.trim().length > 0) {
                  handleTyping();
                } else {
                  endTyping();
                }
              }}
              multiline={true}
              placeholderTextColor="#888"
            />
            
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={handleSendMessage}
              disabled={!newMessage.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      
      {renderMessageOptions()}
      {renderReactionPicker()}
      {renderAttachmentOptions()}
      {renderGroupInfo()}
      {renderConfirmationModal()}
      {renderAddMembersModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  groupInfoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#D0D0D0',
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  dateHeadingContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateHeadingText: {
    fontSize: 12,
    color: '#606060',
    backgroundColor: '#EDEDED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageRowContainer: {
    flexDirection: 'row',
    marginVertical: 1,
    paddingHorizontal: 8,
    width: '100%',
    marginBottom: 20,
  },
  sentMessageRowContainer: {
    justifyContent: 'flex-end',
  },
  receivedMessageRowContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 26,
    height: 26,
    marginHorizontal: 6,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  avatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarFallbackView: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarPlaceholder: {
    width: 26,
    marginRight: 6,
  },
  messageWrapper: {
    position: 'relative',
    maxWidth: '75%',
  },
  messageContainer: {
    width: '100%',
    borderRadius: 10,
    padding: 7,
    paddingHorizontal: 9,
    marginVertical: 1,
    position: 'relative',
  },
  sentMessage: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 2,
    alignSelf: 'flex-end',
  },
  receivedMessage: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
    alignSelf: 'flex-start',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  senderName: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#4fb6ec',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15.5,
    color: '#000',
    lineHeight: 20,
  },
  deletedMessage: {
    backgroundColor: '#f0f0f0',
    opacity: 0.7,
  },
  deletedMessageText: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: 14.5,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 11,
    color: '#7d7d7d',
    marginRight: 4,
  },
  editedText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 5,
  },
  messageStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageStatusSeen: {
    color: "#34B7F1",
    fontSize: 14,
  },
  messageStatusDelivered: {
    color: "#8C8C8C",
    fontSize: 14,
  },
  messageStatusSent: {
    color: "#8C8C8C",
    fontSize: 14,
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
  videoPlaceholder: {
    width: 200,
    height: 150,
    backgroundColor: '#2c3e50',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    color: '#fff',
  },
  videoPlayer: {
    width: 200,
    height: 150,
    borderRadius: 8,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ECE5DD',
    padding: 8,
    backgroundColor: '#fff',
  },
  attachButton: {
    padding: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCE0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#128C7E',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  disabledSendButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageOptionsContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    width: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  messageOption: {
    padding: 10,
  },
  messageOptionText: {
    fontSize: 16,
    color: '#075E54',
  },
  
  reactionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
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
  
  mediaPreviewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  mediaPreviewImage: {
    width: '90%',
    height: '70%',
  },
  mediaPreviewVideo: {
    width: '90%',
    height: '70%',
  },
  filePreview: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  filePreviewText: {
    fontSize: 16,
    color: '#075E54',
    marginTop: 8,
  },
  mediaPreviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mediaPreviewCancel: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  mediaPreviewSend: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  mediaActionText: {
    color: '#075E54',
    fontWeight: 'bold',
  },
  
  editContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#E8F5E9',
    borderTopWidth: 1,
    borderTopColor: '#ECE5DD',
  },
  editContent: {
    flex: 1,
  },
  editLabel: {
    fontSize: 12,
    color: '#075E54',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#DCE0E0',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#fff',
    maxHeight: 100,
  },
  editActions: {
    flexDirection: 'row',
    marginLeft: 8,
    alignItems: 'center',
  },
  editCancel: {
    padding: 8,
    marginRight: 8,
  },
  editSave: {
    padding: 8,
  },
  
  groupInfoContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  groupInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE5DD',
  },
  groupInfoBackButton: {
    marginRight: 16,
  },
  groupInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#075E54',
  },
  groupInfoContent: {
    padding: 16,
  },
  groupInfoAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  groupInfoAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  groupInfoAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfoAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  groupInfoName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  groupInfoDescription: {
    fontSize: 16,
    color: '#606060',
    textAlign: 'center',
    marginBottom: 16,
  },
  groupInfoType: {
    fontSize: 14,
    color: '#075E54',
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: '#E8F5E9',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupInfoMembersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE5DD',
    paddingBottom: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE5DD',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberStatus: {
    fontSize: 12,
    color: '#606060',
  },
  youLabel: {
    fontSize: 12,
    color: '#075E54',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reactionsContainer: {
    position: 'absolute',
    bottom: -24,
    right: 10,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
    zIndex: 1,
    flexWrap: 'wrap',
    maxWidth: '90%',
  },
  typingContainer: {
    padding: 8,
    paddingLeft: 16,
  },
  typingText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  disabledText: {
    color: '#999',
  },
  localMessage: {
    opacity: 0.7,
  },
  sendingIndicator: {
    marginLeft: 5,
  },
  attachmentIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentIconText: {
    fontSize: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kickButton: {
    backgroundColor: '#f8d7da',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kickButtonText: {
    color: '#dc3545',
    fontSize: 12,
  },
  
  groupActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  groupAction: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  groupActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupActionText: {
    fontSize: 12,
    textAlign: 'center',
  },
  
  confirmationOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  confirmationContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  confirmationMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  confirmationButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  confirmButton: {
    backgroundColor: '#075E54',
  },
  confirmationButtonText: {
    fontWeight: 'bold',
    color: '#000',
  },
  
  addMembersContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  addMembersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE5DD',
  },
  addMembersBackButton: {
    marginRight: 16,
  },
  addMembersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#075E54',
  },
  addMembersContent: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#DCE0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE5DD',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 16,
    flex: 1,
  },
  selectedUserCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedUserCheckText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyListText: {
    textAlign: 'center',
    padding: 20,
    color: '#888',
  },
  addMembersFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ECE5DD',
  },
  addMembersButton: {
    backgroundColor: '#075E54',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addMembersButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#C4C4C4',
  },
});

export default GroupChat; 