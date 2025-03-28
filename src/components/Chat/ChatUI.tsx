import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  Platform
} from 'react-native';
import { ChatMessage } from '../../types';
import { styles } from './styles';

interface ChatUIProps {
  messages: ChatMessage[];
  newMessage: string;
  setNewMessage: (text: string) => void;
  handleSendMessage: () => void;
  handleLongPress: (message: ChatMessage, event: any) => void;
  showMessageOptions: boolean;
  setShowMessageOptions: (show: boolean) => void;
  messageOptionsPosition: { x: number; y: number };
  selectedMessage: ChatMessage | null;
  handleEditMessage: () => void;
  handleDeleteMessage: () => void;
  editingMessage: ChatMessage | null;
  editText: string;
  setEditText: (text: string) => void;
  handleEditSubmit: () => void;
  cancelEdit: () => void;
  showReactions: boolean;
  setShowReactions: (show: boolean) => void;
  handleAddReaction: (messageId: string, emoji: string) => void;
  selectedMessageForReaction: ChatMessage | null;
  setSelectedMessageForReaction: (message: ChatMessage | null) => void;
  currentUser: any;
  selectedUser: any;
  userStatus: 'online' | 'offline';
  isTyping: boolean;
  flatListRef: React.RefObject<FlatList<ChatMessage>>;
  renderReactions: (message: ChatMessage) => React.ReactNode;
}

export const ChatUI: React.FC<ChatUIProps> = ({
  messages,
  newMessage,
  setNewMessage,
  handleSendMessage,
  handleLongPress,
  showMessageOptions,
  setShowMessageOptions,
  messageOptionsPosition,
  selectedMessage,
  handleEditMessage,
  handleDeleteMessage,
  editingMessage,
  editText,
  setEditText,
  handleEditSubmit,
  cancelEdit,
  showReactions,
  setShowReactions,
  handleAddReaction,
  selectedMessageForReaction,
  setSelectedMessageForReaction,
  currentUser,
  selectedUser,
  userStatus,
  isTyping,
  flatListRef,
  renderReactions
}) => {
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

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isSentByMe = item.sender.uid === currentUser.uid;
    const messageTime = formatMessageTime(item.sentAt);
    const isEditing = editingMessage?.id === item.id;
    const isDeleted = item.text === "This message was deleted";
    const isEdited = item.editedAt !== undefined;
  
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
                <Text style={[
                  styles.messageText,
                  isDeleted && styles.deletedMessageText
                ]}>{item.text}</Text>
                {!isDeleted && (
                  <View style={styles.messageFooter}>
                    <Text style={styles.messageTime}>{messageTime}</Text>
                    {isSentByMe && (
                      <Text style={styles.messageStatus}>✓✓</Text>
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

  return (
    <>
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
      {renderReactionPicker()}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.chatInput}
          value={newMessage}
          onChangeText={setNewMessage}
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
    </>
  );
}; 