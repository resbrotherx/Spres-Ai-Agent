# Spres-React SDK & Backend Deployment Guide

## What's Been Implemented

### Backend (brainBox)
✅ **New Endpoints:**
- `GET /api/chat/sessions?tenant_id=<id>` - List sessions grouped by date
- `GET /api/chat/session/{session_id}/messages` - Get all messages in a session with metadata
- `POST /api/chat/upload/file` - Upload files
- `POST /api/chat/upload/image` - Upload images

✅ **Improvements:**
- Enhanced ingest pipeline error handling with detailed logging
- Better task status tracking

### Frontend SDK (spres-react)
✅ **New Methods:**
- `listSessions()` - Fetch all sessions grouped by date
- `getSessionMessages(sessionId)` - Get session conversation history
- `uploadFile(file, sessionId)` - Upload file
- `uploadImage(image, sessionId)` - Upload image

✅ **Enhanced Hook (useBrainboxChat):**
- `loadSession(sessionId)` - Load session with all messages
- `uploadFile(file)` - Upload file in chat
- `uploadImage(image)` - Upload image in chat
- `exportChat(format)` - Export as JSON
- `sessions` - List of all sessions
- Message metadata (timestamps, user initials)

✅ **TypeScript Types:**
- New `CustomizationProps` interface
- Extended `ChatWidgetProps` and `ChatPanelProps`
- New interfaces for sessions and grouped dates

## Deployment Steps

### 1. Deploy Backend Changes

```bash
# On your server (165.227.77.33)
cd /var/www/Spres-Ai-Agent/brainBox

# Install aiofiles dependency (needed for file upload)
pip install aiofiles

# Restart the backend service
sudo systemctl restart brainbox
# or
python -m uvicorn app.main:app --reload
```

### 2. Test Backend Endpoints

Use Swagger at `http://165.227.77.33:8000/docs`

**Test 1: List Sessions**
```bash
curl -X GET "http://165.227.77.33:8000/api/chat/sessions?tenant_id=YOUR_TENANT_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Test 2: Get Session Messages**
```bash
curl -X GET "http://165.227.77.33:8000/api/chat/session/SESSION_ID/messages" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Test 3: Upload File**
```bash
curl -X POST "http://165.227.77.33:8000/api/chat/upload/file" \
  -F "file=@test.txt" \
  -F "tenant_id=YOUR_TENANT_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 3. Publish SDK to NPM

```bash
# On your local machine
cd sdk-react

# Verify build
npm run build

# Login to NPM
npm login

# Publish
npm publish

# Verify on NPM
npm view spres-react
```

### 4. Update Preview App

```bash
# Update to use live SDK from NPM
cd sdk-react/preview
npm install spres-react@latest

# Update import in src/App.jsx
# FROM: import { BrainboxReactSDK, ChatPanel, ChatWidget } from '../../dist/index.js';
# TO:   import { BrainboxReactSDK, ChatPanel, ChatWidget } from 'spres-react';

npm run dev
```

## Integration Points with Components

The existing `ChatPanel` and `ChatWidget` components can now use:

### In ChatPanel:
```typescript
import { useBrainboxChat } from 'spres-react';

const ChatPanel = ({ sdk, ...props }: ChatPanelProps) => {
  const { messages, sessions, loadSession, sendMessage, uploadFile, uploadImage } = 
    useBrainboxChat(sdk);

  // Render sessions list from grouped dates
  // Use loadSession onClick
  // Use uploadFile for file inputs
  // Use uploadImage for image inputs
};
```

### In ChatWidget:
```typescript
// Same hook usage as ChatPanel but with floating widget layout
const { sessions, loadSession, uploadFile, uploadImage, exportChat } = 
  useBrainboxChat(sdk);
```

## Features Available in Hook

```typescript
const {
  messages,              // Array of ChatMessage with timestamps and initials
  loading,              // Loading state during streaming
  error,                // Error message
  sessionId,            // Current session ID
  sessions,             // Array of all sessions grouped by date
  sendMessage,          // Send text message
  sendVoiceNote,        // Send voice blob
  uploadFile,           // Upload file
  uploadImage,          // Upload image
  createSession,        // Create new session
  loadSession,          // Load existing session
  exportChat,           // Export as JSON/PDF
  reset                 // Reset state
} = useBrainboxChat(sdk);
```

## Customization Props Available

```typescript
interface CustomizationProps {
  // Colors
  primaryColor?: string;           // e.g., "#2563EB"
  accentColor?: string;            // e.g., "#111827"
  backgroundColor?: string;        // e.g., "#F8FAFC"

  // Branding
  logoUrl?: string;                // URL to custom logo
  logoText?: string;               // Custom company name

  // Text customization
  headerText?: string;             // Main header text
  sidebarTitle?: string;           // Sidebar title
  newChatButtonText?: string;      // "New Chat" button text
  searchPlaceholder?: string;      // Search box placeholder
  sendButtonText?: string;         // Send button text

  // Features toggle
  showExportButton?: boolean;      // Show export chat button
  showVoiceInput?: boolean;        // Show voice recording
  showFileUpload?: boolean;        // Show file upload
  showImageUpload?: boolean;       // Show image upload
}
```

## Example Usage

```typescript
import { BrainboxReactSDK, ChatPanel } from 'spres-react';

const sdk = new BrainboxReactSDK(
  'http://165.227.77.33:8000',
  'your-api-key',
  'your-tenant-id'
);

<ChatPanel
  sdk={sdk}
  primaryColor="#2563EB"
  accentColor="#111827"
  backgroundColor="#F8FAFC"
  logoUrl="https://your-domain/logo.png"
  logoText="Your Company"
  newChatButtonText="+ New Chat"
  showExportButton={true}
  showVoiceInput={true}
  showFileUpload={true}
  showImageUpload={true}
/>
```

## Remaining Work (Component UI)

The components themselves need to be updated to use these new features. Currently:
- ChatPanel and ChatWidget components exist but need UI updates to display sessions list, file upload buttons, etc.
- Voice recording UI needs to be added
- Export functionality UI needs to be added
- Session loading UI needs to be added

These are component-level changes that would require refactoring the existing React components.

## Testing Checklist

- [ ] Backend endpoints return correct data in Swagger
- [ ] File upload endpoint accepts files
- [ ] Image upload endpoint validates file types
- [ ] Sessions are grouped correctly by date
- [ ] Session messages have proper metadata (timestamps, initials)
- [ ] Ingest pipeline logs show documents being saved
- [ ] SDK builds successfully
- [ ] SDK publishes to NPM
- [ ] Preview app loads with live SDK
- [ ] All hook methods are callable
- [ ] Chat history persists across sessions
