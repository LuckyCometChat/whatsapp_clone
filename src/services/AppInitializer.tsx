import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { initCometChat } from './cometChat';
import { initPushNotifications, requestNotificationPermissions } from './pushNotifications';

interface AppInitializerProps {
  children: React.ReactNode;
}

/**
 * Component that handles initializing CometChat and setting up push notifications
 * before rendering the main app content
 */
const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize CometChat
        await initCometChat();
        
        // Request notification permissions
        await requestNotificationPermissions();
        
        // Initialize push notifications
        await initPushNotifications();
        
        setIsInitializing(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize the app. Please try again.');
        setIsInitializing(false);
      }
    };

    initialize();
    
    // No cleanup function needed as initPushNotifications returns
    // the unsubscribe function, but we're not using it here since
    // we want notifications to work throughout the app's lifecycle
  }, []);

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#075E54" />
        <Text style={styles.text}>Initializing...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#075E54',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    padding: 20,
  },
});

export default AppInitializer; 