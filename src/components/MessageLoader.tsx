import { User, ChatMessage } from '../types/index';
import { CometChat } from '@cometChat/chat-sdk-react-native';
import { fetchMessages } from '../services/cometChat';

export const loadMessages = async (
  selectedUser: User,
  currentUser: User,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  oldestMessageId?: string,
  shouldAppend: boolean = false
) => {
  try {
    console.log("Fetching messages for user:", selectedUser.uid, "from message:", oldestMessageId);
    const fetchedMessages = await fetchMessages(selectedUser.uid, oldestMessageId);
    console.log("fetchedMessages:", fetchedMessages ? fetchedMessages.length : "null");

    if (!fetchedMessages || !Array.isArray(fetchedMessages) || fetchedMessages.length === 0) {
      console.log("No messages to process");
      if (!shouldAppend) {
        setMessages([]);
      }
      return false; // Return false to indicate no more messages
    }

    const convertedMessages: ChatMessage[] = [];
    
    for (const msg of fetchedMessages as unknown as CometChat.BaseMessage[]) {
      try {
        console.log("Processing message:", msg?.getId?.());
        
        if (!msg || typeof msg !== 'object') {
          console.log("Message is null or not an object");
          continue;
        }
        if (msg.getCategory?.() === "action" && msg.getType?.() === "call") {
          console.log("Skipping call-ended action message");
          continue;
        }
        if ((msg as any).getCategory?.() === "action" ) {
          console.log("Skipping action/call message");
          continue;
        }
        
        const sender = msg.getSender?.();
        if (!sender || typeof sender !== 'object') {
          console.log("Invalid sender:", sender);
          continue;
        }
        
        const isDeleted = (msg as any).getDeletedAt?.() !== undefined;
        const editedAt = (msg as any).getEditedAt?.();
        const editedBy = (msg as any).getEditedBy?.();
        const readAt = (msg as any).getReadAt?.();
        const deliveredAt = (msg as any).getDeliveredAt?.();
        let status: 'sent' | 'delivered' | 'seen' = 'sent';
        
        if (deliveredAt) {
          status = 'delivered';
        }
        if (readAt) {
          status = 'seen';
        }

        let text = '';
        let attachment: { url: string; type: string; name: string } | undefined = undefined;

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
        
        convertedMessages.push({
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
          reactions: reactions
        });
      } catch (msgError) {
        console.error("Error processing individual message:", msgError);
      }
    }

    console.log("Converted messages:", convertedMessages.length);
    const sortedMessages = convertedMessages.sort((a, b) => a.sentAt - b.sentAt);
    
    if (shouldAppend) {
      setMessages(prevMessages => {
        // Filter out any duplicate messages that might exist in both arrays
        const existingIds = new Set(prevMessages.map(msg => msg.id));
        const uniqueNewMessages = sortedMessages.filter(msg => !existingIds.has(msg.id));
        
        // Combine the arrays and sort by sentAt
        const combinedMessages = [...uniqueNewMessages, ...prevMessages];
        return combinedMessages.sort((a, b) => a.sentAt - b.sentAt);
      });
    } else {
      setMessages(sortedMessages);
    }

    if (convertedMessages.length > 0 && fetchedMessages && Array.isArray(fetchedMessages) && fetchedMessages.length > 0) {
      const lastMessage = fetchedMessages[fetchedMessages.length - 1];
      if (lastMessage && typeof lastMessage === 'object' && typeof CometChat.markAsDelivered === 'function') {
        try {
          await CometChat.markAsDelivered(lastMessage);
        } catch (err) {
          console.error("Error marking message as delivered:", err);
        }
      }
    }
    
    // Return true if more messages were loaded
    return fetchedMessages.length > 0;
  } catch (error) {
    console.error("Error loading messages:", error);
    return false;
  }
}; 