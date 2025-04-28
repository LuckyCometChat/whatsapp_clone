# WhatsApp Clone with CometChat

A React Native mobile application that replicates the core features of WhatsApp using CometChat for real-time messaging.

## Features

- Real-time messaging
- User online/offline status
- Message status (sent, delivered, seen)
- Media messaging (images, videos, audio)
- Message reactions
- Message editing and deletion
- Typing indicators
- Audio and video calling
- Push notifications

## Setup

### Prerequisites

- Node.js and npm installed
- React Native development environment set up
- CometChat Pro account

### Installation

1. Clone the repository
2. Install dependencies:
```
npm install
```
3. Install iOS dependencies:
```
cd ios && pod install && cd ..
```

### Configuration

1. Create a `.env` file in the root directory and add your CometChat credentials:
```
APP_ID=your-app-id
AUTH_KEY=your-auth-key
REGION=your-region
```

2. Start the application:
```
npm run start
```

## Media Permissions Setup

### iOS

1. Open the iOS project in Xcode.
2. Navigate to Info.plist and add the following permissions:
   - NSCameraUsageDescription: "This app needs access to your camera to take photos for sending in chats."
   - NSPhotoLibraryUsageDescription: "This app needs access to your photo library to send images in chats."
   - NSMicrophoneUsageDescription: "This app needs access to your microphone to record audio messages."

### Android

1. Open the `android/app/src/main/AndroidManifest.xml` file and add the following permissions:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Required Dependencies

For media handling and calling, ensure these packages are installed:

```
npm install react-native-image-picker react-native-document-picker react-native-vector-icons react-native-webrtc react-native-callstats react-native-background-timer
```

Additional configuration is required for vector icons:

### iOS
Add the following to your `ios/Podfile`:
```
pod 'RNVectorIcons', :path => '../node_modules/react-native-vector-icons'
```

Then run:
```
cd ios && pod install
```

### Android
No additional setup required for Android as it's included in the gradle build.

## Calling Feature

The app supports audio and video calling between users:

1. To use the calling feature, ensure you have installed all required dependencies mentioned above
2. Tap the 📞 icon for audio calls or 🎥 for video calls in the chat header
3. The recipient will receive a call notification and can accept or decline
4. See the CALLING-SETUP.md file for more detailed setup instructions

## Usage

### Media Messages

The app supports sending:
- Images (from camera or gallery)
- Videos
- Audio files

To send media:
1. Tap the attachment icon in the chat input
2. Select the media type
3. Choose the file to send
4. The media will be uploaded and sent automatically

## Push Notifications Setup

The app includes push notification support using Firebase Cloud Messaging (FCM) and Notifee for display.

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Add Android and iOS apps to your Firebase project
3. Download the configuration files:
   - For Android: `google-services.json` and place it in `android/app/`
   - For iOS: `GoogleService-Info.plist` and place it in your Xcode project

### Android Notification Setup

1. Create a notification icon named `ic_notification.png` in different resolutions:
   - Place in `android/app/src/main/res/mipmap-mdpi/`
   - Place in `android/app/src/main/res/mipmap-hdpi/`
   - Place in `android/app/src/main/res/mipmap-xhdpi/`
   - Place in `android/app/src/main/res/mipmap-xxhdpi/`

2. Add required permissions in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

### iOS Notification Setup

1. Enable Push Notifications and Background Modes in Xcode:
   - Open Xcode project
   - Go to Signing & Capabilities
   - Add Push Notifications capability
   - Add Background Modes capability and check "Remote notifications"

2. Upload APNs key to Firebase:
   - Generate APNs key in Apple Developer portal
   - Upload the key to Firebase console in your project settings

### CometChat Setup

1. Go to CometChat Dashboard > Extensions
2. Enable "Push Notifications" extension
3. Configure both FCM and APNs settings

### Testing Push Notifications

To test that notifications are working:
1. Run the app on a real device (not simulator)
2. Login with a user account
3. Send a message from another user or device
4. Put the app in background and verify the notification appears

## Troubleshooting

### Permission Issues
- iOS: Ensure that the permission strings are added to Info.plist
- Android: Make sure to request permissions at runtime using PermissionsAndroid API

### Loading Media Files
If media files aren't loading:
1. Check network connectivity
2. Verify that media URLs are correctly formatted
3. Ensure CometChat media tokens are valid

### Calling Issues
If calling doesn't work:
1. Make sure you have the required calling dependencies installed
2. Check that camera and microphone permissions are granted
3. Refer to CALLING-SETUP.md for detailed troubleshooting
