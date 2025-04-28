import { CometChat } from "@cometchat/chat-sdk-react-native";
import { registerPushNotificationToken, unregisterPushNotificationToken } from "./pushNotifications";

const APP_ID = "272268d25643b5db";
const REGION = "IN";
const AUTH_KEY = "3a1b1fef651a2279ff270d847dd67991ded9808b";

// Initialize CometChat
export const initCometChat = async () => {
  try {
    const appSettings = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(REGION)
      .build();
    
    return await CometChat.init(APP_ID, appSettings);
  } catch (error) {
    console.error("CometChat initialization failed:", error);
    throw error;
  }
};

// Login to CometChat
export const loginCometChat = async (uid: string) => {
  try {
    const user = await CometChat.login(uid, AUTH_KEY);
    console.log("CometChat login successful:", user);
    
    // Register FCM token for push notifications
    try {
      await registerPushNotificationToken();
    } catch (tokenError) {
      console.error("Failed to register push notification token:", tokenError);
      // Continue with login even if token registration fails
    }
    
    return user;
  } catch (error) {
    console.error("CometChat login failed:", error);
    throw error;
  }
};

// Logout from CometChat
export const logoutCometChat = async () => {
  try {
    // Unregister push notification token before logout
    try {
      await unregisterPushNotificationToken();
    } catch (tokenError) {
      console.error("Failed to unregister push notification token:", tokenError);
      // Continue with logout even if token unregistration fails
    }
    
    // Perform CometChat logout
    const response = await CometChat.logout();
    console.log("CometChat logout successful");
    return response;
  } catch (error) {
    console.error("CometChat logout failed:", error);
    throw error;
  }
};

// Improve the getMessageById function to properly handle message metadata
export const getMessageById = async (messageId: string) => {
  try {
    console.log("Getting message by ID:", messageId);
    return await CometChat.getMessageById(parseInt(messageId));
  } catch (error) {
    console.error("Error getting message by ID:", error);
    throw error;
  }
};

// Enhance updateMessage to properly handle metadata
export const updateMessage = async (message: CometChat.BaseMessage) => {
  try {
    console.log("Updating message:", message.getId());
    return await CometChat.updateMessage(message);
  } catch (error) {
    console.error("Error updating message:", error);
    throw error;
  }
};


export const addReactionToMessage = async (messageId: string, emoji: string, uid: string, name: string) => {
  try {
    // First get the message
    const message = await getMessageById(messageId);
    if (!message) throw new Error("Message not found");
    
    // Get or create metadata
    let metadata = {};
    try {
      if ((message as any).getMetadata && typeof (message as any).getMetadata === 'function') {
        const existingMetadata = (message as any).getMetadata();
        if (existingMetadata) metadata = existingMetadata;
      }
    } catch (error) {
      console.warn("Error getting metadata, creating new:", error);
    }
    
    // Add the reaction
    if (!metadata.reactions) metadata.reactions = {};
    if (!metadata.reactions[emoji]) metadata.reactions[emoji] = {};
    
    metadata.reactions[emoji][uid] = { name };
    
    // Set the metadata back
    if ((message as any).setMetadata) {
      (message as any).setMetadata(metadata);
      return await updateMessage(message);
    } else {
      throw new Error("Message doesn't support metadata");
    }
  } catch (error) {
    console.error("Error adding reaction:", error);
    throw error;
  }
};

// Function to remove a reaction
export const removeReactionFromMessage = async (messageId: string, emoji: string, uid: string) => {
  try {
    // First get the message
    const message = await getMessageById(messageId);
    if (!message) throw new Error("Message not found");
    
    // Get metadata
    let metadata = {};
    try {
      if ((message as any).getMetadata && typeof (message as any).getMetadata === 'function') {
        const existingMetadata = (message as any).getMetadata();
        if (existingMetadata) metadata = existingMetadata;
      }
    } catch (error) {
      console.warn("Error getting metadata:", error);
      return null; // No metadata to modify
    }
    
    // Remove the reaction if it exists
    if (metadata.reactions && 
        metadata.reactions[emoji] && 
        metadata.reactions[emoji][uid]) {
      
      delete metadata.reactions[emoji][uid];
      
      // Remove empty reaction
      if (Object.keys(metadata.reactions[emoji]).length === 0) {
        delete metadata.reactions[emoji];
      }
      
      // Set the metadata back
      if ((message as any).setMetadata) {
        (message as any).setMetadata(metadata);
        return await updateMessage(message);
      }
    }
    
    return null; // No reaction to remove
  } catch (error) {
    console.error("Error removing reaction:", error);
    throw error;
  }
}; 