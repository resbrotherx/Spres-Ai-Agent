import React from 'react';
import { BrainboxReactSDK, ChatPanel, ChatWidget } from '../../dist';

const sdk = new BrainboxReactSDK(
  'https://port.smartpowerbilling.com/',
  '603e5575e143fd7e19c2aa208e9e66ca6c3817bc1ad8aec58766ba1ff4dd640b',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpcmVzIiwidXNlcl9pZCI6MSwiZXhwIjoxNzgwNDM1MDQ4fQ.cSDyVXAAQoSXvaxIOEsRHbwoO9PAbCBp5URpfffk-T4'
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
