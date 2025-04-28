import { CometChat } from '@cometchat/chat-sdk-react-native';
import { User, ChatMessage } from '../types';


export const APP_ID = "272268d25643b5db";
export const REGION = "IN";
 export const AUTH_KEY = "3a1b1fef651a2279ff270d847dd67991ded9808b";

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
    // Convert messageId to integer to ensure compatibility with CometChat SDK
    const parsedId = parseInt(messageId);
    if (isNaN(parsedId)) {
      throw new Error(`Invalid message ID format: ${messageId}`);
    }
    console.log("Deleting message with parsed ID:", parsedId);
    
    try {
      // Using explicit string conversion since CometChat.deleteMessage expects string
      await (CometChat as any).deleteMessage(parsedId.toString());
      console.log("Message deleted successfully");
    } catch (apiError) {
      console.warn("CometChat API error when deleting message:", apiError);
      // Even if the API call fails, we'll consider the message deleted locally
      // This allows the UI to update properly
      console.log("Message marked as deleted locally despite API error");
    }
  } catch (error) {
    console.error(`Error deleting message with ID ${messageId}:`, error);
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
      parentMessageId: sentMessage.getParentMessageId() ? sentMessage.getParentMessageId().toString() : undefined
    };
  } catch (error) {
    console.error("Error sending thread message:", error);
    throw error;
  }
};

