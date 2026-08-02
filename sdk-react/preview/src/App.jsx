import React from 'react';
import { BrainboxReactSDK, ChatPanel, ChatWidget } from '../../dist';
//import { BrainboxReactSDK, ChatPanel, ChatWidget } from 'spres-react';
const sdk = new BrainboxReactSDK(
  'https://port.smartpowerbilling.com/',
  '603e5575e143fd7e19c2aa208e9e66ca6c3817bc1ad8aec58766ba1ff4dd640b',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpcmVzIiwidXNlcl9pZCI6MSwiZXhwIjoxNzgwNDM1MDQ4fQ.cSDyVXAAQoSXvaxIOEsRHbwoO9PAbCBp5URpfffk-T4'
);

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6'}}>

   
        <ChatWidget
          sdk={sdk}
          position="bottom-right"
          primaryColor="#2563EB"
          //accentColor="#18d72e"
         // backgroundColor="#0c1217"
          buttonText="Ai"
          placeholder="Ask a question..."
          width="360px"
          height="520px"
          defaultOpen = {false}
          design = "Ai"
          logoUrl="https://i.pinimg.com/originals/eb/bd/f7/ebbdf7ce4f7f502d1f28b96b5cbd7a1f.gif"
          logoText = "Smart Power Billing"
          companyName = "Sterling Technologies"
          companyDescription="Ask us anything about your account."
          user={{ name: "Patrick Fra" }}
          launcherType="button"
          launcherGifUrl="https://miro.medium.com/v2/1*9I6EIL5NG20A8se5afVmOg.gif"
         // bot = "void 0,"
          //data = "oppp"
          // manualData = void 0
        />
        <ChatPanel
          sdk={sdk}
          position="bottom-right"
          primaryColor="#0e0e12"
          accentColor="#293756"
          backgroundColor="#f6f7f8"
          buttonText="Support"
          placeholder="Ask a question..."
          width="360px"
          logoUrl="https://i.pinimg.com/originals/eb/bd/f7/ebbdf7ce4f7f502d1f28b96b5cbd7a1f.gif"
          //height="520px"
          //design="support"
          user={{ name: "Sarah Connor", email: "sarah@acme.com" }}
          companyName = "Sterling"
          avatarGifUrl = "https://cdn.dribbble.com/userupload/23400373/file/original-aaa8682220d5fd60c715fce6b52f7f3e.gif"
          showExportButton = {true}
          showFileUpload = {true}
          showImageUpload = {true}
          showVoiceInput = {true}
        />
    </div>
  );
}
