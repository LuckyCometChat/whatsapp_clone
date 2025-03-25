import { View, Text, Alert, TextInput, Button, StyleSheet } from 'react-native'
import React, { useEffect, useState } from 'react'
import { CometChat } from '@cometchat/chat-sdk-react-native';

const App = () => {
  const [uid, setUid] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

        const initialized = await CometChat.init(appID, appSetting);
        
        if (initialized) {
          console.log("CometChat initialization successful");
        } else {
          Alert.alert("CometChat Init", "Initialization failed");
        }
      } catch (error) {
        console.error("CometChat initialization error:", error);
        Alert.alert("CometChat Init Error", JSON.stringify(error));
      }
    };

    initCometChat();
  }, []);

  const loginCometChat = async () => {
    try {
      const authKey: string = "3a1b1fef651a2279ff270d847dd67991ded9808b";
      const user = await CometChat.login(uid, authKey);
      console.log("Login successful:", user);
      Alert.alert("Login Successful", `Welcome ${user.getUid()}`);
      setIsLoggedIn(true);
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Login Error", JSON.stringify(error));
    }
  };

  const logoutCometChat = async () => {
    try {
      await CometChat.logout();
      console.log("Logout successful");
      Alert.alert("Logout Successful");
      setIsLoggedIn(false);
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Logout Error", JSON.stringify(error));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CometChat</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter UID"
        value={uid}
        onChangeText={setUid}
      />
      <Button title="Login" onPress={loginCometChat} disabled={isLoggedIn} />
      <Button title="Logout" onPress={logoutCometChat} disabled={!isLoggedIn} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
});

export default App;