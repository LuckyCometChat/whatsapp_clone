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
```

## Required Dependencies

For media handling, ensure these packages are installed:

```
npm install react-native-image-picker react-native-document-picker react-native-vector-icons
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

## Troubleshooting

### Permission Issues
- iOS: Ensure that the permission strings are added to Info.plist
- Android: Make sure to request permissions at runtime using PermissionsAndroid API

### Loading Media Files
If media files aren't loading:
1. Check network connectivity
2. Verify that media URLs are correctly formatted
3. Ensure CometChat media tokens are valid
