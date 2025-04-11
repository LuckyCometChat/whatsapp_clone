import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import { CometChatIncomingCall } from '@cometchat/chat-uikit-react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const CallUI = () => {
  const incomingCall = useRef<CometChat.Call | null>(null);
  const [callReceived, setCallReceived] = useState(false);

  useEffect(() => {
    const listenerID = 'UNIQUE_LISTENER_ID';

    CometChat.addCallListener(
      listenerID,
      new CometChat.CallListener({
        onIncomingCallReceived: (call: CometChat.Call) => {
          console.log('Incoming call:', call);
          incomingCall.current = call;
          setCallReceived(true);
        },
        onOutgoingCallAccepted: (call: CometChat.Call) => {
          console.log('Outgoing call accepted:', call);
        },
        onOutgoingCallRejected: (call: CometChat.Call) => {
          console.log('Outgoing call rejected:', call);
        },
        onIncomingCallCancelled: (call: CometChat.Call) => {
          console.log('Incoming call cancelled:', call);
          setCallReceived(false);
        },
        onCallEndedMessageReceived: (call: CometChat.Call) => {
          console.log('CallEnded Message:', call);
          setCallReceived(false);
        },
      })
    );

    return () => {
      CometChat.removeCallListener(listenerID);
    };
  }, []);

  const handleVideoCall = () => {
    Alert.alert('Video Call', 'Initiating video call...');
    // Implement video call logic
  };

  const handleAudioCall = () => {
    Alert.alert('Audio Call', 'Initiating audio call...');
    // Implement audio call logic
  };

  return (
    <View style={styles.container}>
      {callReceived && incomingCall.current && (
        <CometChatIncomingCall
          call={incomingCall.current}
          onDecline={(call) => {
            console.log('Call declined:', call);
            setCallReceived(false);
          }}
          incomingCallStyle={{
            backgroundColor: 'white',
            titleColor: 'black',
            subtitleColor: 'gray',
            titleFont: {
              fontSize: 20,
              fontWeight: 'bold',
            },
          }}
        />
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.callButton} onPress={handleAudioCall}>
          <Icon name="call-outline" size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.callButton} onPress={handleVideoCall}>
          <Icon name="videocam-outline" size={22} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButton: {
    padding: 8,
    marginLeft: 10,
  }
});

export default CallUI;
