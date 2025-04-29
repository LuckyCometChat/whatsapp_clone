import { CometChat } from "@cometchat/chat-sdk-react-native";
import messaging from "@react-native-firebase/messaging";
import { Platform, PermissionsAndroid, AppState } from "react-native";
import notifee, { AndroidImportance, EventType, Event, AndroidVisibility } from "@notifee/react-native";
import RNCallKeep from 'react-native-callkeep';
import CallKeepHelper from './CallKeepHelper';

const APP_ID = "272268d5643b5db";
const REGION = "IN";
const AUTH_KEY = "3a1b1fef651a2279ff270d847dd67991ded9808b";

// Define message type for CallKeep
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

const APP_SETTINGS = new CometChat.AppSettingsBuilder()
    .subscribePresenceForAllUsers()
    .setRegion(REGION)
    .build();

// CallKeep options
const callKeepOptions = {
    ios: {
        appName: 'WhatsApp Clone',
        supportsVideo: true,
        imageName: 'phone_icon'
    },
    android: {
        alertTitle: 'Permissions required',
        alertDescription: 'This app needs to access your phone accounts',
        cancelButton: 'Cancel',
        okButton: 'ok',
        imageName: 'phone_account_icon',
        additionalPermissions: [] as string[],
        // This must be false for most apps - true is only for special dialer/phone apps
        selfManaged: false,
        // These will be replaced by the string resources
        foregroundService: {
            channelId: 'com.whatsapp.clone',
            channelName: 'Foreground service for call',
            notificationTitle: 'Call in progress',
            notificationIcon: 'ic_notification',
        },
    },
};

// Initialize CallKeep
export const initCallKeep = () => {
    try {
        // First setup CallKeep with options
        RNCallKeep.setup(callKeepOptions)
            .then(() => {
                console.log('CallKeep setup successful');
                // Check and ensure that the phone account is available after setup
                RNCallKeep.setAvailable(true);
                
                // Check for Android specific permissions
                if (Platform.OS === 'android') {
                    // On Android 11+, we need to ensure permissions are granted
                    RNCallKeep.hasPhoneAccount()
                        .then((hasPhoneAccount) => {
                            console.log('Phone account exists:', hasPhoneAccount);
                            if (!hasPhoneAccount) {
                                // Register the phone account to get proper permissions
                                // Pass the same options used for setup
                                RNCallKeep.registerPhoneAccount(callKeepOptions);
                            }
                        })
                        .catch(error => {
                            console.error('Error checking for phone account:', error);
                            // Try registering phone account anyway
                            RNCallKeep.registerPhoneAccount(callKeepOptions);
                        });
                }
            })
            .catch(error => {
                console.error('CallKeep setup error:', error);
            });
        
        return new CallKeepHelper();
    } catch (error) {
        console.error('Error initializing CallKeep:', error);
    }
};

/**
 * Initialize CometChat
 */
export const initCometChat = async () => {
    try {
        const response = await CometChat.init(APP_ID, APP_SETTINGS);
        console.log("CometChat initialization successful:", response);
        return response;
    } catch (error) {
        console.error("CometChat initialization failed:", error);
        throw error;
    }
};

/**
 * Login to CometChat
 * @param uid User ID to login with
 * @param authKey Auth key to use (default is the predefined AUTH_KEY)
 */
export const loginWithCometChat = async (uid: string, authKey = AUTH_KEY) => {
    try {
        const user = await CometChat.login(uid, authKey);
        console.log("CometChat login successful:", user);
        
        // Register FCM token after successful login
        await registerPushNotificationToken();
        
        return user;
    } catch (error) {
        console.error("CometChat login failed:", error);
        throw error;
    }
};

/**
 * Request all required permissions for notifications
 */
export const requestNotificationPermissions = async () => {
    try {
        // For Android 13+ (API level 33+), explicitly request notification permission
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                console.log('Notification permission denied');
                return false;
            }
        }
        
        // For iOS and older Android versions
        const authStatus = await messaging().requestPermission();
        const enabled = 
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;
            
        if (!enabled) {
            console.log('Notification permission denied');
            return false;
        }
        
        // For iOS specifically, register for remote notifications
        if (Platform.OS === 'ios') {
            await messaging().registerDeviceForRemoteMessages();
        }
        
        return true;
    } catch (error) {
        console.error('Error requesting notification permissions:', error);
        return false;
    }
};

