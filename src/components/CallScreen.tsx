import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Text, ActivityIndicator } from 'react-native';
import { CometChatCalls } from '@cometchat/calls-sdk-react-native';
import { startCallWithSettings, endSession } from '../services/cometCall';

interface CallScreenProps {
  sessionId: string;
  isVisible: boolean;
  onCallEnded: () => void;
  audioOnly?: boolean;
}

const CallScreen: React.FC<CallScreenProps> = ({ 
  sessionId, 
  isVisible, 
  onCallEnded, 
  audioOnly = false 
}) => {
  const [callToken, setCallToken] = useState<string | null>(null);
  const [callSettings, setCallSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const setupCall = async () => {
      if (!sessionId || !isVisible) return;
      
      try {
        setLoading(true);
        setError(null);
        
        console.log('Setting up call with session ID:', sessionId);
        
        // Get the call token and settings
        const callData = await startCallWithSettings(sessionId, {
          audioOnly,
          showEndCallButton: true,
          showPauseVideoButton: !audioOnly,
          showMuteAudioButton: true,
          showSwitchCameraButton: !audioOnly,
          showAudioModeButton: true,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
        });
        
        if (mounted) {
          console.log('Call prepared with token:', callData.callToken);
          setCallToken(callData.callToken);
          setCallSettings(callData.callSettings);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error preparing call:', err);
        if (mounted) {
          setError(err.message || 'Failed to prepare call');
          setLoading(false);
        }
      }
    };
    
    setupCall();
    
    return () => {
      mounted = false;
      // End the session when component unmounts if we had an active call
      if (callToken) {
        console.log('Ending call session on unmount');
        try {
          endSession();
        } catch (err) {
          console.error('Error ending session:', err);
        }
      }
    };
  }, [sessionId, isVisible, audioOnly]);

  // Create custom call listener with handlers
  useEffect(() => {
    if (!callSettings) return;
    
    const callListener = {
      onCallEnded: () => {
        console.log('Call ended from listener');
        onCallEnded();
      },
      onCallEndButtonPressed: () => {
        console.log('End call button pressed');
        try {
          endSession();
        } catch (err) {
          console.error('Error ending session:', err);
        }
        onCallEnded();
      },
      onError: (error: any) => {
        console.error('Call error:', error);
        setError(`Call error: ${error.message || 'Unknown error'}`);
        onCallEnded();
      }
    };
    
    // Register the global listener
    const listenerId = 'CALL_SCREEN_LISTENER';
    CometChatCalls.addCallEventListener(listenerId, callListener);
    
    return () => {
      // Remove the listener when component unmounts
      CometChatCalls.removeCallEventListener(listenerId);
    };
  }, [callSettings, onCallEnded]);

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Preparing call...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : callToken && callSettings ? (
          <CometChatCalls.Component 
            callToken={callToken} 
            callSettings={callSettings} 
          />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to initialize call</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 16,
    textAlign: 'center',
  }
});

export default CallScreen; 