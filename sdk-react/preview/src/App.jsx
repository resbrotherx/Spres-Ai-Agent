import React from 'react';
import { BrainboxReactSDK, ChatPanel, ChatWidget } from '../../dist';

const sdk = new BrainboxReactSDK(
  'http://165.227.77.33:8000/',
  'demo_api_key',
  'demo_tenant'
);

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6'}}>

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
        <ChatPanel
          sdk={sdk}
          position="bottom-right"
          primaryColor="#2563EB"
          accentColor="#111827"
          backgroundColor="#F8FAFC"
          buttonText="Support"
          placeholder="Ask a question..."
          // width="360px"
          // height="520px"
          design="support"
        />
      </div>
    </div>
  );
}
