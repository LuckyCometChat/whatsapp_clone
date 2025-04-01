import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  FlatList,
  Alert
} from 'react-native';
import { fetchMessages, subscribeToMessageDeletion, subscribeToMessageEdit } from '../../services/cometChat';
import { User, ChatMessage,CometChatMessage  } from '../../types';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import { setupChatListeners, cleanupChatListeners } from './chatListeners';
import { handleSendMessage, handleEditMessage, handleDeleteMessage, handleTyping, handleTypingEnd } from './messageHandlers';
import { ChatUI } from './ChatUI';
import { styles } from './styles';

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
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessage | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const userStatus = userStatuses[selectedUser.uid] || 'offline';

  useEffect(() => {
    loadMessages();
    
    const { typingListenerId, userStatusListenerId, reactionListenerId } = setupChatListeners(
      selectedUser,
      setIsTyping,
      setMessages,
      currentUser
    );

    // Subscribe to user status changes
    const userStatusListener = new CometChat.UserListener({
      onUserOnline: (onlineUser: CometChat.User) => {
        if (onlineUser.getUid() === selectedUser.uid) {
          onUserStatusChange(selectedUser.uid, 'online');
        }
      },
      onUserOffline: (offlineUser: CometChat.User) => {
        if (offlineUser.getUid() === selectedUser.uid) {
          onUserStatusChange(selectedUser.uid, 'offline');
        }
      }
    });

    CometChat.addUserListener(userStatusListenerId, userStatusListener);

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

    return () => {
      cleanupChatListeners(typingListenerId, userStatusListenerId, reactionListenerId);
      unsubscribeDeletion();
      unsubscribeEdit();
    };
  }, [selectedUser, currentUser.uid]);

  const loadMessages = async () => {
    try {
      const fetchedMessages = await fetchMessages(selectedUser.uid);

      const convertedMessages: ChatMessage[] = (fetchedMessages as unknown as CometChatMessage[]).map(msg => ({
        id: msg.id,
        text: msg.text,
        sender: {
          uid: msg.sender.uid,
          name: msg.sender.name,
          avatar: msg.sender.avatar
        },
        sentAt: msg.sentAt,
        type: msg.type,
        status: 'sent',
        reactions: (msg as any).getReactions?.()?.map((reaction: any) => ({
          emoji: reaction.getReaction(),
          count: reaction.getCount(),
          reactedByMe: reaction.getReactedByMe()
        })) || []
      }));

      const sortedMessages = convertedMessages.sort((a, b) => a.sentAt - b.sentAt);
      setMessages(sortedMessages);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleLongPress = (message: ChatMessage, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMessageOptionsPosition({ x: pageX, y: pageY });
    setSelectedMessage(message);
    setShowMessageOptions(true);
  };

  const handleEditSubmit = async () => {
    await handleEditMessage(selectedMessage, editText, setMessages, setEditingMessage, setEditText);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await CometChat.addReaction(messageId, emoji);
      setShowReactions(false);
    } catch (error) {
      console.error("Error adding reaction:", error);
      Alert.alert("Error", "Failed to add reaction. Please try again.");
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
      await CometChat.removeReaction(messageId, emoji);
    } catch (error) {
      console.error("Error removing reaction:", error);
      Alert.alert("Error", "Failed to remove reaction. Please try again.");
    }
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        style={{ flex: 1 }}
      >
        <ChatUI
          messages={messages}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          handleSendMessage={() => handleSendMessage(newMessage, selectedUser, setMessages, setNewMessage, flatListRef)}
          handleLongPress={handleLongPress}
          showMessageOptions={showMessageOptions}
          messageOptionsPosition={messageOptionsPosition}
          selectedMessage={selectedMessage}
          handleEditMessage={() => setEditingMessage(selectedMessage)}
          handleDeleteMessage={() => handleDeleteMessage(selectedMessage, setMessages, setShowMessageOptions)}
          editingMessage={editingMessage}
          editText={editText}
          setEditText={setEditText}
          handleEditSubmit={handleEditSubmit}
          cancelEdit={cancelEdit}
          showReactions={showReactions}
          setShowReactions={setShowReactions}
          handleAddReaction={handleAddReaction}
          selectedMessageForReaction={selectedMessageForReaction}
          currentUser={currentUser}
          selectedUser={selectedUser}
          userStatus={userStatus}
          isTyping={isTyping}
          flatListRef={flatListRef}
          renderReactions={renderReactions}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Chat; 