import React from 'react';
import { BrainboxReactSDK, ChatPanel, ChatWidget } from '../../dist';

const sdk = new BrainboxReactSDK(
  'https://port.smartpowerbilling.com/',
  'nrIotFZODcy7dEucAaHlzbVUgTisn_6VGt8EkakUjC4',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpcmVzIiwidXNlcl9pZCI6MSwiZXhwIjoxNzgwNDM3NDcxfQ.uZ9r_fLKR-IUE6x3qlvrYl1bkYrcqHD6ou7SZuueBhE'
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