/**
 * Request permission and register FCM token with CometChat
 * Call this after user login is successful
 */
export const registerPushNotificationToken = async () => {
    try {
        // Request permissions first
        const permissionGranted = await requestNotificationPermissions();
        
        if (!permissionGranted) {
            console.log('Push notification permissions not granted');
            return;
        }
        
        // Make sure iOS device is registered for remote notifications
        if (Platform.OS === 'ios') {
            const registered = await messaging().isDeviceRegisteredForRemoteMessages;
            if (!registered) {
                await messaging().registerDeviceForRemoteMessages();
            }
        }
        
        // Get FCM token
        const fcmToken = await messaging().getToken();
        console.log('FCM Token:', fcmToken);
        
        // Get current logged in user before registering token
        const loggedInUser = await CometChat.getLoggedinUser();
        if (!loggedInUser) {
            console.log('No logged-in user found, cannot register push token');
            return;
        }
        
        // Register token with CometChat
        if (fcmToken) {
            const response = await CometChat.registerTokenForPushNotification(fcmToken);
            console.log('Token registered successfully for user:', loggedInUser.getUid());
            return response;
        }
    } catch (error) {
        console.error('Error registering push token:', error);
        throw error;
    }
};

/**
 * Unregister FCM token to stop receiving notifications
 * Call this during logout
 */
export const unregisterPushNotificationToken = async () => {
    try {
        // Get the current FCM token
        const fcmToken = await messaging().getToken();
        
        if (fcmToken) {
            await messaging().deleteToken();
            console.log('FCM token deleted');
        }
    } catch (error) {
        console.error('Error unregistering push token:', error);
    }
};

/**
 * Setup token refresh listener
 */
export const setupTokenRefreshListener = () => {
    return messaging().onTokenRefresh(async (fcmToken) => {
        try {
            console.log('FCM Token refreshed:', fcmToken);
            const response = await CometChat.registerTokenForPushNotification(fcmToken);
            console.log('Refreshed token registered successfully:', response);
            return response;
        } catch (error) {
            console.error('Error registering refreshed push token:', error);
            throw error;
        }
    });
};

/**
 * Create Android notification channel
 */
export const createNotificationChannel = async () => {
    if (Platform.OS === 'android') {
        // Create a channel with high importance
        await notifee.createChannel({
            id: 'chat-messages',
            name: 'Chat Messages',
            lights: true,
            vibration: true,
            sound: 'default',
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            badge: true,
        });
    }
};

/**
 * Display a notification with the message content
 */
export const displayNotification = async (title: string, body: string, data?: any) => {
    try {
        // Create channel if on Android
        await createNotificationChannel();
        
        // Create notification icon options
        const androidOptions = {
            channelId: 'chat-messages',
            pressAction: {
                id: 'default',
            },
            smallIcon: 'ic_notification',
            largeIcon: data?.sender?.avatar || undefined,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            color: '#25D366', // WhatsApp green color for the notification
            showTimestamp: true,
        };
        
        // Display notification
        await notifee.displayNotification({
            title,
            body,
            data,
            android: androidOptions,
            ios: {
                foregroundPresentationOptions: {
                    badge: true,
                    sound: true,
                    banner: true,
                    list: true,
                },
                sound: 'default',
            },
        });
    } catch (error) {
        console.error('Error displaying notification:', error);
    }
};

/**
 * Handle incoming Firebase messages and display them as notifications
 */
