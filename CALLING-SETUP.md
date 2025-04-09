# Setting Up CometChat Calling in WhatsApp Clone

This document provides instructions on how to properly set up and use CometChat calling features in the WhatsApp Clone application.

## Prerequisites

The application already has the following dependencies installed:
- `@cometchat/chat-sdk-react-native`: For basic chat functionality
- `@cometchat/calls-sdk-react-native`: For audio and video calling

## Troubleshooting

If you encounter the error "CometChat calling module not found", follow these steps:

### 1. Verify Dependencies

Ensure that both SDKs are properly installed:

```bash
npm list @cometchat/chat-sdk-react-native
npm list @cometchat/calls-sdk-react-native
```

If any dependency is missing, install it:

```bash
npm install @cometchat/calls-sdk-react-native
```

### 2. Additional Dependencies for Calling

The calling functionality requires additional native dependencies. Make sure these are properly installed:

```bash
npm install react-native-webrtc react-native-callstats react-native-background-timer
```

### 3. iOS Setup

For iOS, you need to update your Podfile and Info.plist:

#### Update Podfile

Add the following to your `ios/Podfile`:

```ruby
permissions_path = '../node_modules/react-native-permissions/ios'

pod 'Permission-Camera', :path => "#{permissions_path}/Camera"
pod 'Permission-Microphone', :path => "#{permissions_path}/Microphone"
```

Then run:

```bash
cd ios && pod install && cd ..
```

#### Update Info.plist

Add these permissions to your `ios/yourAppName/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>This app needs access to your camera for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app needs access to your microphone for voice calls</string>
```

### 4. Android Setup

For Android, ensure these permissions are in your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 5. Application Initialization

Make sure both CometChat SDKs are initialized at application startup:

```typescript
// In App.tsx or equivalent
import { initCometChat } from './src/services/cometChat';
import { initCometChat as initCometChatCalls } from './src/services/cometCall';

// Initialize both SDKs
await initCometChat();
await initCometChatCalls();
```

## Testing Calls

After setup is complete, you should be able to make calls by:

1. Opening a chat with another user
2. Tapping the 📞 (audio call) or 🎥 (video call) button in the chat header
3. The recipient will receive a call notification and can accept or decline

## Common Issues

1. **Permission Denied**: Make sure your app has camera and microphone permissions
2. **Module Not Found**: Ensure all dependencies are properly installed
3. **Black Screen During Video Call**: Usually indicates permission or camera setup issues
4. **No Audio**: Check microphone permissions and audio settings

If you continue to experience issues, please refer to the [CometChat documentation](https://www.cometchat.com/docs/calls-sdk/overview) for more details. 