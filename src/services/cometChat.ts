import { CometChat } from '@cometchat/chat-sdk-react-native';
import { User, Message } from '../types';

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

export const sendMessage = async (receiverUid: string, message: string) => {
  try {
    const textMessage = new CometChat.TextMessage(
      receiverUid,
      message,
      CometChat.RECEIVER_TYPE.USER
    );
    return await CometChat.sendMessage(textMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}; 