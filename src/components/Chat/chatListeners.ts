import { CometChat } from '@cometchat/chat-sdk-react-native';
import { ChatMessage } from '../../types';

export const setupChatListeners = (
  selectedUser: { uid: string },
  setIsTyping: (isTyping: boolean) => void,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  currentUser: { uid: string }
) => {
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
         
        }
      },
      onUserOffline: (offlineUser: CometChat.User) => {
        if (offlineUser.getUid() === selectedUser.uid) {
         
        }
      }
    })
  );

  // Reaction listener
  const reactionListenerId = 'reaction_listener';
  CometChat.addMessageListener(
    reactionListenerId,
    new CometChat.MessageListener({
      onMessageReactionAdded: (message: CometChat.BaseMessage) => {
        const messageId = message.getId().toString();
        setMessages(prevMessages => 
          prevMessages.map(msg => {
            if (msg.id === messageId) {
              const reactions = message.getReactions() || [];
              return {
                ...msg,
                reactions: reactions.map(reaction => ({
                  emoji: reaction.getReaction(),
                  count: reaction.getCount(),
                  reactedByMe: reaction.getReactedByMe()
                }))
              };
            }
            return msg;
          })
        );
      },
      onMessageReactionRemoved: (message: CometChat.BaseMessage) => {
        const messageId = message.getId().toString();
        setMessages(prevMessages => 
          prevMessages.map(msg => {
            if (msg.id === messageId) {
              const reactions = message.getReactions() || [];
              return {
                ...msg,
                reactions: reactions.map(reaction => ({
                  emoji: reaction.getReaction(),
                  count: reaction.getCount(),
                  reactedByMe: reaction.getReactedByMe()
                }))
              };
            }
            return msg;
          })
        );
      }
    })
  );

  return {
    typingListenerId,
    userStatusListenerId,
    reactionListenerId
  };
};

export const cleanupChatListeners = (
  typingListenerId: string,
  userStatusListenerId: string,
  reactionListenerId: string
) => {
  CometChat.removeMessageListener(typingListenerId);
  CometChat.removeUserListener(userStatusListenerId);
  CometChat.removeMessageListener(reactionListenerId);
}; 