export const setupMessagingListeners = () => {
    // Handle foreground messages
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
        console.log('Foreground message received:', remoteMessage);
        
        const { notification, data } = remoteMessage;
        
        // Handle call notifications in foreground
        if (data?.message) {
            try {
                // Process the message
                const msg = CometChat.CometChatHelper.processMessage(
                    JSON.parse(data.message as string)
                ) as unknown as CallMessage;
                
                // Check if it's a call notification
                if (msg.category === 'call' && Platform.OS === 'android') {
                    // Check if call is initiated or ended
                    if (msg.action === 'initiated') {
                        // Set message in CallKeepHelper
                        CallKeepHelper.msg = msg;
                        // Display call notification
                        CallKeepHelper.displayCallAndroid();
                        return; // Don't show regular notification for calls
                    } else if (msg.action === 'cancelled' || msg.action === 'rejected' || msg.action === 'ended') {
                        // If call ended, end the CallKeep call
                        if (msg.conversationId) {
                            RNCallKeep.endCall(msg.conversationId);
                        }
                        return; // Don't show regular notification for ended calls
                    }
                }
            } catch (error) {
                console.error('Error processing call notification:', error);
            }
        }
        
        // Force display notification even in foreground for regular messages
        if (notification) {
            await displayNotification(
                notification.title || 'New Message',
                notification.body || 'You have a new message',
                data
            );
        } else if (data) {
            // Handle data-only messages
            await displayNotification(
                (data.title as string) || 'New Message',
                (data.body as string) || 'You have a new message',
                data
            );
        }
    });
    
    // Handle background/quit state messages via notifee events
    notifee.onBackgroundEvent(async ({ type, detail }: Event) => {
        if (type === EventType.PRESS) {
            console.log('User pressed notification', detail.notification);
            // Add navigation logic here if needed
        }
    });
    
    // Handle notification press in foreground
    notifee.onForegroundEvent(({ type, detail }: Event) => {
        if (type === EventType.PRESS) {
            console.log('User pressed notification in foreground', detail.notification);
            // Add navigation logic here if needed
        }
    });
    
    // Add app state change listener to refresh token when app comes to foreground
    AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
            // Refresh token when app becomes active
            registerPushNotificationToken();
        }
    });
    
    return unsubscribeForeground;
};

/**
 * Register background handler for handling incoming calls when the app is in background
 */
export const setupBackgroundMessageHandler = () => {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('Background message received:', remoteMessage);
        const { notification, data } = remoteMessage;
        
        // Handle call notifications with CallKeep
        if (Platform.OS === 'android' && data?.message) {
            try {
                // Setup CallKeep for call notifications
                RNCallKeep.setup(callKeepOptions);
                RNCallKeep.setAvailable(true);
                
                // Process the message
                const msg = CometChat.CometChatHelper.processMessage(
                    JSON.parse(data.message as string)
                ) as unknown as CallMessage;
                
                // Check if it's a call notification
                if (msg.category === 'call') {
                    // Check if call is initiated or ended
                    if (msg.action === 'initiated') {
                        // Set message in CallKeepHelper
                        CallKeepHelper.msg = msg;
                        // Display call notification
                        CallKeepHelper.displayCallAndroid();
                    } else {
                        // If call ended, end the CallKeep call
                        RNCallKeep.endCall(msg.conversationId);
                    }
                    return; // Don't show regular notification for calls
                }
            } catch (error) {
                console.error('Error processing call notification:', error);
            }
        }
        
        // Process regular notifications
        if (notification) {
            await displayNotification(
                notification.title || 'New Message',
                notification.body || 'You have a new message',
                data
            );
        } else if (data) {
            await displayNotification(
                (data.title as string) || 'New Message',
                (data.body as string) || 'You have a new message',
                data
            );
        }
    });
};

/**
 * Initialize push notifications (combine all initialization steps)
 */
export const initPushNotifications = async () => {
    try {
        // Create notification channel for Android
        await createNotificationChannel();
        
        // Initialize CallKeep
        if (Platform.OS === 'android') {
            initCallKeep();
        }
        
        // Set up background message handler
        setupBackgroundMessageHandler();
        
        // Setup message listeners for foreground messages
        const unsubscribe = setupMessagingListeners();
        
        // Request permissions explicitly
        await requestNotificationPermissions();
        
        return unsubscribe;
    } catch (error) {
        console.error('Error initializing push notifications:', error);
        throw error;
    }
};

/**
 * Check if notifications are enabled at the OS level
 */
export const checkNotificationPermissions = async () => {
    try {
        const authStatus = await messaging().hasPermission();
        return authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
               authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    } catch (error) {
        console.error('Error checking notification permissions:', error);
        return false;
    }
};

/**
 * Logout from CometChat
 */
export const logoutFromCometChat = async () => {
    try {
        // Unregister push token before logout
        await unregisterPushNotificationToken();
        
        const response = await CometChat.logout();
        console.log("CometChat logout successful:", response);
        return response;
    } catch (error) {
        console.error("CometChat logout failed:", error);
        throw error;
    }
};

    