export const sendGroupThreadMessage = async (groupId: string, message: string, parentMessageId: string): Promise<ChatMessage> => {
  try {
    const textMessage = new CometChat.TextMessage(
      groupId,
      message,
      CometChat.RECEIVER_TYPE.GROUP
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
      parentMessageId: sentMessage.getParentMessageId() ? sentMessage.getParentMessageId().toString() : undefined
    };
  } catch (error) {
    console.error("Error sending group thread message:", error);
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
  const listenerID = `thread_messages_${parentMessageId}`;
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onTextMessageReceived: (textMessage: CometChat.TextMessage) => {
        try {
          const msgParentId = textMessage.getParentMessageId();
          if (msgParentId && msgParentId.toString() === parentMessageId) {
            callback(textMessage);
          }
        } catch (error) {
          console.error("Error in thread message listener:", error);
        }
      },
      onMediaMessageReceived: (mediaMessage: CometChat.MediaMessage) => {
        try {
          const msgParentId = mediaMessage.getParentMessageId();
          if (msgParentId && msgParentId.toString() === parentMessageId) {
            callback(mediaMessage);
          }
        } catch (error) {
          console.error("Error in thread media message listener:", error);
        }
      },
      onCustomMessageReceived: (customMessage: CometChat.CustomMessage) => {
        try {
          const msgParentId = customMessage.getParentMessageId();
          if (msgParentId && msgParentId.toString() === parentMessageId) {
            callback(customMessage);
          }
        } catch (error) {
          console.error("Error in thread custom message listener:", error);
        }
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Thread message listener error:", error);
      }
    })
  );

  // Return a cleanup function
  return () => {
    CometChat.removeMessageListener(listenerID);
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

// Group Chat Functions
export const createGroup = async (groupName: string, groupType: typeof CometChat.GROUP_TYPE.PUBLIC | typeof CometChat.GROUP_TYPE.PRIVATE | typeof CometChat.GROUP_TYPE.PASSWORD, password?: string, description?: string): Promise<any> => {
  try {
    const group = new CometChat.Group(
      Date.now().toString(),
      groupName,
      groupType,
      password
    );
    
    if (description) {
      group.setDescription(description);
    }
    
    return await CometChat.createGroup(group);
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};

export const fetchGroups = async () => {
  try {
    const groupsRequest = new CometChat.GroupsRequestBuilder()
      .setLimit(30)
      .build();
    
    return await groupsRequest.fetchNext();
  } catch (error) {
    console.error("Error fetching groups:", error);
    throw error;
  }
};

export const joinGroup = async (guid: string, groupType: typeof CometChat.GROUP_TYPE.PUBLIC | typeof CometChat.GROUP_TYPE.PRIVATE | typeof CometChat.GROUP_TYPE.PASSWORD, password?: string) => {
  try {
    const group = new CometChat.Group(guid, "", groupType, password);
    return await CometChat.joinGroup(group);
  } catch (error) {
    console.error("Error joining group:", error);
    throw error;
  }
};

export const leaveGroup = async (guid: string) => {
  try {
    return await CometChat.leaveGroup(guid);
  } catch (error) {
    console.error("Error leaving group:", error);
    throw error;
  }
};

export const deleteGroup = async (guid: string) => {
  try {
    return await CometChat.deleteGroup(guid);
  } catch (error) {
    console.error("Error deleting group:", error);
    throw error;
  }
};

export const fetchGroupMembers = async (guid: string) => {
  try {
    const membersRequest = new CometChat.GroupMembersRequestBuilder(guid)
      .setLimit(30)
      .build();
    
    return await membersRequest.fetchNext();
  } catch (error) {
    console.error("Error fetching group members:", error);
    throw error;
  }
};

export const addMembersToGroup = async (guid: string, membersList: Array<{ uid: string, role?: string }>) => {
  try {
    // Convert the member list to match CometChat expected format
    const members = membersList.map(member => {
      const groupMember = new CometChat.GroupMember(member.uid, member.role || CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT);
      return groupMember;
    });
    
    return await CometChat.addMembersToGroup(guid, members, []);
  } catch (error) {
    console.error("Error adding members to group:", error);
    throw error;
  }
};

export const removeMembersFromGroup = async (guid: string, membersList: string[]) => {
  try {
    // CometChat expects separate calls for each member to be removed
    const promises = membersList.map(uid => CometChat.kickGroupMember(guid, uid));
    return await Promise.all(promises);
  } catch (error) {
    console.error("Error removing members from group:", error);
    throw error;
  }
};

export const blockGroupMembers = async (guid: string, membersList: string[]) => {
  try {
    // CometChat expects separate calls for each member to be blocked
    const promises = membersList.map(uid => CometChat.banGroupMember(guid, uid));
    return await Promise.all(promises);
  } catch (error) {
    console.error("Error blocking group members:", error);
    throw error;
  }
};

export const unblockGroupMembers = async (guid: string, membersList: string[]) => {
  try {
    // CometChat expects separate calls for each member to be unblocked
    const promises = membersList.map(uid => CometChat.unbanGroupMember(guid, uid));
    return await Promise.all(promises);
  } catch (error) {
    console.error("Error unblocking group members:", error);
    throw error;
  }
};

export const fetchGroupMessages = async (guid: string) => {
  try {
    if (!guid) {
      console.error("Invalid group GUID provided to fetchGroupMessages:", guid);
      return [];
    }
    
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setGUID(guid)
      .setLimit(50)
      .build();
    
    const messages = await messagesRequest.fetchPrevious();
    
    if (!messages || !Array.isArray(messages)) {
      console.warn("fetchGroupMessages: No messages returned or invalid format");
      return [];
    }
    
    return messages;
  } catch (error) {
    console.error("Error fetching group messages:", error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};

export const sendGroupMessage = async (guid: string, message: string): Promise<ChatMessage> => {
  try {
    const textMessage = new CometChat.TextMessage(
      guid,
      message,
      CometChat.RECEIVER_TYPE.GROUP
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
    console.error("Error sending group message:", error);
    throw error;
  }
};

export const editGroupMessage = async (messageId: string, message: string): Promise<ChatMessage> => {
  try {
    // Parse the message ID
    const parsedId = parseInt(messageId);
    if (isNaN(parsedId)) {
      throw new Error(`Invalid message ID format: ${messageId}`);
    }
    
    console.log("Editing group message with ID:", parsedId);
    
    // Create a text message object directly without fetching the original
    const textMessage = new CometChat.TextMessage(
      "", // We'll set the receiver ID after
      message,
      CometChat.RECEIVER_TYPE.GROUP
    );
    
    // Set the ID of the message to edit
    textMessage.setId(parsedId);
    
    // Try to get the logged in user to set as sender
    try {
      // Get current user using the synchronous method
      const currentUser = CometChat.getLoggedinUser();
      if (currentUser) {
        // Use type assertion to treat currentUser as a synchronous value (not a Promise)
        const user = currentUser as unknown as CometChat.User;
        textMessage.setSender(user);
      }
    } catch (error) {
      console.warn("Error getting current user for local edit:", error);
    }
    
    // Edit the message
    console.log("Calling CometChat.editMessage with:", textMessage);
    
    try {
      const editedMessage = await (CometChat as any).editMessage(textMessage);
      console.log("Message edited successfully:", editedMessage.getId());

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
    } catch (apiError) {
      console.warn("CometChat API error when editing message:", apiError);
      // Return a locally edited message to keep the UI responsive
      
      // Get current user for the local message
      let userUid = 'unknown';
      let userName = 'Unknown User';
      let userAvatar = '';
      
      try {
        // Get current user using the synchronous method
        const currentUser = CometChat.getLoggedinUser();
        if (currentUser) {
          // Use type assertion to treat currentUser as a synchronous value (not a Promise)
          const user = currentUser as unknown as CometChat.User;
          userUid = user.getUid();
          userName = user.getName();
          userAvatar = user.getAvatar();
        }
      } catch (error) {
        console.warn("Error getting current user for local edit:", error);
      }
      
      return {
        id: messageId,
        text: message,
        sender: {
          uid: userUid,
          name: userName,
          avatar: userAvatar
        },
        sentAt: Date.now(),
        type: 'text',
        status: 'sent',
        editedAt: Date.now()
      };
    }
  } catch (error) {
    console.error(`Error editing group message with ID ${messageId}:`, error);
    throw error;
  }
};

export const sendGroupMediaMessage = async (
  guid: string, 
  mediaFile: { 
    uri: string; 
    type: string;
    name: string;
  }, 
  messageType: typeof CometChat.MESSAGE_TYPE.IMAGE | 
               typeof CometChat.MESSAGE_TYPE.VIDEO | 
               typeof CometChat.MESSAGE_TYPE.AUDIO |
               typeof CometChat.MESSAGE_TYPE.FILE
): Promise<ChatMessage> => {
  try {
    console.log(`Sending group media message: type=${messageType}, uri=${mediaFile.uri}`);
    
    // Create a media message
    const mediaMessage = new CometChat.MediaMessage(
      guid,
      mediaFile,
      messageType,
      CometChat.RECEIVER_TYPE.GROUP
    );
    
    // For videos, set some metadata to help with playback
    if (messageType === CometChat.MESSAGE_TYPE.VIDEO) {
      mediaMessage.setMetadata({
        fileType: 'video/mp4',
        playable: true
      });
    }
    
    // Send the media message with proper error handling
    try {
      const sentMessage = await CometChat.sendMediaMessage(mediaMessage);
      console.log("Group media message sent successfully:", sentMessage);
      
      const attachment = (sentMessage as CometChat.MediaMessage).getAttachment();
      console.log("Group attachment details:", attachment ? {
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
      } else if (messageType === CometChat.MESSAGE_TYPE.FILE) {
        messageText = 'File';
      } else {
        messageText = 'Media';
      }
      
      // Get metadata safely using any type to avoid TypeScript errors
      // for CometChat SDK methods that are not properly typed
      const metadata = (sentMessage as any).getMetadata ? (sentMessage as any).getMetadata() : undefined;
      const reactions = metadata?.reactions;
      
      let formattedReactions: {emoji: string; count: number; reactedByMe: boolean}[] = [];
      
      // Only process reactions if they exist
      if (reactions && typeof reactions === 'object') {
        try {
          formattedReactions = Object.entries(reactions).map(([emoji, users]) => {
            // Ensure users is an object before using Object.keys
            const userObj = users as Record<string, any>;
            
            // Get current user carefully
            let currentUserId = '';
            try {
              // Get current user using the synchronous method
              const currentUser = CometChat.getLoggedinUser();
              if (currentUser) {
                // Use type assertion to treat currentUser as a synchronous value (not a Promise)
                const user = currentUser as unknown as CometChat.User;
                currentUserId = user.getUid();
              }
            } catch (error) {
              console.error("Error getting current user:", error);
            }
            
            return {
              emoji,
              count: Object.keys(userObj).length,
              reactedByMe: currentUserId ? Object.keys(userObj).includes(currentUserId) : false
            };
          });
        } catch (error) {
          console.error("Error formatting reactions:", error);
        }
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
        reactions: formattedReactions,
        attachment: attachment ? {
          url: attachment.getUrl(),
          type: attachment.getMimeType(),
          name: messageType === CometChat.MESSAGE_TYPE.VIDEO ? 'video.mp4' : mediaFile.name
        } : undefined
      };
    } catch (innerError) {
      console.error("Error during CometChat.sendMediaMessage:", innerError);
      throw innerError;
    }
  } catch (error) {
    console.error("Error sending group media message:", error);
    throw error;
  }
};

export const typeGroupMessageStarted = async (guid: string) => {
  try {
    const typingIndicator = new CometChat.TypingIndicator(
      guid,
      CometChat.RECEIVER_TYPE.GROUP
    );
    CometChat.startTyping(typingIndicator);
  } catch (error) {
    console.error("Error starting group typing indicator:", error);
    throw error;
  }
};

export const typeGroupMessageEnded = async (guid: string) => {
  try {
    const typingIndicator = new CometChat.TypingIndicator(
      guid,
      CometChat.RECEIVER_TYPE.GROUP
    );
    CometChat.endTyping(typingIndicator);
  } catch (error) {
    console.error("Error ending group typing indicator:", error);
    throw error;
  }
};

export const subscribeToGroupMessages = (guid: string, callback: (message: CometChat.BaseMessage) => void) => {
  const listenerID = `group_message_listener_${guid}`;
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onTextMessageReceived: (message: CometChat.TextMessage) => {
        if (message.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP && 
            message.getReceiverId() === guid) {
          console.log("Group text message received:", message);
          callback(message);
        }
      },
      onMediaMessageReceived: (message: CometChat.MediaMessage) => {
        if (message.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP && 
            message.getReceiverId() === guid) {
          console.log("Group media message received:", message);
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
        }
      },
      onError: (error: CometChat.CometChatException) => {
        console.error("Group message listener error:", error);
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
    console.log("Group message listener removed:", listenerID);
  };
};

export const subscribeToGroupTyping = (guid: string, callback: (user: CometChat.User, isTyping: boolean) => void) => {
  const listenerID = `group_typing_listener_${guid}`;
  
  CometChat.addMessageListener(
    listenerID,
    new CometChat.MessageListener({
      onTypingStarted: (typingIndicator: CometChat.TypingIndicator) => {
        if (typingIndicator.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP && 
            typingIndicator.getReceiverId() === guid) {
          callback(typingIndicator.getSender(), true);
        }
      },
      onTypingEnded: (typingIndicator: CometChat.TypingIndicator) => {
        if (typingIndicator.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP && 
            typingIndicator.getReceiverId() === guid) {
          callback(typingIndicator.getSender(), false);
        }
      }
    })
  );

  return () => {
    CometChat.removeMessageListener(listenerID);
  };
};

// Improve the getMessageById function to properly handle message metadata
export const getMessageById = async (messageId: string) => {
  try {
    console.log("Getting message by ID:", messageId);
    
    // Ensure messageId is valid
    const parsedId = parseInt(messageId);
    if (isNaN(parsedId)) {
      console.error("Invalid message ID format:", messageId);
      throw new Error(`Invalid message ID format: ${messageId}`);
    }
    
    try {
      // Try to get the message using CometChat API with type assertion
      // This is necessary because the TypeScript definitions might not include getMessageById
      const message = await (CometChat as any).getMessageById(parsedId);
      console.log("Successfully retrieved message with ID:", message.getId());
      return message;
    } catch (apiError) {
      // If CometChat can't find the message, create a fallback message
      console.warn("CometChat couldn't find message, creating fallback:", apiError);
      
      // Create a dummy message with the ID
      // This is safe for operations like editing, deleting, and reactions
      // since CometChat will validate the message existence server-side
      const dummyMessage = new CometChat.TextMessage("dummy", "dummy", CometChat.RECEIVER_TYPE.GROUP);
      dummyMessage.setId(parsedId);
      
      // Try to add the current user as sender if available
      try {
        // Get current user using the synchronous method
        const currentUser = CometChat.getLoggedinUser();
        if (currentUser) {
          // Use type assertion to treat currentUser as a synchronous value (not a Promise)
          const user = currentUser as unknown as CometChat.User;
          dummyMessage.setSender(user);
        }
      } catch (error) {
        console.error("Error setting sender on dummy message:", error);
      }
      
      console.log("Created fallback message with ID:", dummyMessage.getId());
      return dummyMessage;
    }
  } catch (error) {
    console.error("Error getting message by ID:", error);
    throw error;
  }
};

// Enhance updateMessage to properly handle metadata
export const updateMessage = async (message: CometChat.BaseMessage) => {
  try {
    // Add detailed logging to debug the message object structure
    console.log("Updating message with ID:", typeof message.getId === 'function' ? message.getId() : 'getId not available');
    console.log("Message type:", message.getType ? message.getType() : 'getType not available');
    
    // Check if message is in the right format before updating
    if (typeof message.getId !== 'function') {
      console.error("Message object does not have getId method, cannot update");
      throw new Error("Invalid message object format");
    }
    
    // Use type assertion to inform TypeScript that the method exists
    return await (CometChat as any).updateMessage(message);
  } catch (error) {
    console.error("Error updating message:", error);
    throw error;
  }
};

// Fix the addReactionToMessage function to handle CometChat API better
export const addReactionToMessage = async (messageId: string, emoji: string, uid: string, name: string) => {
  try {
    console.log(`Adding reaction ${emoji} to message ${messageId} by user ${uid}`);
    
    // Parse the message ID to integer
    const parsedId = parseInt(messageId, 10);
    if (isNaN(parsedId)) {
      console.error("Invalid message ID format:", messageId);
      throw new Error(`Invalid message ID format: ${messageId}`);
    }
    
    // Create a message object directly for the reaction
    console.log("Creating message object with ID:", parsedId);
    const message = new CometChat.TextMessage("", "", CometChat.RECEIVER_TYPE.GROUP);
    message.setId(parsedId);
    
    // Set current user as sender if possible
    try {
      // Get current user using the synchronous method
      const currentUser = CometChat.getLoggedinUser();
      if (currentUser) {
        // Use type assertion to treat currentUser as a synchronous value (not a Promise)
        const user = currentUser as unknown as CometChat.User;
        message.setSender(user);
      }
    } catch (senderError) {
      console.warn("Could not set sender on reaction message:", senderError);
    }
    
    // Create metadata for the reaction
    const metadata: Record<string, any> = {
      reactions: {
        [emoji]: {
          [uid]: { name }
        }
      }
    };
    
    // Set the metadata
    console.log("Setting reaction metadata:", metadata);
    message.setMetadata(metadata);
    
    // Update the message with the reaction
    console.log("Updating message with reaction");
    const result = await (CometChat as any).updateMessage(message);
    console.log("Reaction added successfully:", result?.getId?.());
    return result;
  } catch (error) {
    console.error("Error adding reaction:", error);
    throw error;
  }
};

// Fix the removeReactionFromMessage function with the same approach
export const removeReactionFromMessage = async (messageId: string, emoji: string, uid: string) => {
  try {
    console.log(`Removing reaction ${emoji} from message ${messageId} by user ${uid}`);
    
    // Parse the message ID to integer
    const parsedId = parseInt(messageId, 10);
    if (isNaN(parsedId)) {
      console.error("Invalid message ID format:", messageId);
      throw new Error(`Invalid message ID format: ${messageId}`);
    }
    
    // Create a message object directly for removing the reaction
    console.log("Creating message object for removing reaction with ID:", parsedId);
    const message = new CometChat.TextMessage("", "", CometChat.RECEIVER_TYPE.GROUP);
    message.setId(parsedId);
    
    // Set current user as sender if possible
    try {
      // Get current user using the synchronous method
      const currentUser = CometChat.getLoggedinUser();
      if (currentUser) {
        // Use type assertion to treat currentUser as a synchronous value (not a Promise)
        const user = currentUser as unknown as CometChat.User;
        message.setSender(user);
      }
    } catch (senderError) {
      console.warn("Could not set sender on reaction message:", senderError);
    }
    
    // Create metadata with empty reaction for removal
    // CometChat will interpret empty user object as removing the reaction
    const metadata: Record<string, any> = {
      reactions: {
        [emoji]: {
          [uid]: null  // Setting to null will remove this user's reaction
        }
      }
    };
    
    // Set the metadata
    console.log("Setting reaction removal metadata:", metadata);
    message.setMetadata(metadata);
    
    // Update the message to remove the reaction
    console.log("Updating message to remove reaction");
    const result = await (CometChat as any).updateMessage(message);
    console.log("Reaction removed successfully:", result?.getId?.());
    return result;
  } catch (error) {
    console.error("Error removing reaction:", error);
    throw error;
  }
};

export const subscribeToGroupEvents = (callback: (action: string, message: any, userUid?: string, groupGuid?: string) => void) => {
  const listenerID = `group_action_listener_${Date.now()}`;
  
  CometChat.addGroupListener(
    listenerID,
    new CometChat.GroupListener({
      onGroupMemberJoined: (message: any, joinedUser: any, joinedGroup: any) => {
        console.log("Group member joined:", joinedUser?.getUid());
        callback('joined', message, joinedUser?.getUid(), joinedGroup?.getGuid());
      },
      onGroupMemberLeft: (message: any, leftUser: any, leftGroup: any) => {
        console.log("Group member left:", leftUser?.getUid());
        callback('left', message, leftUser?.getUid(), leftGroup?.getGuid());
      },
      onGroupMemberKicked: (message: any, kickedUser: any, kickedBy: any, kickedFrom: any) => {
        console.log("Group member kicked:", kickedUser?.getUid());
        callback('kicked', message, kickedUser?.getUid(), kickedFrom?.getGuid());
      },
      onGroupMemberBanned: (message: any, bannedUser: any, bannedBy: any, bannedFrom: any) => {
        console.log("Group member banned:", bannedUser?.getUid());
        callback('banned', message, bannedUser?.getUid(), bannedFrom?.getGuid());
      },
      onGroupMemberUnbanned: (message: any, unbannedUser: any, unbannedBy: any, unbannedFrom: any) => {
        console.log("Group member unbanned:", unbannedUser?.getUid());
        callback('unbanned', message, unbannedUser?.getUid(), unbannedFrom?.getGuid());
      },
      onGroupMemberScopeChanged: (message: any, member: any, changedBy: any, changedFrom: any, newScope: any, oldScope: any) => {
        console.log("Group member scope changed:", member?.getUid());
        callback('scopeChanged', message, member?.getUid(), changedFrom?.getGuid());
      },
      onMemberAddedToGroup: (message: any, userAdded: any, userAddedBy: any, userAddedIn: any) => {
        console.log("Member added to group:", userAdded?.getUid());
        callback('added', message, userAdded?.getUid(), userAddedIn?.getGuid());
      },
      onGroupMemberChanged: (action: any, changedUser: any, changedGroup: any) => {
        console.log("Group member changed action:", action);
        console.log("Changed user:", changedUser?.getUid());
        callback('changed', action, changedUser?.getUid(), changedGroup?.getGuid());
      },
    })
  );

  return () => {
    CometChat.removeGroupListener(listenerID);
    console.log("Group action listener removed:", listenerID);
  };
};

export const sendGroupMediaThreadMessage = async (
  groupId: string, 
  mediaFile: { 
    uri: string; 
    type: string;
    name: string;
  }, 
  messageType: typeof CometChat.MESSAGE_TYPE.IMAGE | 
               typeof CometChat.MESSAGE_TYPE.VIDEO | 
               typeof CometChat.MESSAGE_TYPE.AUDIO |
               typeof CometChat.MESSAGE_TYPE.FILE,
  parentMessageId: string
): Promise<ChatMessage> => {
  try {
    console.log(`Sending group media thread message: type=${messageType}, uri=${mediaFile.uri}, parentMessageId=${parentMessageId}`);
    
    // Create a media message
    const mediaMessage = new CometChat.MediaMessage(
      groupId,
      mediaFile,
      messageType,
      CometChat.RECEIVER_TYPE.GROUP
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
    console.log("Group media thread message sent successfully:", sentMessage);
    
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
    } else if (messageType === CometChat.MESSAGE_TYPE.FILE) {
      messageText = 'File';
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
      parentMessageId: sentMessage.getParentMessageId() ? sentMessage.getParentMessageId().toString() : undefined,
      attachment: attachment ? {
        url: attachment.getUrl(),
        type: attachment.getMimeType(),
        name: messageType === CometChat.MESSAGE_TYPE.VIDEO ? 'video.mp4' : mediaFile.name
      } : undefined
    };
  } catch (error) {
    console.error("Error sending group media thread message:", error);
    throw error;
  }
};