import { CometChat } from '@cometchat/chat-sdk-react-native';
import { Platform, AppState } from 'react-native';
import RNCallKeep from 'react-native-callkeep';
import messaging from '@react-native-firebase/messaging';
import VoipPushNotification from 'react-native-voip-push-notification';
import _BackgroundTimer from './BackgroundTimer';

// Call message interface
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

// Navigation function type
type NavigateFunction = (params: { index: number; routes: Array<{ name: string; params: any }> }) => void;

// Interface for didDisplayIncomingCall arguments
interface DidDisplayIncomingCallArgs {
    error?: string;
    callUUID?: string;
    handle?: string;
    localizedCallerName?: string;
    hasVideo?: boolean;
    fromPushKit?: boolean;
    payload?: any;
}

export default class CallKeepHelper {
    // Static properties
    static FCMToken: string | null = null;
    static voipToken: string | null = null;
    static msg: CallMessage | null = null;
    static callerId: string = '';
    static callEndedBySelf: boolean = false;
    static isLoggedIn: boolean = false;
    static IsRinging: boolean = false;
    
    // Instance properties
    navigate: NavigateFunction | null = null;
    
    constructor(msg?: CallMessage, navigate?: NavigateFunction) {
        if (msg) {
            CallKeepHelper.msg = msg;
        }
        
        if (navigate) {
            this.navigate = navigate;
        }
        
        this.setupEventListeners();
        this.registerToken();
        this.checkLoggedInUser();
        this.addLoginListener();
        
        CallKeepHelper.callEndedBySelf = false;
    }
    
    async checkLoggedInUser() {
        try {
            const user = await CometChat.getLoggedinUser();
            if (user) {
                CallKeepHelper.isLoggedIn = true;
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
                loginSuccess: () => {
                    CallKeepHelper.isLoggedIn = true;
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
    
    static displayCallAndroid() {
        if (!this.msg) return;
        
        this.callerId = this.msg.conversationId;
        
        // Display incoming call UI
        RNCallKeep.displayIncomingCall(
            this.msg.conversationId,
            this.msg.sender.name,
            this.msg.sender.name,
            'generic'
        );
        
        // Set timeout to end call if not answered
        CallKeepHelper.IsRinging = true;
        setTimeout(() => {
            if (CallKeepHelper.IsRinging) {
                CallKeepHelper.IsRinging = false;
                // 6 = MissedCall (from CallKeep constants)
                RNCallKeep.reportEndCallWithUUID(this.callerId, 6);
            }
        }, 15000);
    }
    
    answerCall = ({ callUUID }: { callUUID: string }) => {
        console.log('Call answered with UUID:', callUUID);
        
        CallKeepHelper.IsRinging = false;
        CallKeepHelper.callEndedBySelf = true;
        
        // Navigate to call screen
        if (this.navigate && CallKeepHelper.msg) {
            setTimeout(
                () =>
                this.navigate!({
                    index: 0,
                    routes: [
                        { name: 'Conversation', params: { call: CallKeepHelper.msg } },
                    ],
                }),
                2000
            );
        }
        
        // Bring app to foreground
        RNCallKeep.backToForeground();
        
        if (Platform.OS === 'ios') {
            if (AppState.currentState === 'active') {
                RNCallKeep.endAllCalls();
                _BackgroundTimer.stop();
            } else {
                this.addAppStateListener();
            }
        } else {
            RNCallKeep.endAllCalls();
            _BackgroundTimer.stop();
        }
    }
    
    addAppStateListener() {
        AppState.addEventListener('change', (newState) => {
            if (newState === 'active') {
                RNCallKeep.endAllCalls();
                _BackgroundTimer.stop();
            }
        });
    }
    
    didDisplayIncomingCall = (args: DidDisplayIncomingCallArgs) => {
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
                // 6 = MissedCall
                if (args.callUUID) {
                    RNCallKeep.reportEndCallWithUUID(args.callUUID, 6);
                }
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
                })
            );
            
            // Handle CallKeep events
            RNCallKeep.addEventListener('didLoadWithEvents', (event) => {
                for (let i = 0; i < event.length; i++) {
                    if (event[i]?.name === 'RNCallKeepDidDisplayIncomingCall') {
                        CallKeepHelper.callerId = event[i]?.data?.callUUID;
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
                    
                    CallKeepHelper.msg = msg;
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
                            
                            CallKeepHelper.msg = msg;
                        }
                    }
                }
            });
        }
        
        // Common listeners for both platforms
        RNCallKeep.addEventListener('endCall', this.endCall);
        RNCallKeep.addEventListener('answerCall', this.answerCall);
        
        if (Platform.OS === 'ios') {
            RNCallKeep.addEventListener('didDisplayIncomingCall', this.didDisplayIncomingCall);
        }
    }
    
    removeEventListeners() {
        // Remove CallKeep listeners
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
            
            // Remove CometChat call listener
            CometChat.removeCallListener('CALL_KEEP_CALL_LISTENER');
        }
    }
} 