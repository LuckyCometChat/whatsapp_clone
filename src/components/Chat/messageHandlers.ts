import { Alert } from 'react-native';
import { ChatMessage, CometChatMessage } from '../../types';
import { sendMessage, EditMessage, deleteMessage, typeMessageStarted, typeMessageEnded } from '../../services/cometChat';

export const handleSendMessage = async (
  newMessage: string,
  selectedUser: { uid: string },
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setNewMessage: (message: string) => void,
  flatListRef: React.RefObject<any>
) => {
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

export const handleEditMessage = async (
  selectedMessage: ChatMessage | null,
  editText: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setEditingMessage: (message: ChatMessage | null) => void,
  setEditText: (text: string) => void
) => {
  if (!selectedMessage || !editText.trim()) return;

  try {
    const editedMessage = await EditMessage(selectedMessage.id, editText);
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === selectedMessage.id ? editedMessage : msg
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
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setShowMessageOptions: (show: boolean) => void
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

export const handleTyping = async (
  selectedUser: { uid: string },
  debouncedTypingIndicator: React.MutableRefObject<NodeJS.Timeout | null>
) => {
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

export const handleTypingEnd = async (selectedUser: { uid: string }) => {
  try {
    await typeMessageEnded(selectedUser.uid);
  } catch (error) {
    console.error("Error ending typing indicator:", error);
  }
}; 