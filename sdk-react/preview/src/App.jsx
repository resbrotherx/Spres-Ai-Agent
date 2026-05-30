import React from 'react';
import { BrainboxReactSDK, ChatPanel, ChatWidget } from 'spres-react';

const sdk = new BrainboxReactSDK(
  'https://demo.brainbox.example',
  'demo_api_key',
  'demo_tenant'
);

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '24px' }}>
      <h1 style={{ marginBottom: '16px' }}>Brainbox React SDK Preview</h1>
      <p>Preview the chat widget design. The backend URL is a placeholder, so chat will fail unless your backend is running.</p>
      <div style={{ marginTop: '24px' }}>
        <ChatWidget
          sdk={sdk}
          position="bottom-right"
          primaryColor="#2563EB"
          accentColor="#111827"
          backgroundColor="#F8FAFC"
          buttonText="Support"
          placeholder="Ask a question..."
          width="360px"
          height="520px"
          design="support"
        />
        <ChatPanel/>
      </div>
    </div>
  );
}
