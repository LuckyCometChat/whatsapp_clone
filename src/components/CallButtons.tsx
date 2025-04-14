import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, Text } from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import { sendMessage, sendGroupMessage } from '../services/cometChat';
import { initiateUserCall, initiateGroupCall, initCallListeners, removeCallListeners, acceptCall, rejectCall, cancelCall, CometChatCall } from '../services/callService';
import CallScreen from './CallScreen';

interface CallButtonsProps {
  receiverId: string;
  receiverType: string;
}

const CallButtons: React.FC<CallButtonsProps> = ({ receiverId, receiverType }) => {
  const [showCallScreen, setShowCallScreen] = useState(false);
  const [activeCallSession, setActiveCallSession] = useState<string | null>(null);
  const [activeCallType, setActiveCallType] = useState<string | null>(null);

  const handleCallEnded = (call: CometChatCall) => {
    console.log("Call ended:", call);
    setShowCallScreen(false);
    setActiveCallSession(null);
    
    // Only send a call ended message if we were part of the call
    if (call && call.getSessionId && call.getSessionId() === activeCallSession) {
      // Send a single call ended message
      const message = {
        type: 'call',
        status: 'ended',
        sessionId: call.getSessionId(),
        timestamp: new Date().getTime()
      };
      
      // Use the appropriate method to send the message based on receiver type
      if (receiverType === CometChat.RECEIVER_TYPE.GROUP) {
        sendGroupMessage(receiverId, JSON.stringify(message));
      } else {
        sendMessage(receiverId, JSON.stringify(message));
      }
    }
  };

  const handleIncomingCall = (call: CometChatCall) => {
    console.log("Incoming call:", call);
    setActiveCallSession(call.getSessionId());
    setActiveCallType(call.getType());
    setShowCallScreen(true);
  };

  const handleOutgoingCallAccepted = (call: CometChatCall) => {
    console.log("Outgoing call accepted:", call);
    setActiveCallSession(call.getSessionId());
    setActiveCallType(call.getType());
    setShowCallScreen(true);
  };

  const handleOutgoingCallRejected = (call: CometChatCall) => {
    console.log("Outgoing call rejected:", call);
    setShowCallScreen(false);
    setActiveCallSession(null);
  };

  const handleIncomingCallCancelled = (call: CometChatCall) => {
    console.log("Incoming call cancelled:", call);
    setShowCallScreen(false);
    setActiveCallSession(null);
  };

  // Initialize listeners
  useEffect(() => {
    initCallListeners(
      handleIncomingCall,
      handleOutgoingCallAccepted,
      handleOutgoingCallRejected,
      handleIncomingCallCancelled,
      handleCallEnded
    );

    return () => {
      removeCallListeners();
    };
  }, [receiverId]);

  const handleStartCall = async (callType: string) => {
    try {
      let call;
      if (receiverType === CometChat.RECEIVER_TYPE.GROUP) {
        call = await initiateGroupCall(receiverId, callType);
      } else {
        call = await initiateUserCall(receiverId, callType);
      }
      setActiveCallSession(call.getSessionId());
      setActiveCallType(call.getType());
      setShowCallScreen(true);
    } catch (error) {
      console.error("Error starting call:", error);
      Alert.alert("Error", "Failed to start call");
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={() => handleStartCall(CometChat.CALL_TYPE.VIDEO)}>
        <Text style={styles.video}>🎥</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleStartCall(CometChat.CALL_TYPE.AUDIO)}>
        <Text style={styles.call}>📞</Text>
      </TouchableOpacity>

      {/* Call Screen Modal */}
      {showCallScreen && activeCallSession && (
        <CallScreen
          sessionId={activeCallSession}
          isVisible={showCallScreen}
          onCallEnded={() => {
            setShowCallScreen(false);
            setActiveCallSession(null);
          }}
          audioOnly={activeCallType === CometChat.CALL_TYPE.AUDIO}
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