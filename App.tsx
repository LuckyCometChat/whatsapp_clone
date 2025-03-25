import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { initCometChat } from './src/services/cometChat';
import { User } from './src/types';
import Login from './src/components/Login';
import UserList from './src/components/UserList';
import Chat from './src/components/Chat';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initCometChat();
        console.log("CometChat initialization successful");
      } catch (error) {
        console.error("CometChat initialization error:", error);
        Alert.alert("Initialization Error", JSON.stringify(error));
      }
    };
    initializeApp();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedUser(null);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
  };

  const handleBack = () => {
    setSelectedUser(null);
  };

  return (
    <View style={styles.container}>
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : !selectedUser ? (
        <UserList onUserSelect={handleUserSelect} onLogout={handleLogout} />
      ) : (
        <Chat
          currentUser={currentUser!}
          selectedUser={selectedUser}
          onBack={handleBack}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;