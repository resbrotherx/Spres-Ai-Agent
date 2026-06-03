// @ts-nocheck
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBrainboxChat } from "./useBrainboxChat";

const defaultChatPanelData = {
  brand: {
    name: "Cortex",
    workspaceName: "Cortex",
    greetingName: "Jackson"
  },
  navigation: [
    { icon: "globe", label: "Explore" },
    { icon: "library", label: "Library" },
    { icon: "files", label: "Files" },
    { icon: "history", label: "History" }
  ],
  user: {
    name: "Emerson Sterling",
    email: "sterlingr@gmail.com",
    avatarUrl: ""
  },
  composer: {
    placeholder: "Ask me anything...",
    researchLabel: "Deeper Research",
    savedPromptsLabel: "Saved prompts",
    attachLabel: "Attach file"
  },
  promptCards: [
    {
      icon: "pie",
      title: "Synthesize Data",
      description: "Turn my meeting notes into 5 key bullet points for the team.",
      prompt: "Turn my meeting notes into 5 key bullet points for the team."
    },
    {
      icon: "bulb",
      title: "Creative Brainstorm",
      description: "Generate 3 taglines for a new sustainable fashion brand.",
      prompt: "Generate 3 taglines for a new sustainable fashion brand."
    },
    {
      icon: "gavel",
      title: "Check Facts",
      description: "Compare key differences between GDPR and CCPA.",
      prompt: "Compare key differences between GDPR and CCPA."
    }
  ],
  footer: {
    text: "Join the valerius community for more insights",
    linkText: "Join Discord",
    href: "#"
  }
};

