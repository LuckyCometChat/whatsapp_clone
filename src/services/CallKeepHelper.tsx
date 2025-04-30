import { CometChat } from '@cometchat/chat-sdk-react-native';
import { CometChatCalls } from '@cometchat/calls-sdk-react-native';
import { Platform, AppState, AppStateStatus, NativeEventEmitter, NativeModules } from 'react-native';
import RNCallKeep from 'react-native-callkeep';
import messaging from '@react-native-firebase/messaging';
import VoipPushNotification from 'react-native-voip-push-notification';
import _BackgroundTimer from './BackgroundTimer';


interface CallMessage {
  conversationId: string;
  sessionId: string;
  category: string;
  action: string;
  sender: {
    name: string;
    uid: string;
    avatar?: string;
  };
  call?: {
    category: string;
  };
}


type NavigateFunction = (params: { index: number; routes: Array<{ name: string; params: any }> }) => void;


interface DidDisplayIncomingCallEvent {
  error?: string;
  errorCode?: string;
  callUUID: string;
  handle: string;
  localizedCallerName: string;
  hasVideo: "1" | "0";
  fromPushKit: "1" | "0";
  payload: object;
}

export default class CallKeepHelper {

  static FCMToken: string | null = null;
  static voipToken: string | null = null;
  static msg: CallMessage | null = null;
  static callerId: string = '';
  static callEndedBySelf: boolean = false;
  static isLoggedIn: boolean = false;
  static IsRinging: boolean = false;
  static currentUserId: string = '';
  static isAppInForeground: boolean = true;
  static activeCallSessionId: string | null = null;
  static navigateFunction: NavigateFunction | null = null;
   
  navigate: NavigateFunction | null = null;
  appStateSubscription: any = null;
   
  // New method to set navigation function from outside
  static setNavigateFunction(navigateFunc: NavigateFunction) {
    this.navigateFunction = navigateFunc;
    console.log('Navigation function set for CallKeepHelper');
  }
   
  constructor(msg?: CallMessage, navigate?: NavigateFunction) {
    if (msg) {
      CallKeepHelper.msg = msg;
    }
     
    if (navigate) {
      this.navigate = navigate;
      CallKeepHelper.navigateFunction = navigate;
    }
     
    this.setupEventListeners();
    this.registerToken();
    this.checkLoggedInUser();
    this.addLoginListener();
    this.setupAppStateListener();
     
    CallKeepHelper.callEndedBySelf = false;
    CallKeepHelper.isAppInForeground = AppState.currentState === 'active';
  }
   
  setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }
   
  handleAppStateChange = (nextAppState: AppStateStatus) => {
    CallKeepHelper.isAppInForeground = nextAppState === 'active';
  }
   
  async checkLoggedInUser() {
    try {
      const user = await CometChat.getLoggedinUser();
      if (user) {
        CallKeepHelper.isLoggedIn = true;
        CallKeepHelper.currentUserId = user.getUid();
      }
    } catch (error) {
      console.log('Error checking logged in user:', error);
    }
  }
   
  addLoginListener() {
    const listenerID = 'CALL_KEEP_LOGIN_LISTENER';
    CometChat.addLoginListener(
      listenerID,
      new CometChat.LoginListener({
        loginSuccess: (user: CometChat.User) => {
          CallKeepHelper.isLoggedIn = true;
          CallKeepHelper.currentUserId = user.getUid();
          this.registerTokenToCometChat();
        },
      })
    );
  }
   
  async registerTokenToCometChat() {
    if (!CallKeepHelper.isLoggedIn) {
      return false;
    }
     
    try {
      if (Platform.OS === 'android') {
        if (CallKeepHelper.FCMToken) {
          await CometChat.registerTokenForPushNotification(
            CallKeepHelper.FCMToken
          );
          console.log('FCM token registered for Android');
        }
      } else if (Platform.OS === 'ios') {
        if (CallKeepHelper.FCMToken) {
          await CometChat.registerTokenForPushNotification(
            CallKeepHelper.FCMToken,
            { voip: false }
          );
          console.log('FCM token registered for iOS');
        }
         
        if (CallKeepHelper.voipToken) {
          await CometChat.registerTokenForPushNotification(
            CallKeepHelper.voipToken,
            { voip: true }
          );
          console.log('VoIP token registered for iOS');
        }
      }
    } catch (error) {
      console.error('Error registering token:', error);
    }
  }
   
  async registerToken() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
         
      if (enabled) {
        if (Platform.OS === 'android') {
          const FCM = await messaging().getToken();
          CallKeepHelper.FCMToken = FCM;
          this.registerTokenToCometChat();
        } else if (Platform.OS === 'ios') {
          // Register for VoIP push notifications
          if (VoipPushNotification) {
            VoipPushNotification.registerVoipToken();
          }
           
          // Get the APNs token
          const FCM = await messaging().getAPNSToken();
          if (FCM) {
            CallKeepHelper.FCMToken = FCM;
            this.registerTokenToCometChat();
          }
        }
      }
    } catch (error) {
      console.error('Error registering token:', error);
    }
  }
   
  endCall = ({ callUUID }: { callUUID: string }) => {
    console.log('Call ended with UUID:', callUUID);
     
    if (CallKeepHelper.callerId) {
      RNCallKeep.endCall(CallKeepHelper.callerId);
    }
     
    _BackgroundTimer.start();
    setTimeout(() => {
      this.rejectCall();
    }, 3000);
  }
   
  async rejectCall() {
    if (
      !CallKeepHelper.callEndedBySelf &&
      CallKeepHelper.msg &&
      CallKeepHelper.msg.call?.category !== 'custom'
    ) {
      const sessionID = CallKeepHelper.msg.sessionId;
      const status = CometChat.CALL_STATUS.REJECTED;
       
      try {
        await CometChat.rejectCall(sessionID, status);
        console.log('Call rejected successfully');
      } catch (error) {
        console.error('Error rejecting call:', error);
      }
       
      _BackgroundTimer.stop();
    } else {
      _BackgroundTimer.stop();
    }
  }
   
  static shouldDisplayCallNotification() {
    // Only show notifications if:
    // 1. We have a valid message
    // 2. Current user is not the sender
    // 3. App is in background or notification is important
    if (!this.msg) return false;
     
    const isSender = this.currentUserId === this.msg.sender.uid;
    const isImportantCall = this.msg.call?.category === 'important'; 
     
    return !isSender && (!this.isAppInForeground || isImportantCall);
  }
   
  static displayCallAndroid() {
    if (!this.shouldDisplayCallNotification()) return;
     
    this.callerId = this.msg!.conversationId;
     
    // Display incoming call UI
    RNCallKeep.displayIncomingCall(
      this.msg!.conversationId,
      this.msg!.sender.name,
      this.msg!.sender.name,
      'generic'
    );
     
    CallKeepHelper.IsRinging = true;
    setTimeout(() => {
      if (CallKeepHelper.IsRinging) {
        CallKeepHelper.IsRinging = false;
        RNCallKeep.reportEndCallWithUUID(this.callerId, 6);
      }
    }, 15000);
  }
   
  static async directlyHandleCall(sessionId: string): Promise<boolean> {
    try {
      try {
        const activeCall = await CometChat.getActiveCall();
        if (activeCall) {
          console.log('Found existing active call, clearing it before accepting new call');
          if (CometChatCalls && CometChatCalls.endSession) {
            await CometChatCalls.endSession();
          }
          await CometChat.clearActiveCall();
        }
      } catch (error) {
        console.error('Error checking active call:', error);
      }
      try {
        await CometChat.acceptCall(sessionId);
        console.log('Call accepted successfully with session ID:', sessionId);
      } catch (error: any) {
        if (error && error.code === 'ERR_CALL_USER_ALREADY_JOINED') {
          console.log('User already joined call - continuing with call UI');
        } else {
          throw error;
        }
      }
      
      // Check if it's an audio call
      const isAudioCall = this.msg?.category === 'audio' || this.msg?.call?.category === 'audio';
      const success = this.navigateToCallScreen(sessionId, true, isAudioCall);
      
      if (!success) {
        console.error('Failed to navigate to call screen');
        const eventEmitter = new NativeEventEmitter();
        eventEmitter.emit('CallAcceptedRequiresNavigation', {
          sessionId,
          audioOnly: isAudioCall
        });
      }
      return true;
    } catch (error) {
      console.error('Error handling call directly:', error);
      return false;
    }
  }
   
  static async clearActiveCall() {
    try {
      const activeCall = await CometChat.getActiveCall();
      if (activeCall) {
        console.log('Found existing active call, clearing it before accepting new call');
        try {
          if (CometChatCalls && CometChatCalls.endSession) {
            await CometChatCalls.endSession();
          }
        } catch (sessionError) {
          console.error('Error ending existing call session:', sessionError);
        }
         
        await CometChat.clearActiveCall();
        console.log('Successfully cleared active call');
      }
       
      return true;
    } catch (error) {
      console.error('Error clearing active call:', error);
      try {
        await CometChat.clearActiveCall();
        return true;
      } catch (innerError) {
        console.error('Failed to clear active call even with fallback:', innerError);
        return false;
      }
    }
  }
   
  static navigateToCallScreen(sessionId: string, isIncoming: boolean = true, audioOnly: boolean = false) {
    if (this.navigateFunction) {
      // Check if msg exists and if it's an audio call
      const isAudioCall = this.msg?.category === 'audio' || this.msg?.call?.category === 'audio';
      
      this.navigateFunction({
        index: 0,
        routes: [
          { 
            name: 'CallScreen', 
            params: { 
              sessionId,
              isVisible: true,
              isIncoming,
              // Use the determined audio flag instead of the passed parameter
              audioOnly: isAudioCall
            } 
          },
        ],
      });
      return true;
    }
    return false;
  }
   
  answerCall = ({ callUUID }: { callUUID: string }) => {
    console.log('Call answered with UUID:', callUUID);
     
    CallKeepHelper.IsRinging = false;
    CallKeepHelper.callEndedBySelf = true;
    RNCallKeep.backToForeground();
     
    if (!CallKeepHelper.msg) {
      console.error('No call message available');
      return;
    }
     
    const sessionId = CallKeepHelper.msg.sessionId;
    const isAudioCall = CallKeepHelper.msg.category === 'audio' || CallKeepHelper.msg.call?.category === 'audio';
    
    CallKeepHelper.directlyHandleCall(sessionId)
      .then(() => {
        setTimeout(() => {
          if (CallKeepHelper.navigateFunction) {
            CallKeepHelper.navigateFunction({
              index: 0,
              routes: [
                { 
                  name: 'CallScreen', 
                  params: { 
                    sessionId: sessionId,
                    isVisible: true,
                    isIncoming: true,
                    audioOnly: isAudioCall,
                    videoOnly: CallKeepHelper.msg?.category === 'video' || CallKeepHelper.msg?.call?.category === 'video'
                  } 
                },
              ],
            });
          } else if (this.navigate) {
            this.navigate({
              index: 0,
              routes: [
                { 
                  name: 'CallScreen', 
                  params: { 
                    sessionId: sessionId,
                    isVisible: true,
                    isIncoming: true,
                    audioOnly: isAudioCall,
                    videoOnly: CallKeepHelper.msg?.category === 'video' || CallKeepHelper.msg?.call?.category === 'video'
                  } 
                },
              ],
            });
          } else {
            const eventEmitter = new NativeEventEmitter();
            eventEmitter.emit('CallAcceptedRequiresNavigation', {
              sessionId,
              audioOnly: isAudioCall
            });
          }
        }, 1000);
      })
      .catch((error) => {
        console.error('Error in call acceptance flow:', error);
      });
     
    if (Platform.OS === 'ios') {
      if (AppState.currentState === 'active') {
        setTimeout(() => {
          RNCallKeep.endAllCalls();
          _BackgroundTimer.stop();
        }, 3000);
      } else {
        this.addAppStateListener();
      }
    } else {
      setTimeout(() => {
        RNCallKeep.endAllCalls();
        _BackgroundTimer.stop();
      }, 3000);
    }
  };
   
  addAppStateListener() {
    AppState.addEventListener('change', (newState) => {
      if (newState === 'active') {
        RNCallKeep.endAllCalls();
        _BackgroundTimer.stop();
      }
    });
  }
   
  didDisplayIncomingCall = (args: DidDisplayIncomingCallEvent) => {
    if (args.callUUID && Platform.OS === 'ios') {
      CallKeepHelper.callerId = args.callUUID;
    }
     
    if (args.error) {
      console.log('Callkeep didDisplayIncomingCall error:', args.error);
    }
     
    CallKeepHelper.IsRinging = true;
     
    setTimeout(() => {
      if (CallKeepHelper.IsRinging) {
        CallKeepHelper.IsRinging = false;
        RNCallKeep.reportEndCallWithUUID(args.callUUID, 6);
      }
    }, 15000);
  }
   
  setupEventListeners() {
    if (Platform.OS === 'ios' && VoipPushNotification) {
      // Add call listener for iOS
      CometChat.addCallListener(
        'CALL_KEEP_CALL_LISTENER',
        new CometChat.CallListener({
          onIncomingCallCancelled: () => {
            RNCallKeep.endAllCalls();
          },
          onIncomingCallReceived: (call: CometChat.Call) => {
            const receiverId = call.getReceiverId();
            const senderId = call.getSender().getUid();
             
            if (receiverId === CallKeepHelper.currentUserId && 
              senderId !== CallKeepHelper.currentUserId && 
              (!CallKeepHelper.isAppInForeground || AppState.currentState !== 'active')) {
              // Process the call data and set up CallKeepHelper.msg
              const callMessage: CallMessage = {
                conversationId: call.getSessionId(),
                sessionId: call.getSessionId(),
                category: call.getType(),
                action: call.getInitiatedAt() ? 'initiated' : 'received',
                sender: {
                  name: call.getSender().getName(),
                  uid: call.getSender().getUid(),
                  avatar: call.getSender().getAvatar()
                },
                call: {
                  category: call.getType()
                }
              };
               
              CallKeepHelper.msg = callMessage;
               
              if (Platform.OS === 'android') {
                CallKeepHelper.displayCallAndroid();
              }
            }
          }
        })
      );
       
      // Handle CallKeep events
      RNCallKeep.addEventListener('didLoadWithEvents', (events: any[]) => {
        if (!events || !Array.isArray(events) || events.length < 1) {
          return;
        }
         
        for (let i = 0; i < events.length; i++) {
          if (events[i]?.name === 'RNCallKeepDidDisplayIncomingCall' && events[i]?.data) {
            CallKeepHelper.callerId = events[i].data.callUUID || '';
          }
        }
      });
       
      // VoIP Push Notification listeners for iOS
      VoipPushNotification.addEventListener('register', async (token: string) => {
        CallKeepHelper.voipToken = token;
        this.registerTokenToCometChat();
      });
       
      VoipPushNotification.addEventListener('notification', (notification: any) => {
        if (notification.message) {
          const msg = CometChat.CometChatHelper.processMessage(
            notification.message
          ) as unknown as CallMessage;
           
          // Check if the current user is the receiver
          if (msg.sender.uid !== CallKeepHelper.currentUserId) {
            CallKeepHelper.msg = msg;
          }
        }
      });
       
      VoipPushNotification.addEventListener('didLoadWithEvents', async (events: any[]) => {
        if (!events || !Array.isArray(events) || events.length < 1) {
          return;
        }
         
        for (const voipPushEvent of events) {
          const { name, data } = voipPushEvent;
           
          if (name === VoipPushNotification.RNVoipPushRemoteNotificationsRegisteredEvent) {
            CallKeepHelper.voipToken = data;
          } else if (name === VoipPushNotification.RNVoipPushRemoteNotificationReceivedEvent) {
            if (data?.message) {
              const msg = CometChat.CometChatHelper.processMessage(
                data.message
              ) as unknown as CallMessage;
               
              if (msg.sender.uid !== CallKeepHelper.currentUserId) {
                CallKeepHelper.msg = msg;
              }
            }
          }
        }
      });
    } else if (Platform.OS === 'android') {
      CometChat.addCallListener(
        'CALL_KEEP_CALL_LISTENER',
        new CometChat.CallListener({
          onIncomingCallReceived: (call: CometChat.Call) => {
            const receiverId = call.getReceiverId();
            const senderId = call.getSender().getUid();
             
            if (receiverId === CallKeepHelper.currentUserId && 
              senderId !== CallKeepHelper.currentUserId && 
              (!CallKeepHelper.isAppInForeground || AppState.currentState !== 'active')) {
              // Process the call data and set up CallKeepHelper.msg
              const callMessage: CallMessage = {
                conversationId: call.getSessionId(),
                sessionId: call.getSessionId(),
                category: call.getType(),
                action: call.getInitiatedAt() ? 'initiated' : 'received',
                sender: {
                  name: call.getSender().getName(),
                  uid: call.getSender().getUid(),
                  avatar: call.getSender().getAvatar()
                },
                call: {
                  category: call.getType()
                }
              };
               
              CallKeepHelper.msg = callMessage;
              CallKeepHelper.displayCallAndroid();
            }
          },
          onIncomingCallCancelled: () => {
            RNCallKeep.endAllCalls();
          }
        })
      );
    }
     
    // Common listeners for both platforms
    RNCallKeep.addEventListener('endCall', this.endCall);
    RNCallKeep.addEventListener('answerCall', this.answerCall);
     
    if (Platform.OS === 'ios') {
      RNCallKeep.addEventListener('didDisplayIncomingCall', this.didDisplayIncomingCall as any);
    }
  }
   
  removeEventListeners() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
     
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('answerCall');
     
    if (Platform.OS === 'ios') {
      RNCallKeep.removeEventListener('didDisplayIncomingCall');
      RNCallKeep.removeEventListener('didLoadWithEvents');
       
      // Remove VoIP listeners
      if (VoipPushNotification) {
        VoipPushNotification.removeEventListener('didLoadWithEvents');
        VoipPushNotification.removeEventListener('register');
        VoipPushNotification.removeEventListener('notification');
      }
       
      CometChat.removeCallListener('CALL_KEEP_CALL_LISTENER');
    } else {
      CometChat.removeCallListener('CALL_KEEP_CALL_LISTENER');
    }
  }
} 