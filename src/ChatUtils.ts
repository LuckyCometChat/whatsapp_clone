import { CometChat } from "@cometchat/chat-sdk-react-native";

// New function to handle thread message conversion
export const convertCometChatMessageToChat = (msg: CometChat.BaseMessage): ChatMessage | null => {
  try {
    console.log("Converting message:", msg?.getId?.());
    
    if (!msg || typeof msg !== 'object') {
      console.log("Message is null or not an object");
      return null;
    }
    
    if ((msg as any).getCategory?.() === "action") {
      console.log("Skipping action message");
      return null;
    }
    
    const sender = msg.getSender?.();
    if (!sender || typeof sender !== 'object') {
      console.log("Invalid sender:", sender);
      return null;
    }
    
    const isDeleted = (msg as any).getDeletedAt?.() !== undefined;
    const editedAt = (msg as any).getEditedAt?.();
    const editedBy = (msg as any).getEditedBy?.();
    const readAt = (msg as any).getReadAt?.();
    const deliveredAt = (msg as any).getDeliveredAt?.();
    const parentMessageId = (msg as any).getParentMessageId?.();
    const threadCount = (msg as any).getReplyCount?.() || 0;
    
    let status: 'sent' | 'delivered' | 'seen' = 'sent';
    
    if (deliveredAt) {
      status = 'delivered';
    }
    if (readAt) {
      status = 'seen';
    }

    let text = '';
    let attachment = undefined;

    if (msg.getType() === CometChat.MESSAGE_TYPE.TEXT) {
      text = (msg as CometChat.TextMessage).getText?.() || '';
    } else if (msg.getType() === CometChat.MESSAGE_TYPE.IMAGE) {
      text = 'Image';
      const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment?.();
      if (mediaAttachment) {
        attachment = {
          url: mediaAttachment.getUrl?.() || '',
          type: mediaAttachment.getMimeType?.() || '',
          name: 'image.jpg'
        };
      }
    } else if (msg.getType() === CometChat.MESSAGE_TYPE.VIDEO) {
      text = 'Video';
      const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment?.();
      if (mediaAttachment) {
        attachment = {
          url: mediaAttachment.getUrl?.() || '',
          type: mediaAttachment.getMimeType?.() || '',
          name: 'video.mp4'
        };
      }
    } else if (msg.getType() === CometChat.MESSAGE_TYPE.AUDIO) {
      text = 'Audio';
      const mediaAttachment = (msg as CometChat.MediaMessage).getAttachment?.();
      if (mediaAttachment) {
        attachment = {
          url: mediaAttachment.getUrl?.() || '',
          type: mediaAttachment.getMimeType?.() || '',
          name: 'audio.mp3'
        };
      }
    }
    
    let reactions: any[] = [];
    try {
      if ((msg as any).getReactions && typeof (msg as any).getReactions === 'function') {
        const rawReactions = (msg as any).getReactions() || [];
        console.log("Raw reactions:", rawReactions);
        if (Array.isArray(rawReactions)) {
          reactions = rawReactions.map(reaction => {
            if (!reaction) return null;
            return {
              emoji: reaction.getReaction?.() || '',
              count: reaction.getCount?.() || 1,
              reactedByMe: reaction.getReactedByMe?.() || false
            };
          }).filter(Boolean);
        }
      }
    } catch (reactionError) {
      console.error("Error processing reactions:", reactionError);
      reactions = [];
    }
    
    return {
      id: msg.getId().toString(),
      text: isDeleted ? "This message was deleted" : text,
      sender: {
        uid: sender.getUid?.() || '',
        name: sender.getName?.() || '',
        avatar: sender.getAvatar?.() || ''
      },
      sentAt: msg.getSentAt?.() || Date.now(),
      type: msg.getType?.() || '',
      status: status,
      editedAt: editedAt,
      editedBy: editedBy,
      attachment: attachment,
      reactions: reactions,
      parentMessageId: parentMessageId ? parentMessageId.toString() : undefined,
      threadCount: threadCount,
      isThreaded: parentMessageId !== undefined
    };
  } catch (msgError) {
    console.error("Error converting individual message:", msgError);
    return null;
  }
}; 