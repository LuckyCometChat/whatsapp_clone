import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, Text } from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import { initiateUserCall, initCallListeners, removeCallListeners, acceptCall, rejectCall, cancelCall } from '../services/callService';
import CallScreen from './CallScreen';

interface CallButtonsProps {
  receiverId: string;
}

const CallButtons: React.FC<CallButtonsProps> = ({ receiverId }) => {
  const [activeCallSession, setActiveCallSession] = useState<string | null>(null);
  const [isAudioCall, setIsAudioCall] = useState(false);
  const [showCallScreen, setShowCallScreen] = useState(false);

  const handleCallEnded = () => {
    setShowCallScreen(false);
    setActiveCallSession(null);
  };

  const handleAudioCall = async () => {
    try {
      const call = await initiateUserCall(receiverId, CometChat.CALL_TYPE.AUDIO);
      console.log('Audio call initiated:', call);
      
      const callObj = call as any;
      let sessionId = '';
      
      try {
        if (callObj && typeof callObj.getSessionId === 'function') {
          sessionId = callObj.getSessionId();
        } else if (callObj && callObj.sessionId) {
          sessionId = callObj.sessionId;
        } else if (callObj && callObj.getSession) {
          sessionId = callObj.getSession();
        } else if (callObj && callObj.getId) {
          sessionId = callObj.getId().toString();
        }
        
        console.log('Using audio call session ID:', sessionId);
      } catch (error) {
        console.error('Error getting session ID:', error);
      }
      
      Alert.alert(
        'Calling',
        `Audio call to ${receiverId} initiated`,
        [
          {
            text: 'Cancel',
            onPress: () => {
              if (sessionId) {
                cancelCall(sessionId);
              }
            },
            style: 'cancel',
          },
          {
            text: '❌',
            onPress: () => {
              // This just closes the alert without cancelling the call
              console.log('Alert closed without cancelling call');
            },
          }
        ]
      );
    } catch (error) {
      console.error('Error starting audio call:', error);
      Alert.alert('Call Failed', 'Could not initiate audio call. CometChat calling module not found. Please add CometChat calling dependency and try again.');
    }
  };

  // Function to start a video call
  const handleVideoCall = async () => {
    try {
      const call = await initiateUserCall(receiverId, CometChat.CALL_TYPE.VIDEO);
      console.log('Video call initiated:', call);
      
      // Get session ID safely - we need to cast to any to access properties
      const callObj = call as any;
      let sessionId = '';
      
      try {
        // Try different ways to get session ID
        if (callObj && typeof callObj.getSessionId === 'function') {
          sessionId = callObj.getSessionId();
        } else if (callObj && callObj.sessionId) {
          sessionId = callObj.sessionId;
        } else if (callObj && callObj.getSession) {
          sessionId = callObj.getSession();
        } else if (callObj && callObj.getId) {
          sessionId = callObj.getId().toString();
        }
        
        console.log('Using video call session ID:', sessionId);
      } catch (error) {
        console.error('Error getting session ID:', error);
      }
      
      Alert.alert(
        'Calling',
        `Video call to ${receiverId} initiated`,
        [
          {
            text: 'Cancel',
            onPress: () => {
              if (sessionId) {
                cancelCall(sessionId);
              }
            },
            style: 'cancel',
          },
          {
            text: '❌',
            onPress: () => {
              // This just closes the alert without cancelling the call
              console.log('Alert closed without cancelling call');
            },
          }
        ]
      );
    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Call Failed', 'Could not initiate video call. CometChat calling module not found. Please add CometChat calling dependency and try again.');
    }
  };


  React.useEffect(() => {
    // Handle incoming call
    const handleIncomingCall = (call: any) => {
      // Get session ID safely
      let sessionId = '';
      
      try {
        // Try different ways to get session ID
        if (call && typeof call.getSessionId === 'function') {
          sessionId = call.getSessionId();
        } else if (call && call.sessionId) {
          sessionId = call.sessionId;
        } else if (call && call.getSession) {
          sessionId = call.getSession();
        } else if (call && call.getId) {
          sessionId = call.getId().toString();
        }
        
        console.log('Incoming call session ID:', sessionId);
      } catch (error) {
        console.error('Error getting session ID for incoming call:', error);
      }
      
      Alert.alert(
        'Incoming Call',
        `${call?.sender?.name } is calling you`,
        [
          {
            text: 'Decline',
            onPress: () => {
              if (sessionId) {
                rejectCall(sessionId);
              }
            },
            style: 'cancel',
          },
          {
            text: 'Accept',
            onPress: async () => {
              if (sessionId) {
                try {
                  await acceptCall(sessionId);
                  console.log('Call accepted, starting call screen with session ID:', sessionId);
                  
                  // Check if it's an audio or video call
                  const isAudio = call?.type === CometChat.CALL_TYPE.AUDIO;
                  setIsAudioCall(isAudio);
                  setActiveCallSession(sessionId);
                  setShowCallScreen(true);
                } catch (error) {
                  console.error('Error accepting call:', error);
                  Alert.alert('Call Error', 'Could not accept call');
                }
              }
            },
          },
          {
           
            onPress: () => {
              // This just closes the alert without accepting or rejecting the call
              console.log('Alert closed without action');
            },
          },
        ]
      );
    };

    // Handle outgoing call accepted
    const handleOutgoingCallAccepted = async (call: any) => {
      // Get session ID safely
      let sessionId = '';
      
      try {
        // Try different ways to get session ID
        if (call && typeof call.getSessionId === 'function') {
          sessionId = call.getSessionId();
        } else if (call && call.sessionId) {
          sessionId = call.sessionId;
        } else if (call && call.getSession) {
          sessionId = call.getSession();
        } else if (call && call.getId) {
          sessionId = call.getId().toString();
        }
        
        console.log('Outgoing call accepted with session ID:', sessionId);
      } catch (error) {
        console.error('Error getting session ID for accepted call:', error);
      }
      
      if (sessionId) {
        try {
          // Check if it's an audio or video call
          const isAudio = call?.type === CometChat.CALL_TYPE.AUDIO;
          setIsAudioCall(isAudio);
          setActiveCallSession(sessionId);
          setShowCallScreen(true);
        } catch (error) {
          console.error('Error starting call session:', error);
          Alert.alert('Call Error', 'Could not start call session');
        }
      }
    };

    // Handle outgoing call rejected
    const handleOutgoingCallRejected = (call: any) => {
      Alert.alert('Call Rejected', 'The recipient rejected your call');
    };

    // Handle incoming call cancelled
    const handleIncomingCallCancelled = (call: any) => {
      Alert.alert('Call Cancelled', 'The caller cancelled the call');
    };

    // Handle call ended
    const handleCallEnded = (call: any) => {
      setShowCallScreen(false);
      setActiveCallSession(null);
      Alert.alert('Call Ended', 'The call has ended');
    };

    // Initialize listeners
    initCallListeners(
      handleIncomingCall,
      handleOutgoingCallAccepted,
      handleOutgoingCallRejected,
      handleIncomingCallCancelled,
      handleCallEnded
    );

    // Clean up listeners when component unmounts
    return () => {
      removeCallListeners();
    };
  }, [receiverId]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleAudioCall}>
        <Text style={styles.call}>📞</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleVideoCall}>
        <Text style={styles.video}>🎥</Text>
      </TouchableOpacity>

      {/* Call Screen Modal */}
      {activeCallSession && (
        <CallScreen
          sessionId={activeCallSession}
          isVisible={showCallScreen}
          onCallEnded={handleCallEnded}
          audioOnly={isAudioCall}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    padding: 8,
    marginHorizontal: 5,
  },
  call: {
    fontSize: 24,
  },
  video: {
    fontSize: 24,
  },
});

export default CallButtons; 