# Brainbox React Native SDK

A React Native SDK for Brainbox mobile chat experiences.

## Installation

```bash
npm install brainbox-react-native-sdk
# or
yarn add brainbox-react-native-sdk
```

## What it includes

- `BrainboxReactNativeSDK` — mobile-friendly client for Brainbox chat, session, ingest, and health endpoints
- `ChatScreen` — a simple React Native chat screen component that works with the SDK

## Usage

```js
import React from 'react';
import { SafeAreaView } from 'react-native';
import { BrainboxReactNativeSDK, ChatScreen } from 'brainbox-react-native-sdk';

const sdk = new BrainboxReactNativeSDK(
  'https://api.yourbackend.com',
  'YOUR_API_KEY',
  'tenant-123'
);

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ChatScreen
        sdk={sdk}
        title="Brainbox Mobile Chat"
        placeholder="Ask a question..."
      />
    </SafeAreaView>
  );
}
```

## Notes

- This package is a React Native library, not a standalone server.
- It must be installed in a React Native mobile app and included in that app's build.
- The app communicates directly with your Brainbox backend API.

## Deployment

The React Native SDK package is published to NPM like any package, but the mobile app itself must be built and distributed.

- For Android: build an APK/AAB and publish or side-load.
- For iOS: build an IPA and distribute via TestFlight or App Store.

The SDK package does not deploy itself; it is included inside your mobile app.
