import { CometChatCalls } from "@cometchat/calls-sdk-react-native";
import { CometChat } from '@cometchat/chat-sdk-react-native';

const APP_ID = "272268d25643b5db";
const REGION = "IN";
const AUTH_KEY = "3a1b1fef651a2279ff270d847dd67991ded9808b";

export const initCometChat = async () => {
    try {
      const appSetting = new CometChatCalls.CallAppSettingsBuilder()
        .setAppId(APP_ID)
        .setRegion(REGION)
        .build();
      
      await CometChatCalls.init(appSetting);
      console.log("CometChatCalls initialization successful");
    } catch (error) {
      console.error("CometChatCalls initialization error:", error);
      throw error;
    }
};

// Generate a call token for a session
export const generateToken = async (sessionId: string): Promise<string> => {
  try {
    const loggedInUser = await CometChat.getLoggedinUser();
    if (!loggedInUser) {
      throw new Error("No logged in user found");
    }
    
    const authToken = loggedInUser.getAuthToken();
    
    const response = await CometChatCalls.generateToken(sessionId, authToken);
    console.log("Call token generated:", response.token);
    return response.token;
  } catch (error) {
    console.error("Error generating call token:", error);
    throw error;
  }
};

// Create call settings for direct call
export const createCallSettings = ({
  audioOnly = false, 
  defaultLayout = true,
  showEndCallButton = true,
  showPauseVideoButton = true,
  showMuteAudioButton = true,
  showSwitchCameraButton = true,
  showAudioModeButton = true,
  showSwitchToVideoCallButton = true,
  startWithAudioMuted = false,
  startWithVideoMuted = false,
  callMode = CometChatCalls.CALL_MODE.DEFAULT,
  avatarMode = "circle" as "circle" | "square" | "fullscreen",
  enableVideoTileClick = true,
  enableVideoTileDrag = true,
} = {}) => {
  // Create a call listener with typesafe handlers
  const callListener = new CometChatCalls.OngoingCallListener({
    onUserJoined: user => {
      console.log("User joined:", user);
    },
    onUserLeft: user => {
      console.log("User left:", user);
    },
    onUserListUpdated: userList => {
      console.log("User list updated:", userList);
    },
    onCallEnded: () => {
      console.log("Call ended");
    },
    onCallEndButtonPressed: () => {
      console.log("End call button pressed");
    },
    onError: error => {
      console.log('Call error:', error);
    },
    onAudioModesUpdated: (audioModes) => {
      console.log("Audio modes updated:", audioModes);
    },
    onCallSwitchedToVideo: (event) => {
      console.log("Call switched to video:", event);
    },
    onUserMuted: (event) => {
      console.log("User muted:", event);
    },
    // Additional handlers from the documentation
    onMediaDeviceListUpdated: (deviceList) => {
      console.log("Media device list updated:", deviceList);
    }
  });

  // Build call settings with all available options
  const callSettings = new CometChatCalls.CallSettingsBuilder()
    .enableDefaultLayout(defaultLayout)
    .setIsAudioOnlyCall(audioOnly)
    .showEndCallButton(showEndCallButton)
    .showPauseVideoButton(showPauseVideoButton)
    .showMuteAudioButton(showMuteAudioButton)
    .showSwitchCameraButton(showSwitchCameraButton)
    .showAudioModeButton(showAudioModeButton)
    .showSwitchToVideoCallButton(showSwitchToVideoCallButton)
    .startWithAudioMuted(startWithAudioMuted)
    .startWithVideoMuted(startWithVideoMuted)
    .setMode(callMode)
    .setAvatarMode(avatarMode)
    .enableVideoTileClick(enableVideoTileClick)
    .enableVideoTileDrag(enableVideoTileDrag)
    .setCallEventListener(callListener)
    .build();

  return callSettings;
};

// Legacy function for backward compatibility
// Should be deprecated as it doesn't work directly with the new SDK
export const startSession = (sessionId: string) => {
  console.log("WARNING: startSession is deprecated. Use startCallWithSettings with a generated token instead.");
  console.log("Starting call session with ID:", sessionId);
  
  // Generate a token and then initiate the call with proper settings
  return generateToken(sessionId)
    .then(token => {
      const callSettings = createCallSettings();
      return { token, callSettings, sessionId };
    })
    .catch(error => {
      console.error("Failed to start session:", error);
      throw error;
    });
};

