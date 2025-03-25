import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';

interface User {
  uid: string;
  name: string;
  avatar?: string;
}

interface Message {
  id: string;
  text: string;
  sender: User;
  timestamp: number;
}

const App = () => {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const initCometChat = async () => {
      try {
        const appID: string = "272268d25643b5db";
        const region: string = "IN";
        const appSetting: CometChat.AppSettings = new CometChat.AppSettingsBuilder()
          .subscribePresenceForAllUsers()
          .setRegion(region)
          .autoEstablishSocketConnection(true)
          .build();
        
        await CometChat.init(appID, appSetting);
        console.log("CometChat initialization successful");
      } catch (error) {
        console.error("CometChat initialization error:", error);
        Alert.alert("Initialization Error", JSON.stringify(error));
      }
    };
    initCometChat();
  }, []);

  const loginCometChat = async () => {
    if (!uid.trim() || !password.trim()) {
      Alert.alert("Login Error", "Please enter both UID and password");
      return;
    }

    try {
      const authKey: string = "3a1b1fef651a2279ff270d847dd67991ded9808b";
      const user = await CometChat.login(uid, authKey);
      
      setCurrentUser(user);
      setIsLoggedIn(true);
      
      await fetchUsers();
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Login Error", "Invalid credentials or login failed");
    }
  };

  const logoutCometChat = async () => {
    try {
      await CometChat.logout();
      setIsLoggedIn(false);
      setCurrentUser(null);
      setUsers([]);
      setSelectedUser(null);
      setMessages([]);
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Logout Error", JSON.stringify(error));
    }
  };

  const fetchUsers = async () => {
    try {
      const usersRequest = new CometChat.UsersRequestBuilder()
        .setLimit(30)
        .build();
      
      const fetchedUsers = await usersRequest.fetchNext();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const selectUserForChat = (user: User) => {
    setSelectedUser(user);
    fetchMessages(user.uid);
  };

  const fetchMessages = async (receiverUid: string) => {
    try {
      const messagesRequest = new CometChat.MessagesRequestBuilder()
        .setUID(receiverUid)
        .setLimit(50)
        .build();
      
      const messages = await messagesRequest.fetchPrevious();
      setMessages(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const sendMessage = async () => {
    if (!selectedUser || !newMessage.trim()) return;

    try {
      const textMessage = new CometChat.TextMessage(
        selectedUser.uid,
        newMessage,
        CometChat.RECEIVER_TYPE.USER
      );

      const sentMessage = await CometChat.sendMessage(textMessage);
      setMessages(prevMessages => [...prevMessages, sentMessage]);
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const renderLoginScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={styles.header.backgroundColor} barStyle="light-content" />
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>WhatsApp Clone</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter UID"
          placeholderTextColor="#888"
          value={uid}
          onChangeText={setUid}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Enter Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={loginCometChat}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const renderUserListScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={styles.header.backgroundColor} barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WhatsApp</Text>
        <TouchableOpacity onPress={logoutCometChat} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.userItem}
            onPress={() => selectUserForChat(item)}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {item.name ? item.name.charAt(0).toUpperCase() : item.uid.charAt(0)}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userItemText}>{item.name || item.uid}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );

  const renderChatScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={styles.header.backgroundColor} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderContent}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {selectedUser?.name ? selectedUser.name.charAt(0).toUpperCase() : selectedUser?.uid.charAt(0)}
            </Text>
          </View>
          <Text style={styles.chatTitle}>
            {selectedUser?.name || selectedUser?.uid}
          </Text>
        </View>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.sender.uid === currentUser?.uid 
              ? styles.sentMessage 
              : styles.receivedMessage
          ]}>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        inverted
        contentContainerStyle={styles.messagesContainer}
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.chatInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message"
            placeholderTextColor="#888"
          />
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={sendMessage}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <View style={styles.container}>
      {!isLoggedIn 
        ? renderLoginScreen() 
        : !selectedUser 
          ? renderUserListScreen() 
          : renderChatScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#075E54',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#075E54',
    marginBottom: 30,
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  loginButton: {
    backgroundColor: '#25D366',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: '#25D366',
    borderRadius: 5,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userItemText: {
    fontSize: 16,
  },
  backButton: {
    marginRight: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  messagesContainer: {
    paddingVertical: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#eee',
  },
  messageText: {
    color: 'black',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  chatInput: {
    flex: 1,
    height: 50,
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sendButton: {
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default App;