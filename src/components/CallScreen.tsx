"use client"

import React, { useState, useEffect, useCallback } from "react"
import { View, StyleSheet, Modal, Text, ActivityIndicator, TouchableOpacity, Image } from "react-native"
import { CometChatCalls } from "@cometchat/calls-sdk-react-native"
import { CometChat } from "@cometchat/chat-sdk-react-native"

interface CallScreenProps {
  sessionId?: string
  isVisible: boolean
  onCallEnded: () => void
  audioOnly?: boolean
  receiverId?: string
  callType?: string
  isIncoming?: boolean
}

const CallScreen: React.FC<CallScreenProps> = ({ 
  sessionId, 
  isVisible, 
  onCallEnded, 
  audioOnly = false,
  receiverId,
  callType,
  isIncoming = false
}) => {
  const [callToken, setCallToken] = useState<string | null>(null)
  const [callSettings, setCallSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [callerInfo, setCallerInfo] = useState<any>(null)
  const [incomingCall, setIncomingCall] = useState<any>(null)
  
  // Function to properly end the call and clean up
  const handleCallEnd = useCallback(() => {
    console.log("Ending call and cleaning up")
    try {
      // End the session according to CometChat docs
      CometChatCalls.endSession()
      
      // If needed, clear active call from CometChat
      if (sessionId) {
        CometChat.endCall(sessionId).catch(err => 
          console.log("Error ending call in CometChat:", err)
        )
      }
    } catch (err) {
      console.error("Error ending session:", err)
    } finally {
      // Always notify parent component that call has ended
      onCallEnded()
      // Reset local state
      setCallToken(null)
      setCallSettings(null)
      setIncomingCall(null)
    }
  }, [sessionId, onCallEnded])

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!sessionId) {
      setError("No session ID available")
      return
    }
    
    try {
      setLoading(true)
      console.log("Accepting call with sessionID:", sessionId)
      await CometChat.acceptCall(sessionId)
      
      // Call will be setup by the main useEffect after session is accepted
    } catch (err: any) {
      console.error("Error accepting call:", err)
      setError(`Failed to accept call: ${err.message || "Unknown error"}`)
      setLoading(false)
    }
  }, [sessionId])

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!sessionId) return
    
    try {
      console.log("Rejecting call with sessionID:", sessionId)
      await CometChat.rejectCall(sessionId, CometChat.CALL_STATUS.REJECTED)
      onCallEnded()
    } catch (err: any) {
      console.error("Error rejecting call:", err)
      setError(`Failed to reject call: ${err.message || "Unknown error"}`)
    }
  }, [sessionId, onCallEnded])

  // Cancel outgoing call
  const cancelCall = useCallback(async () => {
    if (!sessionId) return
    
    try {
      console.log("Cancelling outgoing call with sessionID:", sessionId)
      await CometChat.rejectCall(sessionId, CometChat.CALL_STATUS.CANCELLED)
      onCallEnded()
    } catch (err: any) {
      console.error("Error cancelling call:", err)
      setError(`Failed to cancel call: ${err.message || "Unknown error"}`)
    }
  }, [sessionId, onCallEnded])

  // Get caller information
  useEffect(() => {
    if (!isVisible || !receiverId) return
    
    const fetchUserInfo = async () => {
      try {
        const user = await CometChat.getUser(receiverId)
        setCallerInfo(user)
      } catch (err) {
        console.error("Error fetching user info:", err)
      }
    }
    
    fetchUserInfo()
  }, [receiverId, isVisible])

  // Setup call when component is visible and we have a session ID
  useEffect(() => {
    let mounted = true

    const setupCall = async () => {
      if (!sessionId || !isVisible) return

      try {
        setLoading(true)
        setError(null)

        console.log("Setting up call with session ID:", sessionId)

        // Get logged in user for auth token
        const loggedInUser = await CometChat.getLoggedinUser()
        if (!loggedInUser) {
          throw new Error("No logged in user found")
        }

        const authToken = loggedInUser.getAuthToken()

        // Generate call token using the official method
        const tokenResponse = await CometChatCalls.generateToken(sessionId, authToken)
        const token = tokenResponse.token

        console.log("Call token generated:", token)

        // Create call settings according to docs
        const callListener = {
          onUserJoined: (user: any) => {
            console.log("User joined:", user)
          },
          onUserLeft: (user: any) => {
            console.log("User left:", user)
          },
          onUserListUpdated: (userList: any) => {
            console.log("User list updated:", userList)
          },
          onCallEnded: () => {
            console.log("Call ended from listener")
            handleCallEnd()
          },
          onCallEndButtonPressed: () => {
            console.log("End call button pressed")
            handleCallEnd()
          },
          onError: (error: any) => {
            console.error("Call error:", error)
            setError(`Call error: ${error.message || "Unknown error"}`)
            handleCallEnd()
          },
          onAudioModesUpdated: (audioModes: any) => {
            console.log("Audio modes updated:", audioModes)
          },
          onCallSwitchedToVideo: (event: any) => {
            console.log("Call switched to video:", event)
          },
          onUserMuted: (event: any) => {
            console.log("User muted:", event)
          },
        }

        // Create call settings using the builder pattern as per docs
        const settings = new CometChatCalls.CallSettingsBuilder()
          .enableDefaultLayout(true)
          .setIsAudioOnlyCall(audioOnly)
          .showEndCallButton(true)
          .showPauseVideoButton(!audioOnly)
          .showMuteAudioButton(true)
          .showSwitchCameraButton(!audioOnly)
          .showAudioModeButton(true)
          .startWithAudioMuted(false)
          .startWithVideoMuted(false)
          .showSwitchToVideoCallButton(audioOnly)
          .setCallEventListener(callListener)
          .build()

        if (mounted) {
          setCallToken(token)
          setCallSettings(settings)
          setLoading(false)
        }
      } catch (err: any) {
        console.error("Error preparing call:", err)
        if (mounted) {
          setError(err.message || "Failed to prepare call")
          setLoading(false)
        }
      }
    }

    setupCall()

    return () => {
      mounted = false
      // End the session when component unmounts if we had an active call
      if (callToken) {
        console.log("Ending call session on unmount")
        handleCallEnd()
      }
    }
  }, [sessionId, isVisible, audioOnly, handleCallEnd])

  // Add global call event listener
  useEffect(() => {
    const globalCallListener = {
      onUserJoined: (user: any) => {
        console.log("Global: User joined:", user)
      },
      onUserLeft: (user: any) => {
        console.log("Global: User left:", user)
      },
      onUserListUpdated: (userList: any) => {
        console.log("Global: User list updated:", userList)
      },
      onCallEnded: () => {
        console.log("Global: Call ended")
        handleCallEnd()
      },
      onCallEndButtonPressed: () => {
        console.log("Global: End call button pressed")
        handleCallEnd()
      },
      onError: (error: any) => {
        console.error("Global: Call error:", error)
        setError(`Call error: ${error.message || "Unknown error"}`)
        handleCallEnd()
      },
      onAudioModesUpdated: (audioModes: any) => {
        console.log("Global: Audio modes updated:", audioModes)
      },
      onCallSwitchedToVideo: (event: any) => {
        console.log("Global: Call switched to video:", event)
      },
      onUserMuted: (event: any) => {
        console.log("Global: User muted:", event)
      },
    }

    // Register the global listener
    const listenerId = "CALL_SCREEN_LISTENER"
    CometChatCalls.addCallEventListener(listenerId, globalCallListener)

    // Set up incoming call listener
    const incomingCallListener = new CometChat.CallListener({
      onIncomingCallReceived: (call: any) => {
        console.log("Incoming call received:", call)
        setIncomingCall(call)
      },
      onOutgoingCallAccepted: (call: any) => {
        console.log("Outgoing call accepted:", call)
      },
      onOutgoingCallRejected: (call: any) => {
        console.log("Outgoing call rejected:", call)
        handleCallEnd()
      },
      onIncomingCallCancelled: (call: any) => {
        console.log("Incoming call cancelled:", call)
        handleCallEnd()
      },
      onCallEndedMessageReceived: (call: any) => {
        console.log("Call ended message received:", call)
        handleCallEnd()
      }
    })

    CometChat.addCallListener("INCOMING_CALL_LISTENER", incomingCallListener)

    return () => {
      CometChatCalls.removeCallEventListener(listenerId)
      CometChat.removeCallListener("INCOMING_CALL_LISTENER")
    }
  }, [handleCallEnd])

  if (!isVisible) {
    return null
  }

  // If there's an active call session ready, show the CometChat call UI
  if (callToken && callSettings && !isIncoming) {
    return (
      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        supportedOrientations={["portrait", "landscape"]}
      >
        <View style={{ height: "100%", width: "100%", position: "relative" }}>
          <CometChatCalls.Component callToken={callToken} callSettings={callSettings} />
        </View>
      </Modal>
    )
  }

  // Otherwise show call UI (incoming/outgoing)
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait", "landscape"]}
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
            <TouchableOpacity style={styles.endCallButton} onPress={onCallEnded}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : isIncoming ? (
          <View style={styles.callContainer}>
            <Image
              source={{ uri: callerInfo?.getAvatar() || "https://via.placeholder.com/150" }}
              style={styles.avatar}
            />
            <Text style={styles.callerName}>{callerInfo?.getName() || "Unknown Caller"}</Text>
            <Text style={styles.callStatus}>Incoming Call</Text>
            
            <View style={styles.callActions}>
              <TouchableOpacity style={styles.acceptButton} onPress={acceptCall}>
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={rejectCall}>
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.callContainer}>
            <Image
              source={{ uri: callerInfo?.getAvatar() || "https://via.placeholder.com/150" }}
              style={styles.avatar}
            />
            <Text style={styles.callerName}>{callerInfo?.getName() || "Unknown Recipient"}</Text>
            <Text style={styles.callStatus}>Calling...</Text>
            
            <TouchableOpacity style={styles.endCallButton} onPress={cancelCall}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
  },
  loadingText: {
    color: "white",
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 20,
  },
  errorText: {
    color: "#ff4d4d",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  callContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  callerName: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  callStatus: {
    color: "#ccc",
    fontSize: 16,
    marginBottom: 40,
  },
  callActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 30,
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  rejectButton: {
    backgroundColor: "#F44336",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  endCallButton: {
    backgroundColor: "#F44336",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default CallScreen
