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
    if (!receiverUid) {
      console.error("Invalid receiver UID provided to fetchMessages:", receiverUid);
      return [];
    }
    
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setUID(receiverUid)
      .setLimit(50)
      .build();
    
    const messages = await messagesRequest.fetchPrevious();
    
    if (!messages || !Array.isArray(messages)) {
      console.warn("fetchMessages: No messages returned or invalid format");
      return [];
    }
    
    return messages;
  } catch (error) {
    console.error("Error fetching messages:", error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
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
        const attachment = message.getAttachment();
        if (attachment) {
          // Convert media message to include attachment
          (message as any).attachment = {
            url: attachment.getUrl(),
            type: attachment.getMimeType(),
            name: message.getType() === CometChat.MESSAGE_TYPE.IMAGE ? 'image.jpg' :
                  message.getType() === CometChat.MESSAGE_TYPE.VIDEO ? 'video.mp4' :
                  'audio.mp3'
          };
        }
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

export const getThreadMessageCount = async (parentMessageId: string): Promise<number> => {
  try {
    // Create a messages request for thread messages with the given parent ID
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setParentMessageId(parseInt(parentMessageId))
      .setLimit(100) // Set a high limit to get a reasonably accurate count
      .build();
    
    // Fetch the thread messages
    const threadMessages = await messagesRequest.fetchPrevious();
    
    // Return the count of thread messages
    if (Array.isArray(threadMessages)) {
      // Filter out deleted messages if needed
      const activeThreads = threadMessages.filter(message => 
        !(message.getDeletedAt && message.getDeletedAt())
      );
      console.log(`Thread count for message ${parentMessageId}: ${activeThreads.length}`);
      return activeThreads.length;
    }
    
    return 0;
  } catch (error) {
    console.error(`Error fetching thread count for message ${parentMessageId}:`, error);
    return 0; // Return 0 on error
  }
};

export const sendMediaMessage = async (
  receiverUid: string, 
  mediaFile: { 
    uri: string; 
    type: string;
    name: string;
  }, 
  messageType: typeof CometChat.MESSAGE_TYPE.IMAGE | 
               typeof CometChat.MESSAGE_TYPE.VIDEO | 
               typeof CometChat.MESSAGE_TYPE.AUDIO
): Promise<ChatMessage> => {
  try {
    console.log(`Sending media message: type=${messageType}, uri=${mediaFile.uri}`);
    
    // Create a media message
    const mediaMessage = new CometChat.MediaMessage(
      receiverUid,
      mediaFile,
      messageType,
      CometChat.RECEIVER_TYPE.USER
    );
    
    // For videos, set some metadata to help with playback
    if (messageType === CometChat.MESSAGE_TYPE.VIDEO) {
      mediaMessage.setMetadata({
        fileType: 'video/mp4',
        playable: true
      });
    }
    
    // Send the media message
    const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
    console.log("Media message sent successfully:", sentMessage);
    
    const attachment = (sentMessage as CometChat.MediaMessage).getAttachment();
    console.log("Attachment details:", attachment ? {
      url: attachment.getUrl(),
      type: attachment.getMimeType(),
      name: attachment.getName()
    } : "No attachment");
    
    // Set message text based on type
    let messageText = '';
    if (messageType === CometChat.MESSAGE_TYPE.IMAGE) {
      messageText = 'Image';
    } else if (messageType === CometChat.MESSAGE_TYPE.VIDEO) {
      messageText = 'Video';
    } else if (messageType === CometChat.MESSAGE_TYPE.AUDIO) {
      messageText = 'Audio';
    } else {
      messageText = 'Media';
    }
    
    return {
      id: sentMessage.getId().toString(),
      text: messageText,
      sender: {
        uid: sentMessage.getSender().getUid(),
        name: sentMessage.getSender().getName(),
        avatar: sentMessage.getSender().getAvatar()
      },
      sentAt: sentMessage.getSentAt(),
      type: sentMessage.getType(),
      status: 'sent',
      attachment: attachment ? {
        url: attachment.getUrl(),
        type: attachment.getMimeType(),
        name: messageType === CometChat.MESSAGE_TYPE.VIDEO ? 'video.mp4' : mediaFile.name
      } : undefined
    };
  } catch (error) {
    console.error("Error sending media message:", error);
    throw error;
  }
};

export const sendThreadMessage = async (receiverUid: string, message: string, parentMessageId: string): Promise<ChatMessage> => {
  try {
    const textMessage = new CometChat.TextMessage(
      receiverUid,
      message,
      CometChat.RECEIVER_TYPE.USER
    );
    
    textMessage.setParentMessageId(parseInt(parentMessageId));
    
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
      status: 'sent',
      parentMessageId: sentMessage.getParentMessageId()?.toString()
    };
  } catch (error) {
    console.error("Error sending thread message:", error);
    throw error;
  }
};

export const fetchThreadMessages = async (parentMessageId: string) => {
  try {
    if (!parentMessageId) {
      console.error("Invalid parent message ID provided to fetchThreadMessages:", parentMessageId);
      return [];
    }
    
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setParentMessageId(parseInt(parentMessageId))
      .setLimit(50)
      .build();
    
    const messages = await messagesRequest.fetchPrevious();
    
    if (!messages || !Array.isArray(messages)) {
      console.warn("fetchThreadMessages: No messages returned or invalid format");
      return [];
    }
    
    return messages;
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};

export const subscribeToThreadMessages = (parentMessageId: string, callback: (message: CometChat.BaseMessage) => void) => {
  const listenerID = `thread_message_listener_${parentMessageId}`;
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onTextMessageReceived: (message: CometChat.TextMessage) => {
        if (message.getParentMessageId()?.toString() === parentMessageId) {
          console.log("Thread text message received:", message);
          callback(message);
        }
      },
      onMediaMessageReceived: (message: CometChat.MediaMessage) => {
        if (message.getParentMessageId()?.toString() === parentMessageId) {
          console.log("Thread media message received:", message);
          callback(message);
        }
      },
      onCustomMessageReceived: (message: CometChat.CustomMessage) => {
        if (message.getParentMessageId()?.toString() === parentMessageId) {
          console.log("Thread custom message received:", message);
          callback(message);
        }
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Thread message listener error:", error);
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
    console.log("Thread message listener removed:", listenerID);
  };
};

export const sendMediaThreadMessage = async (
  receiverUid: string, 
  mediaFile: { 
    uri: string; 
    type: string;
    name: string;
  }, 
  messageType: typeof CometChat.MESSAGE_TYPE.IMAGE | 
               typeof CometChat.MESSAGE_TYPE.VIDEO | 
               typeof CometChat.MESSAGE_TYPE.AUDIO,
  parentMessageId: string
): Promise<ChatMessage> => {
  try {
    console.log(`Sending media thread message: type=${messageType}, uri=${mediaFile.uri}, parentMessageId=${parentMessageId}`);
    
    // Create a media message
    const mediaMessage = new CometChat.MediaMessage(
      receiverUid,
      mediaFile,
      messageType,
      CometChat.RECEIVER_TYPE.USER
    );
    
    // Set parent message ID
    mediaMessage.setParentMessageId(parseInt(parentMessageId));
    
    // For videos, set some metadata to help with playback
    if (messageType === CometChat.MESSAGE_TYPE.VIDEO) {
      mediaMessage.setMetadata({
        fileType: 'video/mp4',
        playable: true
      });
    }
    
    // Send the media message
    const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
    console.log("Media thread message sent successfully:", sentMessage);
    
    const attachment = (sentMessage as CometChat.MediaMessage).getAttachment();
    console.log("Attachment details:", attachment ? {
      url: attachment.getUrl(),
      type: attachment.getMimeType(),
      name: attachment.getName()
    } : "No attachment");
    
    // Set message text based on type
    let messageText = '';
    if (messageType === CometChat.MESSAGE_TYPE.IMAGE) {
      messageText = 'Image';
    } else if (messageType === CometChat.MESSAGE_TYPE.VIDEO) {
      messageText = 'Video';
    } else if (messageType === CometChat.MESSAGE_TYPE.AUDIO) {
      messageText = 'Audio';
    } else {
      messageText = 'Media';
    }
    
    return {
      id: sentMessage.getId().toString(),
      text: messageText,
      sender: {
        uid: sentMessage.getSender().getUid(),
        name: sentMessage.getSender().getName(),
        avatar: sentMessage.getSender().getAvatar()
      },
      sentAt: sentMessage.getSentAt(),
      type: sentMessage.getType(),
      status: 'sent',
      parentMessageId: sentMessage.getParentMessageId()?.toString(),
      attachment: attachment ? {
        url: attachment.getUrl(),
        type: attachment.getMimeType(),
        name: messageType === CometChat.MESSAGE_TYPE.VIDEO ? 'video.mp4' : mediaFile.name
      } : undefined
    };
  } catch (error) {
    console.error("Error sending media thread message:", error);
    throw error;
  }
}; 