const chatPanelCss = `
.bb-cortex-panel {
  --bb-panel-primary: #0d0d0f;
  --bb-panel-accent: #a882f7;
  --bb-panel-soft: #f8f4ff;
  --bb-panel-bg: #f3f3f5;
  width: 100%;
  min-height: 760px;
  display: flex;
  overflow: hidden;
  border-radius: 20px;
  background: var(--bb-panel-bg);
  color: var(--bb-panel-primary);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0;
}
.bb-cortex-sidebar {
  width: 268px;
  flex: 0 0 268px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 20px;
  background: #f1f1f2;
  border-right: 1px solid #e5e3ea;
  box-sizing: border-box;
  overflow-y: auto;
}
.bb-cortex-brand-row,
.bb-cortex-nav-item,
.bb-cortex-profile,
.bb-cortex-topbar,
.bb-cortex-toolbar-right,
.bb-cortex-chip-row,
.bb-cortex-prompt-card,
.bb-cortex-footer-actions {
  display: flex;
  align-items: center;
}
.bb-cortex-brand-row {
  gap: 12px;
  min-height: 38px;
}
.bb-cortex-brand-name {
  font-size: 20px;
  line-height: 1;
  font-weight: 760;
}
.bb-cortex-sidebar-toggle {
  margin-left: auto;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  color: #1c1c1e;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
}
.bb-cortex-panel button {
  -webkit-tap-highlight-color: transparent;
  transform: translateY(0) scale(1);
  transition:
    transform 120ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    filter 160ms ease;
}
.bb-cortex-panel button:hover {
  filter: brightness(0.98);
}
.bb-cortex-panel button:active {
  transform: translateY(1px) scale(0.96);
  filter: brightness(0.94);
}
.bb-cortex-panel button:focus-visible {
  outline: 2px solid var(--bb-panel-accent);
  outline-offset: 2px;
}
.bb-cortex-logo,
.bb-cortex-small-logo {
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,.95) 0 11%, transparent 12%),
    radial-gradient(circle at 68% 30%, rgba(255,255,255,.9) 0 10%, transparent 11%),
    linear-gradient(135deg, #d8c4ff, #a678f6 58%, #cbb3ff);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.5), 0 8px 18px rgba(163, 111, 244, .25);
}
.bb-cortex-logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  animation: logoWiggle 3s ease-in-out infinite;
}
.bb-cortex-small-logo {
  width: 26px;
  height: 26px;
  border-radius: 9px;
}
.bb-cortex-logo::before,
.bb-cortex-small-logo::before {
  content: "";
  width: 52%;
  height: 52%;
  border-radius: 5px;
  border: 2px solid rgba(255,255,255,.9);
  box-sizing: border-box;
}
.bb-cortex-logo::after,
.bb-cortex-small-logo::after {
  content: "";
  position: absolute;
  width: 4px;
  height: 78%;
  border-radius: 999px;
  background: rgba(255,255,255,.82);
  box-shadow: 0 0 0 999px transparent;
  transform: rotate(90deg);
}
@keyframes logoWiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(2deg); }
  75% { transform: rotate(-2deg); }
}
.bb-cortex-new-chat {
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: #0f0f10;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 580;
  cursor: pointer;
  box-shadow: 0 9px 16px rgba(0,0,0,.08);
}
.bb-cortex-search {
  position: relative;
}
.bb-cortex-search input {
  width: 100%;
  height: 44px;
  box-sizing: border-box;
  border: 1px solid #e8e7eb;
  border-radius: 8px;
  background: rgba(255,255,255,.9);
  padding: 0 42px 0 36px;
  color: #1d1d20;
  font-size: 14px;
  outline: none;
}
.bb-cortex-search svg:first-child {
  position: absolute;
  left: 12px;
  top: 13px;
  color: #a5a5ad;
}
.bb-cortex-command-key {
  position: absolute;
  right: 11px;
  top: 10px;
  color: #a882f7;
}
.bb-cortex-nav {
  display: grid;
  gap: 6px;
}
.bb-cortex-nav-item {
  gap: 10px;
  height: 34px;
  color: #111113;
  font-size: 14px;
  font-weight: 620;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.bb-cortex-sessions {
  border-top: 1px solid #e4e3e8;
  padding-top: 16px;
  display: grid;
  gap: 17px;
  overflow: hidden;
}
.bb-cortex-sessions.is-hidden {
  display: none;
}
// .bb-cortex-session-group {
//   display: grid;
//   gap: 8px;
// }
.bb-cortex-session-label {
  color: #aaa7af;
  font-size: 11px;
  margin-bottom: 9px;

  // font-weight: 600;
  // text-transform: uppercase;
}
.bb-cortex-session-item {
  width: 100%;
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #1c1c1f;
  background: transparent;
  border: 0;
  text-align: left;
  padding: 0;
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.35;
  cursor: pointer;

  // border: 1px solid transparent;
  // line-height: 1.3;
  // border-radius: 6px;
  // transition: all 0.2s;
}
.bb-cortex-session-item:hover {
  background: rgba(255,255,255,.6);
  border-color: #e8e7eb;
}
.bb-cortex-session-item:active {
  background: rgba(168,130,247,.14);
}
.bb-cortex-session-item.active {
  background: var(--bb-panel-accent);
  color: #fff;
  padding:5px;
  border-radius: 4px;

}
.bb-cortex-profile {
  margin-top: auto;
  gap: 10px;
  min-height: 52px;
  padding: 8px;
  border: 1px solid #e6e5ea;
  border-radius: 8px;
  background: rgba(255,255,255,.78);
  box-shadow: 0 10px 24px rgba(17,17,17,.04);
}
.bb-cortex-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  overflow: hidden;
  color: #fff;
  font-size: 13px;
  font-weight: 760;
  background: linear-gradient(135deg, #164b7a, #f6b26b);
}
.bb-cortex-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.bb-cortex-profile-copy {
  min-width: 0;
  flex: 1;
}
.bb-cortex-profile-name {
  font-size: 12px;
  font-weight: 760;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bb-cortex-profile-email {
  color: #8d8b92;
  font-size: 12px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bb-cortex-stage {
  flex: 1;
  padding: 22px;
  min-width: 0;
  min-height: 0; /* important */
  box-sizing: border-box;
}
.bb-cortex-card {
  min-height: 716px;
  height: 100%
  max-height: calc(180vh - 44px);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(17,17,20,.06);
  border: 1px solid #ebe9ef;
  padding: 28px;
  box-sizing: border-box;
  display: flex;
  overflow: hidden;
  flex-direction: column;
}
.bb-cortex-topbar {
  justify-content: space-between;
  gap: 16px;
}
.bb-cortex-workspace-picker,
.bb-cortex-icon-button,
.bb-cortex-export-button,
.bb-cortex-upgrade-button,
.bb-cortex-file-button {
  border: 1px solid #eceaf0;
  background: #fff;
  color: #151518;
  min-height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 680;
  cursor: pointer;
}
.bb-cortex-workspace-picker {
  padding: 0 10px;
}
.bb-cortex-icon-button {
  width: 36px;
  padding: 0;
}
.bb-cortex-toolbar-right {
  gap: 12px;
  margin-left: auto;
}
.bb-cortex-export-button {
  padding: 0 14px;
}
.bb-cortex-export-button:hover {
  background: #f5f5f5;
}
.bb-cortex-upgrade-button {
  padding: 0 18px;
  color: #fff;
  background: #101011;
  border-color: #101011;
}
.bb-cortex-hero {
  width: min(100%, 760px);
  margin: 0 auto;
  text-align: center;
  display: none;
}
.bb-cortex-hero.empty {
  display: block;
  margin-top: 72px;
}
.bb-cortex-orb {
  width: 128px;
  height: 128px;
  margin: 0 auto 8px;
  border-radius: 999px;
  position: relative;
  filter: saturate(1.05);
  background:
    radial-gradient(circle at 35% 26%, rgba(255,255,255,.96) 0 20%, rgba(255,255,255,.2) 40%, transparent 55%),
    radial-gradient(circle at 58% 64%, rgba(154, 106, 242, .75), rgba(190, 158, 255, .18) 54%, transparent 62%),
    conic-gradient(from 20deg, rgba(182, 145, 255,.1), rgba(127, 82, 229,.75), rgba(222,207,255,.65), rgba(136,90,231,.65), rgba(182,145,255,.1));
  box-shadow:
    0 0 34px rgba(167, 122, 247, .42),
    inset 12px 10px 24px rgba(255,255,255,.72),
    inset -16px -18px 28px rgba(126, 81, 223, .34);
}
.bb-cortex-orb::before,
.bb-cortex-orb::after {
  content: "";
  position: absolute;
  inset: 9px;
  border-radius: inherit;
  border: 5px solid rgba(157, 111, 241, .34);
  filter: blur(.5px);
  transform: rotate(-18deg) translate(-3px, 1px);
}
.bb-cortex-orb::after {
  inset: 15px;
  border-color: rgba(255,255,255,.55);
  transform: rotate(28deg) translate(5px, -2px);
}
.bb-cortex-hello {
  margin: 0;
  font-size: clamp(26px, 4vw, 36px);
  line-height: 1.08;
  font-weight: 780;
  color: var(--bb-panel-accent);
}
.bb-cortex-title {
  margin: 0 0 55px;
  font-size: clamp(28px, 4.2vw, 38px);
  line-height: 1.08;
  font-weight: 760;
  color: #050505;
}
.bb-cortex-composer {
  width: min(100%, 748px);
  min-height: 188px;
  margin: 0 auto;
  border-radius: 18px;
  background: #fff;
  border: 4px solid #fbf7ff;
  box-shadow: 0 14px 32px rgba(170, 132, 244, .08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bb-cortex-panel.has-messages .bb-cortex-composer {
  order: 3;
  margin-top: 18px;
  min-height: 132px;
  flex-shrink: 0;
}
.bb-cortex-panel.has-messages .bb-cortex-chatlog {
  order: 2;
  margin-top: 20px;
  max-height: none;
}
.bb-cortex-panel.has-messages .bb-cortex-bottom {
  order: 4;
}
.bb-cortex-composer textarea {
  flex: 1;
  min-height: 78px;
  border: 0;
  resize: none;
  outline: none;
  padding: 18px 18px 8px;
  color: #19191c;
  font-size: 15px;
  font-family: inherit;
  background: transparent;
}
.bb-cortex-composer textarea::placeholder {
  color: #bbb9c1;
}
.bb-cortex-composer-tools {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px 12px;
}
.bb-cortex-chip-row {
  gap: 10px;
  min-width: 0;
}
.bb-cortex-research-chip {
  height: 36px;
  padding: 0 13px;
  color: var(--bb-panel-accent);
  background: #fbf7ff;
  border: 1px solid var(--bb-panel-accent);
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 680;
  cursor: pointer;
}
.bb-cortex-tool-button {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border: 0;
  background: #fbfbfc;
  color: #17171a;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
}
.bb-cortex-tool-button:hover,
.bb-cortex-icon-button:hover,
.bb-cortex-workspace-picker:hover,
.bb-cortex-round-footer:hover {
  background: #f6f3fb;
  border-color: #e2d8f7;
}
.bb-cortex-tool-button input {
  display: none;
}
.bb-cortex-mic-button {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  border: 3px solid #eee3ff;
  cursor: pointer;
  background: radial-gradient(circle at 35% 25%, #f3e8ff, #b087f7 64%, #8e57eb);
  box-shadow: 0 0 0 1px rgba(168,130,247,.25), 0 7px 18px rgba(158,111,238,.25);
}
.bb-cortex-mic-button:hover {
  box-shadow: 0 0 0 3px rgba(168,130,247,.18), 0 9px 22px rgba(158,111,238,.28);
}
.bb-cortex-mic-button.is-recording {
  background: radial-gradient(circle at 35% 25%, #fee2e2, #ef4444 64%, #b91c1c);
  border-color: #fecaca;
  box-shadow: 0 0 0 4px rgba(239,68,68,.18), 0 9px 22px rgba(220,38,38,.25);
}
.bb-cortex-saved-row {
  min-height: 45px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 18px;
  background: #fbf8ff;
  color: #0e0e10;
  font-size: 14px;
  font-weight: 700;
}
.bb-cortex-saved-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.bb-cortex-file-button {
  min-height: 32px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 680;
}
.bb-cortex-prompts {
  width: min(100%, 748px);
  margin: 22px auto 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.bb-cortex-prompt-card {
  min-height: 130px;
  align-items: flex-start;
  flex-direction: column;
  gap: 18px;
  border: 1px solid #f0eef3;
  border-radius: 18px;
  background: #fff;
  color: #0d0d0f;
  text-align: left;
  padding: 19px 18px;
  box-shadow: 0 14px 30px rgba(17,17,20,.04);
  cursor: pointer;
  box-sizing: border-box;
}
.bb-cortex-prompt-card:hover {
  border-color: #e5d9f8;
  box-shadow: 0 16px 34px rgba(126,81,223,.08);
}
.bb-cortex-prompt-card strong {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}
.bb-cortex-prompt-card span {
  display: block;
  color: #b0aeb6;
  font-size: 12px;
  line-height: 1.25;
}
.bb-cortex-chatlog {
  width: min(100%, 748px);
  margin: 20px auto 0;

  display: flex;
  flex-direction: column;
  gap: 12px;

  flex: 1;
  min-height: 0;

  overflow-y: auto;
  overflow-x: hidden;

  padding-right: 6px;

  scroll-behavior: smooth;
}
.bb-cortex-message {
  display: flex;
  gap: 12px;
}
.bb-cortex-message.is-user {
  justify-content: flex-end;
}
.bb-cortex-message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 700;
  background: linear-gradient(135deg, #164b7a, #f6b26b);
  color: #fff;
}
.bb-cortex-message.is-user .bb-cortex-message-avatar {
  background: linear-gradient(135deg, var(--bb-panel-accent), #7f52e5);
}
.bb-cortex-message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 60%;
}
.bb-cortex-message-time {
  font-size: 11px;
  color: #999;
}
.bb-cortex-message-bubble {
  padding: 13px 15px;
  border-radius: 18px 18px 18px 6px;
  background: #f8f5ff;
  color: #242126;
  line-height: 1.5;
  font-size: 14px;
}
.bb-cortex-message.is-user .bb-cortex-message-bubble {
  border-radius: 18px 18px 6px 18px;
  color: #fff;
  background: var(--bb-panel-accent);
}
.bb-cortex-bottom {
  margin-top: auto;
  min-height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
  color: #b4b1ba;
  font-size: 12px;
  flex-shrink: 0;
}
.bb-cortex-bottom a {
  color: var(--bb-panel-accent);
  font-weight: 720;
  text-decoration: underline;
}
.bb-cortex-footer-actions {
  position: absolute;
  right: 0;
  bottom: 0;
  gap: 14px;
}
.bb-cortex-round-footer {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid #eeecef;
  border-radius: 999px;
  background: #fff;
  color: #151518;
  cursor: pointer;
}
.bb-cortex-error {
  width: min(100%, 748px);
  margin: 12px auto 0;
  color: #dc2626;
  font-size: 13px;
  text-align: left;
}
.bb-cortex-recording {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #dc2626;
  animation: pulse 2s infinite;
}
.bb-cortex-recording::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #dc2626;
  animation: pulseDot 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes pulseDot {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
@media (max-width: 980px) {
  .bb-cortex-panel {
    min-height: 720px;
  }
  .bb-cortex-sidebar {
    display: none;
  }
  .bb-cortex-stage {
    padding: 12px;
  }
  .bb-cortex-card {
    padding: 18px;
  }
  .bb-cortex-hero {
    margin-top: 52px;
  }
  .bb-cortex-prompts {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .bb-cortex-toolbar-right .bb-cortex-export-button {
    display: none;
  }
  .bb-cortex-title {
    margin-bottom: 32px;
  }
  .bb-cortex-composer-tools,
  .bb-cortex-saved-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .bb-cortex-footer-actions {
    display: none;
  }
}
`;

