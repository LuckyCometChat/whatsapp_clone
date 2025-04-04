import { Platform, Alert, PermissionsAndroid, ActionSheetIOS } from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import * as ImagePicker from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { ChatMessage, User } from '../types/index';
import { 
  fetchMessages, 
  sendMessage, 
  subscribeToUserStatus, 
  EditMessage, 
  deleteMessage, 
  subscribeToMessageDeletion, 
  subscribeToMessageEdit, 
  typeMessageStarted, 
  typeMessageEnded, 
  sendMediaMessage 
} from '../services/cometChat';

export const updateReactions = async (
  reactionEvent: CometChat.ReactionEvent,
  action: CometChat.REACTION_ACTION,
  currentUser: User,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) => {
  try {
    if (!reactionEvent) {
      console.error("Invalid reaction event: null or undefined");
      return;
    }
    
    console.log("Processing reaction event:", { action });
    
    const reaction = reactionEvent.getReaction?.();
    if (!reaction) {
      console.error("No reaction in event");
      return;
    }
    
    const messageId = reaction.getMessageId?.();
    if (!messageId) {
      console.error("No messageId in reaction");
      return;
    }

    console.log("Processing reaction for message:", messageId.toString());

    setMessages((prevMessages) => {
      try {
        const updatedMessages = prevMessages.map((msg) => {
          if (msg.id === messageId.toString()) {
            try {
              const currentReactions = msg.reactions || [];
              
              const emojiReaction = reaction.getReaction?.() || '';
              const reactedBy = reaction.getReactedBy?.() || '';
              
              const newReaction = {
                emoji: emojiReaction,
                count: 1, 
                reactedByMe: !!(reactedBy && currentUser.uid && 
                  reactedBy.toString() === currentUser.uid.toString())
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
      } catch (error) {
        console.error("Error in message update function:", error);
        return prevMessages;
      }
    });
  } catch (error) {
    console.error("Error processing reaction event:", error);
  }
};

export const convertCometChatMessageToChat = (msg: CometChat.BaseMessage): ChatMessage | null => {
  try {
    console.log("Converting message:", msg?.getId?.());
    
    if (!msg || typeof msg !== 'object') {
      console.log("Message is null or not an object");
      return null;
    }
    
    if ((msg as any).getCategory?.() === "action") {
      console.log("Skipping action message");
      return null;
    }
    
    const sender = msg.getSender?.();
    if (!sender || typeof sender !== 'object') {
      console.log("Invalid sender:", sender);
      return null;
    }
    
    const isDeleted = (msg as any).getDeletedAt?.() !== undefined;
    const editedAt = (msg as any).getEditedAt?.();
    const editedBy = (msg as any).getEditedBy?.();
    const readAt = (msg as any).getReadAt?.();
    const deliveredAt = (msg as any).getDeliveredAt?.();
    const parentMessageId = (msg as any).getParentMessageId?.();
    const threadCount = (msg as any).getReplyCount?.() || 0;
    
    let status: 'sent' | 'delivered' | 'seen' = 'sent';
    
    if (deliveredAt) {
      status = 'delivered';
    }
    if (readAt) {
      status = 'seen';
    }

    let text = '';
    let attachment = undefined;

    if (msg.getType() === CometChat.MESSAGE_TYPE.TEXT) {
      text = (msg as CometChat.TextMessage).getText?.() || '';
    } else if (msg.getType() === CometChat.MESSAGE_TYPE.IMAGE) {
      text = 'Image';
      const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment?.();
      if (mediaAttachment) {
        attachment = {
          url: mediaAttachment.getUrl?.() || '',
          type: mediaAttachment.getMimeType?.() || '',
          name: 'image.jpg'
        };
      }
    } else if (msg.getType() === CometChat.MESSAGE_TYPE.VIDEO) {
      text = 'Video';
      const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment?.();
      if (mediaAttachment) {
        attachment = {
          url: mediaAttachment.getUrl?.() || '',
          type: mediaAttachment.getMimeType?.() || '',
          name: 'video.mp4'
        };
      }
    } else if (msg.getType() === CometChat.MESSAGE_TYPE.AUDIO) {
      text = 'Audio';
      const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment?.();
      if (mediaAttachment) {
        attachment = {
          url: mediaAttachment.getUrl?.() || '',
          type: mediaAttachment.getMimeType?.() || '',
          name: 'audio.mp3'
        };
      }
    }
    
    let reactions: any[] = [];
    try {
      if ((msg as any).getReactions && typeof (msg as any).getReactions === 'function') {
        const rawReactions = (msg as any).getReactions() || [];
        console.log("Raw reactions:", rawReactions);
        if (Array.isArray(rawReactions)) {
          reactions = rawReactions.map(reaction => {
            if (!reaction) return null;
            return {
              emoji: reaction.getReaction?.() || '',
              count: reaction.getCount?.() || 1,
              reactedByMe: reaction.getReactedByMe?.() || false
            };
          }).filter(Boolean);
        }
      }
    } catch (reactionError) {
      console.error("Error processing reactions:", reactionError);
      reactions = [];
    }
    
    return {
      id: msg.getId().toString(),
      text: isDeleted ? "This message was deleted" : text,
      sender: {
        uid: sender.getUid?.() || '',
        name: sender.getName?.() || '',
        avatar: sender.getAvatar?.() || ''
      },
      sentAt: msg.getSentAt?.() || Date.now(),
      type: msg.getType?.() || '',
      status: status,
      editedAt: editedAt,
      editedBy: editedBy,
      attachment: attachment,
      reactions: reactions,
      parentMessageId: parentMessageId ? parentMessageId.toString() : undefined,
      threadCount: threadCount,
      isThreaded: parentMessageId !== undefined
    };
  } catch (msgError) {
    console.error("Error converting individual message:", msgError);
    return null;
  }
};

export const loadMessages = async (
  selectedUser: User,
  currentUser: User,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  shouldAppend: boolean = false
) => {
  try {
    console.log("Fetching messages for user:", selectedUser.uid);
    
    // Hide replies (thread messages) from the main conversation
    // But include thread counts (reply counts)
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setUID(selectedUser.uid)
      .setLimit(50)
      .hideReplies(true)
      .build();
    
    const fetchedMessages = await messagesRequest.fetchPrevious();
    
    console.log("fetchedMessages:", fetchedMessages ? fetchedMessages.length : "null");

    if (!fetchedMessages || !Array.isArray(fetchedMessages) || fetchedMessages.length === 0) {
      console.log("No messages to process");
      if (!shouldAppend) {
        setMessages([]);
      }
      return false;
    }

    const convertedMessages: ChatMessage[] = [];
    
    for (const msg of fetchedMessages as unknown as CometChat.BaseMessage[]) {
      const convertedMessage = convertCometChatMessageToChat(msg);
      if (convertedMessage) {
        convertedMessages.push(convertedMessage);
      }
    }

    console.log("Converted messages:", convertedMessages.length);
    const sortedMessages = convertedMessages.sort((a, b) => a.sentAt - b.sentAt);
    
    if (shouldAppend) {
      setMessages(prevMessages => {
        // Filter out any duplicate messages that might exist in both arrays
        const existingIds = new Set(prevMessages.map(msg => msg.id));
        const uniqueNewMessages = sortedMessages.filter(msg => !existingIds.has(msg.id));
        
        // Combine the arrays and sort by sentAt
        const combinedMessages = [...uniqueNewMessages, ...prevMessages];
        return combinedMessages.sort((a, b) => a.sentAt - b.sentAt);
      });
    } else {
      setMessages(sortedMessages);
    }

    if (convertedMessages.length > 0 && fetchedMessages && Array.isArray(fetchedMessages) && fetchedMessages.length > 0) {
      const lastMessage = fetchedMessages[fetchedMessages.length - 1];
      if (lastMessage && typeof lastMessage === 'object' && typeof CometChat.markAsDelivered === 'function') {
        try {
          await CometChat.markAsDelivered(lastMessage);
        } catch (err) {
          console.error("Error marking message as delivered:", err);
        }
      }
    }
    
    // Return true if more messages were loaded
    return fetchedMessages.length > 0;
  } catch (error) {
    console.error("Error loading messages:", error);
    return false;
  }
};

export const handleSendMessage = async (
  newMessage: string,
  selectedUser: User,
  currentUser: User,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setNewMessage: React.Dispatch<React.SetStateAction<string>>,
  flatListRef: React.RefObject<any>
) => {
  if (!newMessage.trim()) return;

  try {
    await typeMessageEnded(selectedUser.uid);
    
    const sentMessage = await sendMessage(selectedUser.uid, newMessage);
    console.log("Sent message:", sentMessage);
    
    if (!sentMessage) {
      console.error("No message returned from sendMessage");
      return;
    }
    
    const cometChatMessage = sentMessage as unknown as any;
    
    if (!cometChatMessage || !cometChatMessage.sender) {
      console.error("Invalid message format received:", cometChatMessage);
      return;
    }
    
    let reactions: any[] = [];
    try {
      if ((cometChatMessage as any).getReactions && typeof (cometChatMessage as any).getReactions === 'function') {
        const rawReactions = (cometChatMessage as any).getReactions() || [];
        if (Array.isArray(rawReactions)) {
          reactions = rawReactions.map(reaction => {
            if (!reaction) return null;
            return {
              emoji: reaction.getReaction?.() || '',
              count: reaction.getCount?.() || 1,
              reactedByMe: reaction.getReactedByMe?.() || false
            };
          }).filter(Boolean);
        }
      }
    } catch (reactionError) {
      console.error("Error processing reactions:", reactionError);
      reactions = [];
    }
    
    const convertedMessage: ChatMessage = {
      id: cometChatMessage.id || '',
      text: cometChatMessage.text || '',
      sender: {
        uid: cometChatMessage.sender?.uid || '',
        name: cometChatMessage.sender?.name || '',
        avatar: cometChatMessage.sender?.avatar || ''
      },
      sentAt: cometChatMessage.sentAt || Date.now(),
      type: cometChatMessage.type || '',
      status: 'sent',
      reactions: reactions
    };
    
    setMessages(prevMessages => [...prevMessages, convertedMessage]);
    setNewMessage('');
    flatListRef.current?.scrollToEnd({ animated: true });
  } catch (error) {
    console.error("Error sending message:", error);
    Alert.alert("Error", "Failed to send message. Please try again.");
  }
};

export const handleEditMessage = async (
  selectedMessage: ChatMessage | null,
  editText: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setEditingMessage: React.Dispatch<React.SetStateAction<ChatMessage | null>>,
  setEditText: React.Dispatch<React.SetStateAction<string>>
) => {
  if (!selectedMessage || !editText.trim()) return;

  try {
    const editedMessage = await EditMessage(selectedMessage.id, editText);
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === selectedMessage.id ? (editedMessage as ChatMessage) : msg
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

export const handleDeleteMessage = async (
  selectedMessage: ChatMessage | null,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) => {
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

export const handleAddReaction = async (
  messageId: string,
  emoji: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) => {
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
  } catch (error) {
    console.error("Error adding reaction:", error);
    Alert.alert("Error", "Failed to add reaction. Please try again.");
  }
};

export const handleRemoveReaction = async (
  messageId: string,
  emoji: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) => {
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

export const requestCameraPermission = async () => {
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
  return true;
};

export const requestStoragePermission = async () => {
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
  return true;
};

export const handleCameraPress = async (
  setMediaPreview: React.Dispatch<React.SetStateAction<{ uri: string; type: string } | null>>,
  handleSendMediaMessage: (uri: string, type: string, mediaCategory: 'image' | 'video' | 'audio') => Promise<void>,
  setShowAttachmentOptions: React.Dispatch<React.SetStateAction<boolean>>
) => {
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

export const handleGalleryPress = async (
  setMediaPreview: React.Dispatch<React.SetStateAction<{ uri: string; type: string } | null>>,
  handleSendMediaMessage: (uri: string, type: string, mediaCategory: 'image' | 'video' | 'audio') => Promise<void>,
  setShowAttachmentOptions: React.Dispatch<React.SetStateAction<boolean>>
) => {
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

export const handleAudioPress = async (
  handleSendMediaMessage: (uri: string, type: string, mediaCategory: 'image' | 'video' | 'audio') => Promise<void>,
  setShowAttachmentOptions: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    Alert.alert('Permission Denied', 'Cannot access files');
    return;
  }

  try {
    const result = await DocumentPicker.pick({
      type: [DocumentPicker.types.audio],
    });
    
    if (result && (Array.isArray(result) ? result.length > 0 : true)) {
      const file = Array.isArray(result) ? result[0] : result;
      handleSendMediaMessage(file.uri, file.type || 'audio/mpeg', 'audio');
      setShowAttachmentOptions(false);
    }
  } catch (err) {
    if (DocumentPicker.isCancel(err)) {
      console.log('User cancelled document picker');
    } else {
      console.error('Error selecting audio:', err);
    }
  }
};

export const handleVideoPress = async (
  setMediaPreview: React.Dispatch<React.SetStateAction<{ uri: string; type: string } | null>>,
  handleSendMediaMessage: (uri: string, type: string, mediaCategory: 'image' | 'video' | 'audio') => Promise<void>,
  setShowAttachmentOptions: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    Alert.alert('Permission Denied', 'Cannot access videos');
    return;
  }

  try {
    const result = await DocumentPicker.pick({
      type: [DocumentPicker.types.video],
    });
    
    if (result && (Array.isArray(result) ? result.length > 0 : true)) {
      const file = Array.isArray(result) ? result[0] : result;
      setMediaPreview({ uri: file.uri, type: file.type || 'video/mp4' });
      handleSendMediaMessage(file.uri, file.type || 'video/mp4', 'video');
      setShowAttachmentOptions(false);
    }
  } catch (err) {
    if (DocumentPicker.isCancel(err)) {
      console.log('User cancelled video selection');
    } else {
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
    }
  }
};

export const handleSendMediaMessage = async (
  uri: string,
  type: string,
  mediaCategory: 'image' | 'video' | 'audio',
  selectedUser: User,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  flatListRef: React.RefObject<any>,
  setMediaPreview: React.Dispatch<React.SetStateAction<{ uri: string; type: string } | null>>
) => {
  try {
    const uriParts = uri.split('/');
    const fileName = uriParts[uriParts.length - 1];
    
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
    
    if (mediaCategory === 'video') {
      Alert.alert("Uploading", "Your video is being uploaded. This might take a moment.");
    }
    
    const sentMessage = await sendMediaMessage(selectedUser.uid, mediaFile, messageType);
    
    if (mediaCategory === 'video') {
      setTimeout(() => {
        Alert.alert("Success", "Video sent successfully");
      }, 500);
    }
    
    setMessages(prevMessages => [...prevMessages, sentMessage as ChatMessage]);
    flatListRef.current?.scrollToEnd({ animated: true });
    
    setMediaPreview(null);
  } catch (error) {
    console.error("Error sending media message:", error);
    Alert.alert("Error", "Failed to send media message. Please try again.");
  }
};

export const formatMessageTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export const formatDateHeading = (timestamp: number) => {
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

export const markMessagesAsRead = async (
  messages: ChatMessage[],
  currentUser: User,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) => {
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