// Prepare for starting a call with token and settings
export const startCallWithSettings = async (sessionId: string, customSettings = {}) => {
  try {
    console.log("Preparing call with session ID:", sessionId);
    // Generate token for the session
    const callToken = await generateToken(sessionId);
    // Create call settings with custom options
    const callSettings = createCallSettings({ ...customSettings });
    
    return { 
      callToken, 
      callSettings, 
      sessionId,
      // Component instructions
      componentUsage: `
        Use this in your React Native component:
        <View style={{ height: '100%', width: '100%', position: 'relative' }}>
          <CometChatCalls.Component callSettings={callSettings} callToken={callToken} />
        </View>
      `
    };
  } catch (error) {
    console.error("Error preparing call:", error);
    throw error;
  }
};

// End a call session
export const endSession = () => {
  return CometChatCalls.endSession();
};

// Utility functions for call controls
export const switchCamera = () => {
  return CometChatCalls.switchCamera();
};

export const muteAudio = (mute: boolean) => {
  return CometChatCalls.muteAudio(mute);
};

export const pauseVideo = (pause: boolean) => {
  return CometChatCalls.pauseVideo(pause);
};

export const setAudioMode = (mode: string) => {
  return CometChatCalls.setAudioMode(mode);
};

export const switchToVideoCall = () => {
  return CometChatCalls.switchToVideoCall();
};

export const getAudioOutputModes = () => {
  return CometChatCalls.getAudioOutputModes();
};

// Add or remove call event listeners globally
export const addCallEventListener = (listenerID: string, callbacks: any) => {
  const listener = new CometChatCalls.OngoingCallListener(callbacks);
  return CometChatCalls.addCallEventListener(listenerID, listener);
};

export const removeCallEventListener = (listenerID: string) => {
  return CometChatCalls.removeCallEventListener(listenerID);
};

// Clear active call session for all scenarios
export const clearCallSession = async () => {
  try {
    // First try to end the current session
    await CometChatCalls.endSession();
    
    // For default call flow, also clear the active call in CometChat
    const activeCall = await CometChat.getActiveCall();
    if (activeCall) {
      await CometChat.clearActiveCall();
    }
    
    console.log("Call session cleared successfully");
    return true;
  } catch (error) {
    console.error("Error clearing call session:", error);
    // Even if there's an error, we want to ensure clean state
    try {
      await CometChat.clearActiveCall();
    } catch (innerError) {
      console.error("Failed to clear active call as fallback:", innerError);
    }
    return false;
  }
};

// Handle call ending for the user who initiated the end
export const endCall = async () => {
  try {
    // Get the active call first
    const activeCall = await CometChat.getActiveCall();
    if (activeCall) {
      // End the call via CometChat with the active call ID
      await CometChat.endCall(activeCall.getSessionId());
    }
    // Also end the session
    await CometChatCalls.endSession();
    console.log("Call ended successfully");
    return true;
  } catch (error) {
    console.error("Error ending call:", error);
    // Try to clear session anyway
    await clearCallSession();
    return false;
  }
};

// Handle call rejection
export const rejectCall = async (callId: string, rejectStatus = CometChat.CALL_STATUS.REJECTED) => {
  try {
    await CometChat.rejectCall(callId, rejectStatus);
    // Also clear any active session
    await clearCallSession();
    console.log("Call rejected successfully");
    return true;
  } catch (error) {
    console.error("Error rejecting call:", error);
    // Try to clear session anyway
    await clearCallSession();
    return false;
  }
};

// Handle call cancellation
export const cancelCall = async (callId: string) => {
  try {
    // Use rejectCall with cancellation status instead of non-existent cancelCall
    await CometChat.rejectCall(callId, CometChat.CALL_STATUS.CANCELLED);
    // Also clear any active session
    await clearCallSession();
    console.log("Call cancelled successfully");
    return true;
  } catch (error) {
    console.error("Error cancelling call:", error);
    // Try to clear session anyway
    await clearCallSession();
    return false;
  }
};

// Enhanced startCallWithSettings to ensure clean session before starting
export const enhancedStartCallWithSettings = async (sessionId: string, customSettings = {}) => {
  try {
    // First clear any existing session to prevent issues
    await clearCallSession();
    
    // Then start a new call with fresh settings
    console.log("Starting new call with clean session, ID:", sessionId);
    return await startCallWithSettings(sessionId, customSettings);
  } catch (error) {
    console.error("Error starting enhanced call:", error);
    throw error;
  }
};