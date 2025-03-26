import { CometChat } from '@cometchat/chat-sdk-react-native';
import { User, ChatMessage } from '../types';

const APP_ID = "272268d25643b5db";
const REGION = "IN";
const AUTH_KEY = "3a1b1fef651a2279ff270d847dd67991ded9808b";

export const initCometChat = async () => {
  try {
    const appSetting = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(REGION)
      .autoEstablishSocketConnection(true)
      .build();
    
    await CometChat.init(APP_ID, appSetting);
    console.log("CometChat initialization successful");
  } catch (error) {
    console.error("CometChat initialization error:", error);
    throw error;
  }
};

export const loginCometChat = async (uid: string) => {
  try {
    return await CometChat.login(uid, AUTH_KEY);
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logoutCometChat = async () => {
  try {
    await CometChat.logout();
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
};

export const fetchUsers = async () => {
  try {
    const usersRequest = new CometChat.UsersRequestBuilder()
      .setLimit(30)
      .build();
    
    return await usersRequest.fetchNext();
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
};

export const fetchMessages = async (receiverUid: string) => {
  try {
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setUID(receiverUid)
      .setLimit(50)
      .build();
    
    return await messagesRequest.fetchPrevious();
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
};

export const subscribeToMessageStatus = (messageId: string, callback: (status: 'sent' | 'delivered' | 'seen') => void) => {
  const listenerID = `message_status_${messageId}`;
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onMessageDelivered: (receipt: CometChat.MessageReceipt) => {
        if (receipt.getMessageId() === messageId) {
          callback('delivered');
        }
      },
      onMessageRead: (receipt: CometChat.MessageReceipt) => {
        if (receipt.getMessageId() === messageId) {
          callback('seen');
        }
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Message listener error:", error);
      }
    })
  );

  // Return unsubscribe function
  return () => {
    CometChat.removeMessageListener(listenerID);
  };
};

export const sendMessage = async (receiverUid: string, message: string): Promise<ChatMessage> => {
  try {
    const textMessage = new CometChat.TextMessage(
      receiverUid,
      message,
      CometChat.RECEIVER_TYPE.USER
    );
    
    const sentMessage = await CometChat.sendMessage(textMessage);
    
    // Convert to our ChatMessage type with initial 'sent' status
    return {
      id: sentMessage.getId().toString(),
      text: (sentMessage as CometChat.TextMessage).getText(),
      sender: {
        uid: sentMessage.getSender().getUid(),
        name: sentMessage.getSender().getName(),
        avatar: sentMessage.getSender().getAvatar()
      },
      sentAt: sentMessage.getSentAt(),
      type: sentMessage.getType(),
      status: 'sent'
    };
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const subscribeToUserStatus = (uid: string, callback: (status: 'online' | 'offline') => void) => {
  const listenerID = `user_status_${uid}`;
  
  CometChat.addUserListener(
    listenerID,
    new CometChat.UserListener({
      onUserOnline: (onlineUser: CometChat.User) => {
        if (onlineUser.getUid() === uid) {
          callback('online');
        }
      },
      onUserOffline: (offlineUser: CometChat.User) => {
        if (offlineUser.getUid() === uid) {
          callback('offline');
        }
      }
    })
  );

  // Return unsubscribe function
  return () => {
    CometChat.removeUserListener(listenerID);
  };
};

const getStatusIcon = (status: 'sent' | 'delivered' | 'seen') => {
  switch (status) {
    case 'sent':
      return '✓'; // Single tick
    case 'delivered':
      return '✓✓'; // Double tick
    case 'seen':
      return '✓✓'; // Blue double tick
    default:
      return '✓';
  }
}; 