function mergeData(base, overrides) {
  if (!overrides) return base;
  const output = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeData(base[key] || {}, value);
    } else if (value !== void 0) {
      output[key] = value;
    }
  });
  return output;
}

function Icon({ name, size = 18, strokeWidth = 1.9 }) {
  const paths = {
    plus: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" }),
    search: /* @__PURE__ */ jsx("path", { d: "m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" }),
    command: /* @__PURE__ */ jsx("path", { d: "M9 9H5.8a2.8 2.8 0 1 1 2.8-2.8V18a2.8 2.8 0 1 1-2.8-2.8H18a2.8 2.8 0 1 1-2.8 2.8V5.8A2.8 2.8 0 1 1 18 8.6H9Z" }),
    globe: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
      /* @__PURE__ */ jsx("path", { d: "M3 12h18M12 3c2.3 2.5 3.4 5.5 3.4 9S14.3 18.5 12 21M12 3c-2.3 2.5-3.4 5.5-3.4 9S9.7 18.5 12 21" })
    ] }),
    library: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M4 19.5V6.8A2.8 2.8 0 0 1 6.8 4H20v14H6.8A2.8 2.8 0 0 0 4 20.8" }),
      /* @__PURE__ */ jsx("path", { d: "M8 4v14" })
    ] }),
    files: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M4 19.5V8.4A2.4 2.4 0 0 1 6.4 6h3.1l2 2H18a2.4 2.4 0 0 1 2.4 2.4v9.1Z" }),
      /* @__PURE__ */ jsx("path", { d: "M4 13h16.4" })
    ] }),
    history: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M4 12a8 8 0 1 0 2.34-5.66" }),
      /* @__PURE__ */ jsx("path", { d: "M4 4v5h5" })
    ] }),
    logout: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M14 8V6a2 2 0 0 0-2-2H5v16h7a2 2 0 0 0 2-2v-2" }),
      /* @__PURE__ */ jsx("path", { d: "M9 12h11M17 9l3 3-3 3" })
    ] }),
    panel: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }),
      /* @__PURE__ */ jsx("path", { d: "M9 4v16M15 10l-2 2 2 2" })
    ] }),
    chevronDown: /* @__PURE__ */ jsx("path", { d: "m7 10 5 5 5-5" }),
    more: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("circle", { cx: "5", cy: "12", r: "1.3" }),
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "1.3" }),
      /* @__PURE__ */ jsx("circle", { cx: "19", cy: "12", r: "1.3" })
    ] }),
    link: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1l-1.6 1.6" }),
      /* @__PURE__ */ jsx("path", { d: "M14 11a5 5 0 0 0-7.1 0L4.1 13.8a5 5 0 0 0 7.1 7.1l1.6-1.6" })
    ] }),
    download: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M12 3v12" }),
      /* @__PURE__ */ jsx("path", { d: "m7 10 5 5 5-5" }),
      /* @__PURE__ */ jsx("path", { d: "M5 21h14" })
    ] }),
    atom: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M12 12h.01" }),
      /* @__PURE__ */ jsx("path", { d: "M17.7 6.3c2.4 2.4 3.3 5.4 2 6.7-1.3 1.3-4.3.4-6.7-2s-3.3-5.4-2-6.7c1.3-1.3 4.3-.4 6.7 2Z" }),
      /* @__PURE__ */ jsx("path", { d: "M6.3 6.3c-2.4 2.4-3.3 5.4-2 6.7 1.3 1.3 4.3.4 6.7-2s3.3-5.4 2-6.7c-1.3-1.3-4.3-.4-6.7 2Z" })
    ] }),
    image: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("rect", { x: "4", y: "5", width: "14", height: "14", rx: "2" }),
      /* @__PURE__ */ jsx("path", { d: "m4 15 4-4 3 3 2-2 5 5" }),
      /* @__PURE__ */ jsx("circle", { cx: "14.5", cy: "9.5", r: "1.4" })
    ] }),
    bulb: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M9 18h6" }),
      /* @__PURE__ */ jsx("path", { d: "M10 22h4" }),
      /* @__PURE__ */ jsx("path", { d: "M8 14a6 6 0 1 1 8 0c-.8.7-1 1.5-1 2H9c0-.5-.2-1.3-1-2Z" })
    ] }),
    settings: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" }),
      /* @__PURE__ */ jsx("path", { d: "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .3 1.7 1.7 0 0 0-.6 1.6V22H9v-.2a1.7 1.7 0 0 0-.6-1.6 1.7 1.7 0 0 0-2-.3l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.4-1.1H3v-4h.2a1.7 1.7 0 0 0 1.4-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2-.3A1.7 1.7 0 0 0 9 2.2V2h6v.2a1.7 1.7 0 0 0 .6 1.6 1.7 1.7 0 0 0 2 .3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.4 1.1h.2v4h-.2a1.7 1.7 0 0 0-1.4 1.1Z" })
    ] }),
    mic: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("rect", { x: "9", y: "3", width: "6", height: "11", rx: "3" }),
      /* @__PURE__ */ jsx("path", { d: "M5 11a7 7 0 0 0 14 0M12 18v3" })
    ] }),
    sparkle: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" }),
      /* @__PURE__ */ jsx("path", { d: "m5 17 .8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8Z" })
    ] }),
    paperclip: /* @__PURE__ */ jsx("path", { d: "m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l8.8-8.8a4 4 0 0 1 5.7 5.7l-8.9 8.8a2 2 0 1 1-2.8-2.8l8.1-8.1" }),
    pie: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M21 12a9 9 0 1 1-9-9v9Z" }),
      /* @__PURE__ */ jsx("path", { d: "M13 3.1A9 9 0 0 1 20.9 11H13Z" })
    ] }),
    gavel: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "m14 13-7 7" }),
      /* @__PURE__ */ jsx("path", { d: "m7 20-3-3 7-7" }),
      /* @__PURE__ */ jsx("path", { d: "m13 3 8 8-3 3-8-8Z" }),
      /* @__PURE__ */ jsx("path", { d: "m8 8 2-2 8 8-2 2Z" })
    ] }),
    language: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "m5 8 6 6" }),
      /* @__PURE__ */ jsx("path", { d: "m4 14 6-6 2-4" }),
      /* @__PURE__ */ jsx("path", { d: "M2 4h12" }),
      /* @__PURE__ */ jsx("path", { d: "M7 2h1" }),
      /* @__PURE__ */ jsx("path", { d: "M22 22 17 10l-5 12" }),
      /* @__PURE__ */ jsx("path", { d: "M14 18h6" })
    ] }),
    question: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
      /* @__PURE__ */ jsx("path", { d: "M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7" }),
      /* @__PURE__ */ jsx("path", { d: "M12 17h.01" })
    ] })
  };
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: paths[name] || paths.question
    }
  );
}

