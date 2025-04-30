import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, NativeEventEmitter } from 'react-native';
import { initCometChat as initCometChatCalls } from './src/services/cometCall';
import { AppInitializer } from './src/services';
import { User, Group } from './src/types';
import Login from './src/components/Login';
import UserList from './src/components/UserList';
import Chat from './src/components/Chat';
import GroupList from './src/components/GroupList';
import GroupChat from './src/components/GroupChat';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import { CometChatCalls } from '@cometchat/calls-sdk-react-native';
import RNCallKeep from 'react-native-callkeep';
import CallKeepHelper from './src/services/CallKeepHelper';
import CallScreen from './src/components/CallScreen';
import { initCallKeep, initPushNotifications } from './src/services/pushNotifications';

// Utility function to clean up any active calls
const cleanupActiveCalls = async () => {
  try {
    // Try to end any active call sessions first
    if (CometChatCalls && CometChatCalls.endSession) {
      await CometChatCalls.endSession();
    }
    
    // Check if there's an active call in CometChat and clear it
    const activeCall = await CometChat.getActiveCall();
    if (activeCall) {
      await CometChat.clearActiveCall();
      console.log('Cleaned up active call during app initialization');
    }
    
    return true;
  } catch (error) {
    console.error('Error cleaning up active calls:', error);
    // Try the direct clearActiveCall as a fallback
    try {
      await CometChat.clearActiveCall();
      return true;
    } catch (innerError) {
      console.error('Failed to clear active call even with fallback:', innerError);
      return false;
    }
  }
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStatuses, setUserStatuses] = useState<{ [key: string]: 'online' | 'offline' }>({});
  const userStatusListenerRef = useRef<string | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const callKeepHelperRef = useRef<CallKeepHelper | null>(null);
  const eventEmitter = useRef<NativeEventEmitter | null>(null);
  const [activeCall, setActiveCall] = useState<{
    sessionId: string;
    isVisible: boolean;
    isIncoming: boolean;
    audioOnly: boolean;
  } | null>(null);
  const callRecoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Navigation function that can be passed to CallKeepHelper
  const navigate = useCallback((params: { 
    index: number; 
    routes: Array<{ name: string; params: any }> 
  }) => {
    const route = params.routes[0];
    if (route.name === 'CallScreen' && route.params) {
      setActiveCall({
        sessionId: route.params.sessionId,
        isVisible: route.params.isVisible,
        isIncoming: route.params.isIncoming,
        audioOnly: route.params.audioOnly,
      });
    }
  }, []);

  // Function to handle call session recovery
  const recoverCallSession = useCallback(async (sessionId: string, isAudioOnly: boolean = false) => {
    try {
      // Clear any existing timeout
      if (callRecoveryTimeoutRef.current) {
        clearTimeout(callRecoveryTimeoutRef.current);
        callRecoveryTimeoutRef.current = null;
      }
      
      // Clean up any active calls first
      await cleanupActiveCalls();
      
      try {
        // Try to accept the call with CometChat
        await CometChat.acceptCall(sessionId);
        console.log('Call recovered and accepted successfully');
      } catch (error: any) {
        // If error is "user already joined", we can continue - the call is already accepted
        if (error && error.code === 'ERR_CALL_USER_ALREADY_JOINED') {
          console.log('User already joined call - continuing with call handling');
        } else {
          // Rethrow other errors
          throw error;
        }
      }
      
      // Update the UI - do this regardless of whether we succeeded in acceptCall
      // since the error might just be that we're already in the call
      setActiveCall({
        sessionId,
        isVisible: true,
        isIncoming: true,
        audioOnly: isAudioOnly,
      });
      
      return true;
    } catch (error) {
      console.error('Error recovering call session:', error);
      
      // If we still have "call already in progress" error, schedule another retry
      if (error && (error as any).message && (error as any).message.includes('already in progress')) {
        console.log('Still detecting call in progress error, scheduling another retry...');
        callRecoveryTimeoutRef.current = setTimeout(() => {
          recoverCallSession(sessionId, isAudioOnly);
        }, 2000);
      }
      
      return false;
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Clean up any active calls first to start with a clean state
        await cleanupActiveCalls();
        
        // Initialize CometChat Calls
        await initCometChatCalls();
        console.log("CometChat Calls initialization successful");

        // Initialize push notifications
        await initPushNotifications();

        // Initialize CallKeep and pass the navigation function
        const helper = await initCallKeep();
        if (helper) {
          callKeepHelperRef.current = helper;
          // Set the navigation function
          if (callKeepHelperRef.current) {
            callKeepHelperRef.current.navigate = navigate;
            CallKeepHelper.navigateFunction = navigate;
          }
        }
        
        // Always ensure the navigation function is available statically
        // This prevents "navigation function not available" errors
        CallKeepHelper.navigateFunction = navigate;

        // Set up event listeners for call events
        eventEmitter.current = new NativeEventEmitter();
        eventEmitter.current.addListener('CallAccepted', (event) => {
          console.log('Call accepted event received:', event);
          setActiveCall({
            sessionId: event.sessionId,
            isVisible: true,
            isIncoming: true,
            audioOnly: event.callType === 'audio',
          });
        });

        eventEmitter.current.addListener('CallAcceptedRequiresNavigation', (event) => {
          console.log('Call navigation required event received:', event);
          
          // Try to recover the call session
          recoverCallSession(event.sessionId, event.audioOnly);
        });
      } catch (error) {
        console.error("App initialization error:", error);
        Alert.alert("Initialization Error", JSON.stringify(error));
      }
    };
    
    initializeApp();

    // Clean up when component unmounts
    return () => {
      // Clean up any listeners
      if (callKeepHelperRef.current) {
        callKeepHelperRef.current.removeEventListeners();
      }
      
      if (eventEmitter.current) {
        eventEmitter.current.removeAllListeners('CallAccepted');
        eventEmitter.current.removeAllListeners('CallAcceptedRequiresNavigation');
      }
      
      // Clear any recovery timeout
      if (callRecoveryTimeoutRef.current) {
        clearTimeout(callRecoveryTimeoutRef.current);
      }
      
      // Try to clean up any active calls
      cleanupActiveCalls().catch(console.error);
    };
  }, [navigate, recoverCallSession]);

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      userStatusListenerRef.current = 'user_status_listener';
      
      const fetchUsersStatus = async () => {
        try {
          const limit = 30;
          const usersRequest = new CometChat.UsersRequestBuilder()
            .setLimit(limit)
            .build();
          
          const users = await usersRequest.fetchNext();
          const statusUpdates: { [key: string]: 'online' | 'offline' } = {};
          users.forEach((user: CometChat.User) => {
            statusUpdates[user.getUid()] = user.getStatus() === CometChat.USER_STATUS.ONLINE ? 'online' : 'offline';
          });
          setUserStatuses(prev => ({
            ...prev,
            ...statusUpdates
          }));
        } catch (error) {
          console.error("Error fetching users status:", error);
        }
      };
      
      fetchUsersStatus();

      // listen for status changes
      CometChat.addUserListener(
        userStatusListenerRef.current,
        new CometChat.UserListener({
          onUserOnline: (onlineUser: CometChat.User) => {
            console.log("User online:", onlineUser.getUid());
            setUserStatuses(prev => ({
              ...prev,
              [onlineUser.getUid()]: 'online'
            }));
          },
          onUserOffline: (offlineUser: CometChat.User) => {
            console.log("User offline:", offlineUser.getUid());
            setUserStatuses(prev => ({
              ...prev,
              [offlineUser.getUid()]: 'offline'
            }));
          }
        })
      );

      return () => {
        if (userStatusListenerRef.current) {
          CometChat.removeUserListener(userStatusListenerRef.current);
        }
      };
    }
  }, [isLoggedIn, currentUser]);

  const handleLogin = (user: User, status: 'online' | 'offline') => {
    setCurrentUser(user);
    setUserStatuses(prev => ({
      ...prev,
      [user.uid]: 'online' 
    }));
    setIsLoggedIn(true);
  };
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedUser(null);
    setSelectedGroup(null);
    setShowGroups(false);
    setUserStatuses({});
    
    // Clean up any active calls on logout
    cleanupActiveCalls().catch(console.error);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSelectedGroup(null);
  };

  const handleGroupSelect = (group: Group) => {
    setSelectedGroup(group);
    setSelectedUser(null);
  };

  const handleBack = () => {
    if (selectedUser) {
      setSelectedUser(null);
    } else if (selectedGroup) {
      setSelectedGroup(null);
    } else if (showGroups) {
      setShowGroups(false);
    }
  };

  const toggleView = () => {
    setShowGroups(!showGroups);
    setSelectedUser(null);
    setSelectedGroup(null);
  };

  const handleCallEnded = () => {
    setActiveCall(null);
    
    // Clean up any active calls when a call ends
    cleanupActiveCalls().catch(console.error);
  };

  const renderContent = () => {
    if (!isLoggedIn) {
      return <Login onLogin={handleLogin} />;
    }

    if (selectedUser) {
      return (
        <Chat
          currentUser={currentUser!}
          selectedUser={selectedUser}
          onBack={handleBack}
          userStatuses={userStatuses}
          onUserStatusChange={(uid, status) => {
            setUserStatuses(prev => ({
              ...prev,
              [uid]: status
            }));
          }}
        />
      );
    }

    if (selectedGroup) {
      return (
        <GroupChat
          currentUser={currentUser!}
          selectedGroup={selectedGroup}
          onBack={handleBack}
        />
      );
    }

    if (showGroups) {
      return (
        <GroupList
          onGroupSelect={handleGroupSelect}
          onBack={toggleView}
          currentUser={currentUser!}
        />
      );
    }

    return (
      <UserList 
        onUserSelect={handleUserSelect}
        onLogout={handleLogout}
        userStatuses={userStatuses}
        onGroupsPress={toggleView}
      />
    );
  };

  return (
    <AppInitializer>
      <View style={styles.container}>
        {renderContent()}
        
        {/* Render call screen when there's an active call */}
        {activeCall && (
          <CallScreen
            sessionId={activeCall.sessionId}
            isVisible={activeCall.isVisible}
            onCallEnded={handleCallEnded}
            audioOnly={activeCall.audioOnly}
            isIncoming={activeCall.isIncoming}
          />
        )}
      </View>
    </AppInitializer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;