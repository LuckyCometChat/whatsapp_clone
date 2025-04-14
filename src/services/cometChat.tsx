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