function Avatar({ person }) {
  const initials = ((person == null ? void 0 : person.name) || "AI").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return /* @__PURE__ */ jsx("span", { className: "bb-cortex-avatar", children: (person == null ? void 0 : person.avatarUrl) ? /* @__PURE__ */ jsx("img", { src: person.avatarUrl, alt: "" }) : initials });
}

function formatTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

function PanelMessage({ message }) {
  const isUser = message.role === "user";
  const initials = message.userInitials || (isUser ? "U" : "A");
  return /* @__PURE__ */ jsxs("div", { className: `bb-cortex-message ${isUser ? "is-user" : ""}`, children: [
    /* @__PURE__ */ jsx("div", { className: "bb-cortex-message-avatar", children: initials }),
    /* @__PURE__ */ jsxs("div", { className: "bb-cortex-message-content", children: [
      /* @__PURE__ */ jsx("div", { className: "bb-cortex-message-bubble", children: message.text }),
      /* @__PURE__ */ jsx("div", { className: "bb-cortex-message-time", children: formatTime(message.timestamp) })
    ] })
  ] }, message.id);
}

function ChatPanel({
  sdk,
  primaryColor = "#0d0d0f",
  accentColor = "#a882f7",
  backgroundColor = "#f3f3f5",
  headerText = void 0,
  sidebarTitle = void 0,
  initialSessionId = void 0,
  design = "cortex",
  data = void 0,
  manualData = void 0,
  logoUrl = void 0,
  logoText = void 0,
  newChatButtonText = "New chat",
  showExportButton = true,
  showFileUpload = true,
  showImageUpload = true,
  showVoiceInput = true
}) {
  const {
    messages,
    loading,
    error,
    sendMessage,
    sendVoiceNote,
    createSession,
    loadSession,
    uploadFile,
    uploadImage,
    exportChat,
    sessionId,
    sessions
  } = useBrainboxChat(sdk, initialSessionId);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [voiceError, setVoiceError] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const sdkUser = useMemo(() => sdk.getUserProfile?.(), [sdk]);
  const ui = useMemo(() => {
    const merged = mergeData(defaultChatPanelData, manualData || data);
    return {
      ...merged,
      brand: {
        ...merged.brand,
        name: logoText || merged.brand.name,
        workspaceName: logoText || merged.brand.workspaceName
      },
      user: { ...merged.user, ...(sdkUser || {}) }
    };
  }, [data, logoText, manualData, sdkUser]);

  useEffect(() => {
    var _a;
    (_a = endRef.current) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setVoiceError("");
    await sendMessage(input.trim());
    setInput("");
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadImage(file);
    }
  };

  const startVoiceRecording = async () => {
    setVoiceError("");
    if (!recording) {
      try {
        const canUseMicrophone = typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia;
        if (!canUseMicrophone) {
          const secureHint = typeof window !== "undefined" && !window.isSecureContext
            ? " Microphone recording requires HTTPS or localhost."
            : "";
          throw new Error(`Microphone recording is not available in this browser context.${secureHint}`);
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];

        recorder.onstart = () => setRecording(true);
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          setRecording(false);
          const blob = new Blob(chunks, { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());
          await sendVoiceNote(blob);
        };

        setMediaRecorder(recorder);
        recorder.start();
      } catch (err: any) {
        const message = err?.message || "Microphone access was denied.";
        setRecording(false);
        setVoiceError(message);
        console.error("Microphone access denied:", err);
      }
    } else {
      mediaRecorder?.stop();
    }
  };

  const handleExport = () => {
    exportChat('json');
  };

  const usePrompt = (prompt) => {
    setInput(prompt || "");
  };

  const displayHeader = headerText || `How can I assist you today?`;
  const displaySidebarTitle = sidebarTitle || ui.brand.name;
  const filteredSessions = (sessions || []).filter(session =>
    (session.title || "").toLowerCase().includes(sessionSearch.trim().toLowerCase())
  );
  const sessionGroups = filteredSessions ? {
    today: filteredSessions.filter(s => {
      const date = new Date(s.created_at);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }),
    yesterday: filteredSessions.filter(s => {
      const date = new Date(s.created_at);
      const yesterday = new Date(Date.now() - 86400000);
      return date.toDateString() === yesterday.toDateString();
    }),
    this_week: filteredSessions.filter(s => {
      const date = new Date(s.created_at);
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const week = new Date(Date.now() - 604800000);
      return date >= week && date.toDateString() !== today.toDateString() && date.toDateString() !== yesterday.toDateString();
    }),
    older: filteredSessions.filter(s => {
      const date = new Date(s.created_at);
      const week = new Date(Date.now() - 604800000);
      return date < week;
    })
  } : { today: [], yesterday: [], this_week: [], older: [] };

  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `bb-cortex-panel ${messages.length > 0 ? "has-messages" : ""}`,
      "data-design": design,
      "data-session-id": sessionId || "",
      style: {
        "--bb-panel-primary": primaryColor,
        "--bb-panel-accent": accentColor,
        "--bb-panel-bg": backgroundColor
      },
      children: [
        /* @__PURE__ */ jsx("style", { children: chatPanelCss }),
        /* @__PURE__ */ jsxs("aside", { className: "bb-cortex-sidebar", "aria-label": displaySidebarTitle, children: [
          /* @__PURE__ */ jsxs("div", { className: "bb-cortex-brand-row", children: [
            logoUrl ? /* @__PURE__ */ jsx("img", { src: logoUrl, alt: "", style: { width: "34px", height: "34px", borderRadius: "8px" } }) : /* @__PURE__ */ jsx("span", { className: "bb-cortex-logo", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("div", { className: "bb-cortex-brand-name", children: logoText || ui.brand.name }),
            /* @__PURE__ */ jsx("button", { className: "bb-cortex-sidebar-toggle", type: "button", "aria-label": "Collapse sidebar", children: /* @__PURE__ */ jsx(Icon, { name: "panel", size: 20 }) })
          ] }),
          /* @__PURE__ */ jsxs("button", { className: "bb-cortex-new-chat", type: "button", onClick: () => createSession(newChatButtonText), children: [
            /* @__PURE__ */ jsx(Icon, { name: "plus", size: 18 }),
            newChatButtonText
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "bb-cortex-search", children: [
            /* @__PURE__ */ jsx(Icon, { name: "search", size: 17 }),
            /* @__PURE__ */ jsx("input", { type: "search", value: sessionSearch, onChange: (event) => setSessionSearch(event.target.value), placeholder: "Search", "aria-label": "Search chats" }),
            /* @__PURE__ */ jsx("span", { className: "bb-cortex-command-key", children: /* @__PURE__ */ jsx(Icon, { name: "command", size: 18, strokeWidth: 1.6 }) })
          ] }),
          /* @__PURE__ */ jsx("nav", { className: "bb-cortex-nav", children: ui.navigation.map((item) => /* @__PURE__ */ jsxs("button", { className: "bb-cortex-nav-item", type: "button", onClick: item.icon === "history" ? () => setHistoryOpen(current => !current) : undefined, children: [
            /* @__PURE__ */ jsx(Icon, { name: item.icon, size: 18 }),
            item.label
          ] }, item.label)) }),
          /* @__PURE__ */ jsx("div", { className: `bb-cortex-sessions ${historyOpen ? "" : "is-hidden"}`, children: /* @__PURE__ */ jsxs(Fragment, { children: [
            sessionGroups.today.length > 0 && /* @__PURE__ */ jsxs("div", { className: "bb-cortex-session-group", children: [
              /* @__PURE__ */ jsx("div", { className: "bb-cortex-session-label", children: "Today" }),
              sessionGroups.today.map((session) => /* @__PURE__ */ jsx("button", { className: `bb-cortex-session-item ${session.session_id === sessionId ? "active" : ""}`, type: "button", onClick: () => loadSession(session.session_id), children: session.title }, session.session_id))
            ] }),
            sessionGroups.yesterday.length > 0 && /* @__PURE__ */ jsxs("div", { className: "bb-cortex-session-group", children: [
              /* @__PURE__ */ jsx("div", { className: "bb-cortex-session-label", children: "Yesterday" }),
              sessionGroups.yesterday.map((session) => /* @__PURE__ */ jsx("button", { className: `bb-cortex-session-item ${session.session_id === sessionId ? "active" : ""}`, type: "button", onClick: () => loadSession(session.session_id), children: session.title }, session.session_id))
            ] }),
            sessionGroups.this_week.length > 0 && /* @__PURE__ */ jsxs("div", { className: "bb-cortex-session-group", children: [
              /* @__PURE__ */ jsx("div", { className: "bb-cortex-session-label", children: "This week" }),
              sessionGroups.this_week.map((session) => /* @__PURE__ */ jsx("button", { className: `bb-cortex-session-item ${session.session_id === sessionId ? "active" : ""}`, type: "button", onClick: () => loadSession(session.session_id), children: session.title }, session.session_id))
            ] }),
            sessionGroups.older.length > 0 && /* @__PURE__ */ jsxs("div", { className: "bb-cortex-session-group", children: [
              /* @__PURE__ */ jsx("div", { className: "bb-cortex-session-label", children: "Older" }),
              sessionGroups.older.map((session) => /* @__PURE__ */ jsx("button", { className: `bb-cortex-session-item ${session.session_id === sessionId ? "active" : ""}`, type: "button", onClick: () => loadSession(session.session_id), children: session.title }, session.session_id))
            ] })
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "bb-cortex-profile", children: [
            /* @__PURE__ */ jsx(Avatar, { person: ui.user }),
            /* @__PURE__ */ jsxs("div", { className: "bb-cortex-profile-copy", children: [
              /* @__PURE__ */ jsx("div", { className: "bb-cortex-profile-name", children: ui.user.name }),
              /* @__PURE__ */ jsx("div", { className: "bb-cortex-profile-email", children: ui.user.email })
            ] }),
            /* @__PURE__ */ jsx(Icon, { name: "logout", size: 18 })
          ] })
        ] }),
        /* @__PURE__ */ jsx("main", { className: "bb-cortex-stage", children: /* @__PURE__ */ jsxs("section", { className: "bb-cortex-card", children: [
          /* @__PURE__ */ jsxs("header", { className: "bb-cortex-topbar", children: [
            /* @__PURE__ */ jsxs("button", { className: "bb-cortex-workspace-picker", type: "button", children: [
              /* @__PURE__ */ jsx("span", { className: "bb-cortex-small-logo", "aria-hidden": "true" }),
              ui.brand.workspaceName,
              /* @__PURE__ */ jsx(Icon, { name: "chevronDown", size: 15 })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bb-cortex-toolbar-right", children: [
              /* @__PURE__ */ jsx("button", { className: "bb-cortex-sidebar-toggle", type: "button", "aria-label": "More actions", children: /* @__PURE__ */ jsx(Icon, { name: "more", size: 20 }) }),
              /* @__PURE__ */ jsx("button", { className: "bb-cortex-icon-button", type: "button", "aria-label": "Copy link", children: /* @__PURE__ */ jsx(Icon, { name: "link", size: 18 }) }),
              showExportButton && /* @__PURE__ */ jsxs("button", { className: "bb-cortex-export-button", type: "button", onClick: handleExport, children: [
                /* @__PURE__ */ jsx(Icon, { name: "download", size: 17 }),
                "Export"
              ] }),
              /* @__PURE__ */ jsx("button", { className: "bb-cortex-upgrade-button", type: "button", children: "Upgrade" })
            ] })
          ] }),
          messages.length === 0 && /* @__PURE__ */ jsxs("div", { className: "bb-cortex-hero empty", children: [
            /* @__PURE__ */ jsx("div", { className: "bb-cortex-orb", "aria-hidden": "true" }),
            /* @__PURE__ */ jsxs("h1", { className: "bb-cortex-hello", children: [
              "Hello, ",
              ui.brand.greetingName
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "bb-cortex-title", children: displayHeader })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bb-cortex-composer", children: [
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: input,
                onChange: (event) => setInput(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                },
                placeholder: ui.composer.placeholder
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "bb-cortex-composer-tools", children: [
              /* @__PURE__ */ jsxs("div", { className: "bb-cortex-chip-row", children: [
                /* @__PURE__ */ jsxs("button", { className: "bb-cortex-research-chip", type: "button", children: [
                  /* @__PURE__ */ jsx(Icon, { name: "atom", size: 17 }),
                  ui.composer.researchLabel
                ] }),
                showImageUpload && /* @__PURE__ */ jsxs("button", { className: "bb-cortex-tool-button", type: "button", "aria-label": "Add image", onClick: () => imageInputRef.current?.click(), children: [
                  /* @__PURE__ */ jsx(Icon, { name: "image", size: 18 }),
                  /* @__PURE__ */ jsx("input", { ref: imageInputRef, type: "file", accept: "image/*", onChange: handleImageUpload })
                ] }),
                /* @__PURE__ */ jsx("button", { className: "bb-cortex-tool-button", type: "button", "aria-label": "Ideas", children: /* @__PURE__ */ jsx(Icon, { name: "bulb", size: 18 }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "bb-cortex-chip-row", children: [
                /* @__PURE__ */ jsx("button", { className: "bb-cortex-tool-button", type: "button", "aria-label": "Settings", children: /* @__PURE__ */ jsx(Icon, { name: "settings", size: 18 }) }),
                showFileUpload && /* @__PURE__ */ jsxs("button", { className: "bb-cortex-tool-button", type: "button", "aria-label": "Attach file", onClick: () => fileInputRef.current?.click(), children: [
                  /* @__PURE__ */ jsx(Icon, { name: "paperclip", size: 18 }),
                  /* @__PURE__ */ jsx("input", { ref: fileInputRef, type: "file", onChange: handleFileUpload })
                ] }),
                showVoiceInput && /* @__PURE__ */ jsx("button", { className: `bb-cortex-mic-button ${recording ? "is-recording" : ""}`, type: "button", onClick: startVoiceRecording, "aria-label": recording ? "Stop recording" : "Start recording", children: /* @__PURE__ */ jsx(Icon, { name: "mic", size: 18 }) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bb-cortex-saved-row", children: [
              /* @__PURE__ */ jsxs("span", { className: "bb-cortex-saved-left", children: [
                /* @__PURE__ */ jsx(Icon, { name: "sparkle", size: 18 }),
                recording ? /* @__PURE__ */ jsx("span", { className: "bb-cortex-recording", children: "Recording..." }) : ui.composer.savedPromptsLabel
              ] }),
              /* @__PURE__ */ jsxs("button", { className: "bb-cortex-file-button", type: "button", onClick: handleSend, children: [
                /* @__PURE__ */ jsx(Icon, { name: "paperclip", size: 16 }),
                "Send"
              ] })
            ] })
          ] }),
          messages.length > 0 && /* @__PURE__ */ jsxs("div", { className: "bb-cortex-chatlog", children: [
            messages.map((message) => /* @__PURE__ */ jsx(PanelMessage, { message }, message.id)),
            /* @__PURE__ */ jsx("div", { ref: endRef })
          ] }),
          (error || voiceError) && /* @__PURE__ */ jsx("div", { className: "bb-cortex-error", children: error || voiceError }),
          messages.length === 0 && /* @__PURE__ */ jsx("div", { className: "bb-cortex-prompts", children: ui.promptCards.map((card) => /* @__PURE__ */ jsxs("button", { className: "bb-cortex-prompt-card", type: "button", onClick: () => usePrompt(card.prompt || card.title), children: [
            /* @__PURE__ */ jsx(Icon, { name: card.icon, size: 22 }),
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("strong", { children: card.title }),
              /* @__PURE__ */ jsx("span", { children: card.description })
            ] })
          ] }, card.title)) }),
          messages.length > 0 && /* @__PURE__ */ jsxs("footer", { className: "bb-cortex-bottom", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              ui.footer.text,
              " ",
              /* @__PURE__ */ jsx("a", { href: ui.footer.href, children: ui.footer.linkText })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bb-cortex-footer-actions", children: [
              /* @__PURE__ */ jsx("button", { className: "bb-cortex-round-footer", type: "button", "aria-label": "Translate", children: /* @__PURE__ */ jsx(Icon, { name: "language", size: 18 }) }),
              /* @__PURE__ */ jsx("button", { className: "bb-cortex-round-footer", type: "button", "aria-label": "Help", children: /* @__PURE__ */ jsx(Icon, { name: "question", size: 18 }) })
            ] })
          ] }),
          loading && /* @__PURE__ */ jsx("span", { style: { display: "none" }, children: "Sending..." })
        ] }) })
      ]
    }
  );
}

export {
  ChatPanel,
  defaultChatPanelData
};
