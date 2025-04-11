import { CometChat } from '@cometchat/chat-sdk-react-native';
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";


const CALL_LISTENER_ID = "CALL_LISTENER_ID";

// Define interface for CometChat Call object
interface CometChatCall {
  sessionId: string;
  receiverId: string;
  receiverType: string;
  callType: string;
  status: string;
  [key: string]: any;
}

// Initialize call listeners 
export const initCallListeners = (
  onIncomingCall: (call: CometChatCall) => void,
  onOutgoingCallAccepted: (call: CometChatCall) => void,
  onOutgoingCallRejected: (call: CometChatCall) => void,
  onIncomingCallCancelled: (call: CometChatCall) => void,
  onCallEnded: (call: CometChatCall) => void
) => {
  CometChat.addCallListener(
    CALL_LISTENER_ID,
    new CometChat.CallListener({
      onIncomingCallReceived: (call: CometChatCall) => {
        console.log("Incoming call:", call);
        onIncomingCall(call);
      },
      onOutgoingCallAccepted: (call: CometChatCall) => {
        console.log("Outgoing call accepted:", call);
        onOutgoingCallAccepted(call);
      },
      onOutgoingCallRejected: (call: CometChatCall) => {
        console.log("Outgoing call rejected:", call);
        onOutgoingCallRejected(call);
      },
      onIncomingCallCancelled: (call: CometChatCall) => {
        console.log("Incoming call cancelled:", call);
        onIncomingCallCancelled(call);
      },
      onCallEndedMessageReceived: (call: CometChatCall) => {
        console.log("Call ended:", call);
        onCallEnded(call);
      },
    })
  );
};


export const removeCallListeners = () => {
  CometChat.removeCallListener(CALL_LISTENER_ID);
};

export const initiateUserCall = (receiverId: string, callType: string) => {
  const receiverType = CometChat.RECEIVER_TYPE.USER;
  const call = new CometChat.Call(receiverId, callType, receiverType);

  return CometChat.initiateCall(call);
};

// Initiate a call to a group
export const initiateGroupCall = (groupId: string, callType: string) => {
  const receiverType = CometChat.RECEIVER_TYPE.GROUP;
  const call = new CometChat.Call(groupId, callType, receiverType);

  return CometChat.initiateCall(call);
};

// Accept an incoming call
export const acceptCall = (sessionId: string) => {
  return CometChat.acceptCall(sessionId);
};

// Reject an incoming call
export const rejectCall = (sessionId: string, p0: string) => {
  const status = CometChat.CALL_STATUS.REJECTED;
  return CometChat.rejectCall(sessionId, status);
};

// Cancel an outgoing call
export const cancelCall = (sessionId: string) => {
  const status = CometChat.CALL_STATUS.CANCELLED;
  return CometChat.rejectCall(sessionId, status);
};

// End an ongoing call
export const endCall = (sessionId: string) => {
  return CometChat.endCall(sessionId);
};


export const startCallSession = (sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Starting call session with ID: ${sessionId}`);
      console.log('DEPRECATED: Please use the CallScreen component directly instead of startCallSession');
      console.log(`
      Example usage:
      <CallScreen 
        sessionId="${sessionId}"
        isVisible={true}
        onCallEnded={() => {}}
        audioOnly={false}
      />
      `);
      
    
      import('./cometCall').then(cometCallService => {
        cometCallService.startCallWithSettings(sessionId)
          .then(callData => {
            console.log("Call session prepared successfully:", callData);
            console.log("To show the call UI, you must use the CallScreen component in your React Native component.");
            resolve();
          })
          .catch((error: any) => {
            console.error("Error preparing call session:", error);
            reject(new Error("CometChat calling module error: " + (error.message || JSON.stringify(error))));
          });
      }).catch(error => {
        console.error("Error importing cometCall service:", error);
        reject(error);
      });
    } catch (error: any) {
      console.error("Error starting call session:", error);
      reject(error);
    }
  });
}; 

