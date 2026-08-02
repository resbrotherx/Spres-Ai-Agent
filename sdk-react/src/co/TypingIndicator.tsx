import React from "react";

export function TypingIndicator({ label = "Thinking..." }) {
  return (
    <>
      <style>{`
        .bb-typing { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          padding: 6px 2px; 
          font-size: 12.5px; 
          color: #8a8a9a; 
        }
        .bb-typing-dots { 
          display: inline-flex; 
          gap: 3px; 
        }
        .bb-typing-dots i { 
          width: 6px; 
          height: 6px; 
          border-radius: 999px; 
          background: currentColor; 
          opacity: .35; 
          animation: bbTypingPulse 1.1s ease-in-out infinite; 
        }
        .bb-typing-dots i:nth-child(2) { 
          animation-delay: .15s; 
        }
        .bb-typing-dots i:nth-child(3) { 
          animation-delay: .3s; 
        }
        @keyframes bbTypingPulse { 
          0%, 80%, 100% { 
            opacity: .25; 
            transform: scale(0.85); 
          } 
          40% { 
            opacity: 1; 
            transform: scale(1); 
          } 
        }
      `}</style>

      <div className="bb-typing">
        <span className="bb-typing-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="bb-typing-label">{label}</span>
      </div>
    </>
  );
}
