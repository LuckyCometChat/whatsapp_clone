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




const markAsDelivered=async(messageId:string, recieverId:string, recieverType:string, senderId: string)=>{
  try{
    const message = new CometChat.TextMessage(messageId, '', CometChat.RECEIVER_TYPE.USER);
    message.setReceiverId(recieverId);
    message.setReceiverType(recieverType);
    message.setSender(new CometChat.User(senderId));
    CometChat.markAsDelivered(message);
  }catch(error){
    console.error("Error marking message as delivered:", error);
    throw error;
  }
}

const markAsRead=async(messageId:string, recieverId:string, recieverType:string, senderId: string)=>{
  try{
    const message = new CometChat.TextMessage(messageId, '', CometChat.RECEIVER_TYPE.USER);
    message.setReceiverId(recieverId);
    message.setReceiverType(recieverType);
    message.setSender(new CometChat.User(senderId));
    CometChat.markAsRead(message);
  }catch(error){
    console.error("Error marking message as read:", error);
    throw error;
  }
}

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

export const EditMessage = async (messageId: string, message: string): Promise<ChatMessage> => {
  try {
    const textMessage = new CometChat.TextMessage(
      messageId,
      message,
      CometChat.RECEIVER_TYPE.USER
    );
    
    textMessage.setId(parseInt(messageId));
    
    const editedMessage = await CometChat.editMessage(textMessage);

   
    return {
      id: editedMessage.getId().toString(),
      text: (editedMessage as CometChat.TextMessage).getText(),
      sender: {
        uid: editedMessage.getSender().getUid(),
        name: editedMessage.getSender().getName(),
        avatar: editedMessage.getSender().getAvatar()
      },
      sentAt: editedMessage.getSentAt(),
      type: editedMessage.getType(),
      status: 'sent'
    };
  }
  catch (error) {
    console.error("Error editing message:", error);
    throw error;
  }
};

export const subscribeToMessageEdit = (callback: (message: CometChat.BaseMessage) => void) => {
  const listenerID = 'message_edit_listener';
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onMessageEdited: (message: CometChat.BaseMessage) => {
        console.log("Message edited:", message);
        callback(message);
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Message edit listener error:", error);
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
    console.log("Message edit listener removed",listenerID);
  };
};

export const typeMessageStarted = async (receiverUid: string) => {
  try {
    const typingIndicator = new CometChat.TypingIndicator(
      receiverUid,
      CometChat.RECEIVER_TYPE.USER
    );
    CometChat.startTyping(typingIndicator);
  } catch (error) {
    console.error("Error starting typing indicator:", error);
    throw error;
  }
};

export const typeMessageEnded = async (receiverUid: string) => {
  try {
    const typingIndicator = new CometChat.TypingIndicator(
      receiverUid,
      CometChat.RECEIVER_TYPE.USER
    );
    CometChat.endTyping(typingIndicator);
  } catch (error) {
    console.error("Error ending typing indicator:", error);
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
  return () => {
    CometChat.removeUserListener(listenerID);
  };
};





export const deleteMessage = async (messageId: string): Promise<void> => {
  try {
    await CometChat.deleteMessage(messageId);
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
};

export const subscribeToMessageDeletion = (callback: (message: CometChat.BaseMessage) => void) => {
  const listenerID = 'message_deletion_listener';
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onMessageDeleted: (message: CometChat.BaseMessage) => {
        console.log("Message deleted:", message);
        callback(message);
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Message deletion listener error:", error);
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
  };
};

export const subscribeToMessages = (callback: (message: CometChat.BaseMessage) => void) => {
  const listenerID = 'message_listener';
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onTextMessageReceived: (message: CometChat.TextMessage) => {
        console.log("Text message received:", message);
        callback(message);
      },
      onMediaMessageReceived: (message: CometChat.MediaMessage) => {
        console.log("Media message received:", message);
        callback(message);
      },
      onCustomMessageReceived: (message: CometChat.CustomMessage) => {
        console.log("Custom message received:", message);
        callback(message);
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Message listener error:", error);
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
    console.log("Message listener removed:", listenerID);
  };
};

export const subscribeToReactions = (callback: (message: CometChat.BaseMessage) => void) => {
  const listenerID = 'reaction_listener';
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onMessageReactionAdded: (message: CometChat.BaseMessage) => {
        console.log("Reaction added:", message);
        callback(message);
      },
      onMessageReactionRemoved: (message: CometChat.BaseMessage) => {
        console.log("Reaction removed:", message);
        callback(message);
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Reaction listener error:", error);
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
    console.log("Reaction listener removed:", listenerID);
  };
}; 