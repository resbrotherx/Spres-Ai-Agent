// @ts-nocheck
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBrainboxChat } from "./useBrainboxChat";
const defaultChatWidgetData = {
  brand: {
    name: "Omago Digital Teammate",
    subtitle: "We help companies provide instant",
    logoUrl: ""
  },
  bot: {
    name: "Omago",
    time: "12:31 Pm",
    avatarUrl: ""
  },
  user: {
    name: "King Mak",
    time: "13:52 Pm",
    avatarUrl: ""
  },
  introMessages: [
    "Hi\u{1F44B} King Mak! We help companies provide instant, accurate, and on-brand responses to their clients 24/7.",
    "Here are a few ways I can assist you right now."
  ],
  quickActions: [
    "Learns your products & policies \u{1F449}",
    "Chat with Omago services \u{1F5E8}"
  ],
  userReply: '"Yes, I am ready to chat with Omega Service."',
  modes: [
    { icon: "chat", label: "Chat" },
    { icon: "voice", label: "Voice" }
  ],
  composer: {
    placeholder: "Type message...",
    searchLabel: "Deep Search"
  }
};
const chatWidgetCss = `
.bb-omago-root {
  --bb-widget-purple: #b93fff;
  --bb-widget-ink: #08080a;
  --bb-widget-panel: #fff8ff;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--bb-widget-ink);
  letter-spacing: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
}
.bb-omago-panel {
  width: 100%;
  height: min(var(--bb-widget-height), calc(100vh - 82px));
  max-height: calc(100vh - 82px);
  min-height: 0;
  border-radius: var(--bb-widget-radius);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  border: var(--bb-widget-border);
  background: var(--bb-widget-panel);
  box-shadow:
    0 34px 90px rgba(82, 35, 108, .24),
    inset 0 0 0 1px rgba(255,255,255,.7);
  box-sizing: border-box;
}
.bb-omago-header {
  min-height: 68px;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, .88);
  background: rgba(255,255,255,.36);
  backdrop-filter: blur(14px);
}
.bb-omago-header-copy {
  min-width: 0;
  flex: 1;
}
.bb-omago-title {
  margin: 0;
  font-size: clamp(15px, 2.2vw, 18px);
  line-height: 1.15;
  font-weight: 820;
  color: #0a0a0d;
  overflow-wrap: anywhere;
}
.bb-omago-subtitle {
  margin-top: 6px;
  color: rgba(9, 9, 12, .54);
  font-size: 11px;
  line-height: 1.25;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bb-omago-logo,
.bb-omago-avatar-logo {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 999px;
  background:
    radial-gradient(circle at 36% 28%, rgba(255,255,255,.95) 0 12%, transparent 13%),
    radial-gradient(circle at 50% 50%, #d987ff 0 14%, #b334ff 42%, #8e31dc 66%, rgba(142,49,220,.05) 71%);
  box-shadow: 0 0 31px rgba(181, 56, 255, .88), inset 0 0 18px rgba(255,255,255,.25);
}
.bb-omago-logo img,
.bb-omago-avatar-logo img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  display: block;
}
.bb-omago-logo {
  width: 38px;
  height: 38px;
}
.bb-omago-avatar-logo {
  width: 34px;
  height: 34px;
}
.bb-omago-logo::before,
.bb-omago-avatar-logo::before {
  content: "";
  width: 17px;
  height: 17px;
  border-radius: 999px;
  background: #fff;
  clip-path: polygon(0 50%, 53% 15%, 100% 0, 100% 100%, 53% 85%);
}
.bb-omago-logo.has-image::before,
.bb-omago-avatar-logo.has-image::before {
  display: none;
}
.bb-omago-close,
.bb-omago-floating-close,
.bb-omago-launcher {
  display: grid;
  place-items: center;
  border: 0;
  color: #fff;
  background: #050506;
  cursor: pointer;
  box-shadow: 0 18px 40px rgba(0,0,0,.22);
}
.bb-omago-root button {
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
.bb-omago-root button:hover {
  filter: brightness(0.98);
}
.bb-omago-root button:active {
  transform: translateY(1px) scale(0.96);
  filter: brightness(0.94);
}
.bb-omago-root button:focus-visible {
  outline: 2px solid var(--bb-widget-purple);
  outline-offset: 2px;
}
.bb-omago-close {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  flex: 0 0 auto;
}
.bb-omago-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 86% 42%, rgba(255,255,255,.7), transparent 30%),
    linear-gradient(180deg, rgba(255,250,255,.7), rgba(249,230,255,.72));
}
.bb-omago-transcript {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.bb-omago-transcript::-webkit-scrollbar {
  width: 7px;
}
.bb-omago-transcript::-webkit-scrollbar-thumb {
  background: rgba(163, 89, 220, .18);
  border-radius: 999px;
}
.bb-omago-assistant {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 9px;
  align-items: start;
}
.bb-omago-author {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 8px 0 8px;
  font-weight: 820;
  font-size: 15px;
  color: #0b0b0f;
}
.bb-omago-author span {
  color: rgba(12, 12, 16, .45);
  font-size: 11px;
  font-weight: 760;
}
.bb-omago-bubble {
  width: fit-content;
  max-width: min(100%, 230px);
  padding: 9px 11px;
  border-radius: 0 14px 14px 14px;
  background: rgba(255,255,255,.92);
  color: rgba(12, 12, 16, .64);
  font-size: 12.5px;
  line-height: 1.45;
  font-weight: 590;
  box-shadow: 0 12px 28px rgba(142, 64, 202, .06);
}
.bb-omago-bubble + .bb-omago-bubble {
  margin-top: 10px;
  border-radius: 14px;
}
.bb-omago-actions {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.bb-omago-action-pill {
  width: fit-content;
  max-width: 100%;
  min-height: 32px;
  padding: 0 11px;
  border: 1px solid rgba(184, 64, 255, .18);
  border-radius: 999px;
  background: rgba(255,255,255,.23);
  color: var(--bb-widget-purple);
  font-size: 12.5px;
  font-weight: 780;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.34);
}
.bb-omago-action-pill:hover,
.bb-omago-mode:hover,
.bb-omago-tool:hover,
.bb-omago-search:hover {
  background: rgba(255,255,255,.42);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.55), 0 8px 20px rgba(156,71,216,.08);
}
.bb-omago-user {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 8px;
  align-items: start;
  margin: 14px 0 12px auto;
  width: min(100%, 244px);
}
.bb-omago-user .bb-omago-author {
  justify-content: flex-end;
  margin-top: 12px;
  margin-bottom: 12px;
}
.bb-omago-user .bb-omago-bubble {
  margin-left: auto;
  border-radius: 22px 0 22px 22px;
}
.bb-omago-person-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 12px;
  font-weight: 820;
  background:
    radial-gradient(circle at 50% 24%, #f7ded0 0 20%, transparent 21%),
    linear-gradient(145deg, #c9b8ad, #9e6f59);
}
.bb-omago-person-avatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.bb-omago-mode-switch {
  align-self: center;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-width: 172px;
  min-height: 38px;
  margin: 0 auto 12px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.72);
  background: rgba(255,255,255,.19);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.42);
}
.bb-omago-mode {
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #0b0b0e;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 760;
  cursor: pointer;
}
.bb-omago-mode.is-active {
  background: rgba(255,255,255,.42);
  box-shadow: 0 10px 30px rgba(156, 71, 216, .08);
}
.bb-omago-live-list {
  display: grid;
  gap: 12px;
}
.bb-omago-live-message {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}
.bb-omago-live-message.is-user {
  grid-template-columns: minmax(0, 1fr) 34px;
}
.bb-omago-live-copy {
  min-width: 0;
}
.bb-omago-live-meta {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin: 0 0 4px;
  color: rgba(12,12,16,.72);
  font-size: 12px;
  font-weight: 800;
}
.bb-omago-live-meta time {
  color: rgba(12,12,16,.42);
  font-size: 10.5px;
  font-weight: 720;
}
.bb-omago-live-message.is-user .bb-omago-live-meta {
  justify-content: flex-end;
}
.bb-omago-live-bubble {
  display: block;
  max-width: min(76%, 230px);
  padding: 8px 10px;
  border-radius: 14px 14px 14px 6px;
  background: rgba(255,255,255,.94);
  color: rgba(12,12,16,.68);
  font-size: 12.5px;
  line-height: 1.45;
}
.bb-omago-live-message.is-user .bb-omago-live-bubble {
  margin-left: auto;
  border-radius: 14px 14px 6px 14px;
  color: #fff;
  background: var(--bb-widget-purple);
}
.bb-omago-file-input {
  display: none;
}
.bb-omago-recording {
  color: #dc2626;
  font-size: 12px;
  font-weight: 760;
  margin-top: 8px;
}
.bb-omago-composer {
  min-height: 88px;
  padding: 10px;
  border-radius: 17px;
  border: 1px solid rgba(255,255,255,.86);
  background: rgba(255,255,255,.18);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.34), 0 14px 35px rgba(128, 54, 180, .05);
  box-sizing: border-box;
}
.bb-omago-composer textarea {
  width: 100%;
  height: 30px;
  padding: 0;
  border: 0;
  outline: 0;
  resize: none;
  color: #0d0d10;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  line-height: 1.3;
  box-sizing: border-box;
}
.bb-omago-composer textarea::placeholder {
  color: rgba(10, 10, 14, .52);
}
.bb-omago-composer-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bb-omago-tool,
.bb-omago-search,
.bb-omago-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  cursor: pointer;
  color: #07070a;
  background: rgba(255,255,255,.25);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.38);
}
.bb-omago-tool {
  width: 34px;
  height: 34px;
  border-radius: 999px;
}
.bb-omago-search {
  height: 34px;
  gap: 5px;
  border-radius: 999px;
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 780;
  white-space: nowrap;
}
.bb-omago-send {
  margin-left: auto;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  color: #fff;
  background: radial-gradient(circle at 36% 28%, #efc3ff, var(--bb-widget-purple) 53%, #8120d2 100%);
  box-shadow: 0 0 30px rgba(181, 57, 255, .78), inset 0 0 13px rgba(255,255,255,.35);
}
.bb-omago-launcher:hover,
.bb-omago-send:hover {
  box-shadow: 0 0 36px rgba(181, 57, 255, .82), 0 16px 38px rgba(92, 28, 135, .24);
}
.bb-omago-error {
  color: #dc2626;
  font-size: 13px;
  margin-top: 10px;
}
.bb-omago-floating-close {
  display: none;
  width: 52px;
  height: 52px;
  border-radius: 999px;
}
.bb-omago-launcher {
  min-width: 104px;
  height: 46px;
  border-radius: 999px;
  padding: 0 15px;
  display: inline-flex;
  gap: 10px;
  font-weight: 760;
  background: radial-gradient(circle at 20% 20%, #efc3ff, var(--bb-widget-purple) 50%, #8120d2 100%);
  box-shadow: 0 0 30px rgba(181, 57, 255, .7), 0 18px 40px rgba(92, 28, 135, .22);
}
@media (max-width: 560px) {
  .bb-omago-root {
    width: calc(100vw - 24px) !important;
  }
  .bb-omago-panel {
    max-height: calc(100vh - 82px);
    border-radius: 20px;
  }
  .bb-omago-header {
    padding: 12px;
    min-height: 64px;
    gap: 9px;
  }
  .bb-omago-logo {
    width: 36px;
    height: 36px;
  }
  .bb-omago-close {
    width: 32px;
    height: 32px;
  }
  .bb-omago-body {
    padding: 10px;
  }
  .bb-omago-assistant {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 8px;
  }
  .bb-omago-avatar-logo {
    width: 32px;
    height: 32px;
  }
  .bb-omago-author {
    font-size: 14px;
  }
  .bb-omago-bubble,
  .bb-omago-action-pill {
    font-size: 12px;
  }
  .bb-omago-mode-switch {
    min-width: 166px;
  }
  .bb-omago-mode {
    font-size: 12.5px;
  }
  .bb-omago-tool {
    width: 32px;
    height: 32px;
  }
  .bb-omago-search {
    height: 32px;
    padding: 0 9px;
    font-size: 12px;
  }
  .bb-omago-send {
    width: 34px;
    height: 34px;
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
function Icon({ name, size = 24, strokeWidth = 2 }) {
  const paths = {
    x: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M18 6 6 18" }),
      /* @__PURE__ */ jsx("path", { d: "m6 6 12 12" })
    ] }),
    paperclip: /* @__PURE__ */ jsx("path", { d: "m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l8.8-8.8a4 4 0 0 1 5.7 5.7l-8.9 8.8a2 2 0 1 1-2.8-2.8l8.1-8.1" }),
    smile: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
      /* @__PURE__ */ jsx("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }),
      /* @__PURE__ */ jsx("path", { d: "M9 9h.01" }),
      /* @__PURE__ */ jsx("path", { d: "M15 9h.01" })
    ] }),
    search: /* @__PURE__ */ jsx("path", { d: "m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" }),
    send: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "m22 2-7 20-4-9-9-4Z" }),
      /* @__PURE__ */ jsx("path", { d: "M22 2 11 13" })
    ] }),
    chat: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M21 12a8 8 0 0 1-8 8H7l-4 3 1.3-5.1A8 8 0 1 1 21 12Z" }),
      /* @__PURE__ */ jsx("path", { d: "m14.5 7.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" })
    ] }),
    voice: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("rect", { x: "4", y: "9", width: "4", height: "6", rx: "2" }),
      /* @__PURE__ */ jsx("rect", { x: "10", y: "5", width: "4", height: "14", rx: "2" }),
      /* @__PURE__ */ jsx("rect", { x: "16", y: "11", width: "4", height: "4", rx: "2" }),
      /* @__PURE__ */ jsx("path", { d: "m18.5 4 .7 1.7 1.8.8-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.8Z" })
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
      children: paths[name] || paths.chat
    }
  );
}
function PersonAvatar({ person }) {
  const initials = ((person == null ? void 0 : person.name) || "KM").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return /* @__PURE__ */ jsx("span", { className: "bb-omago-person-avatar", children: (person == null ? void 0 : person.avatarUrl) ? /* @__PURE__ */ jsx("img", { src: person.avatarUrl, alt: "" }) : initials });
}
function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}
function ManualTranscript({ ui, onQuickAction }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "bb-omago-assistant", children: [
      /* @__PURE__ */ jsx("span", { className: "bb-omago-avatar-logo", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { className: "bb-omago-author", children: [
          ui.bot.name,
          /* @__PURE__ */ jsx("span", { children: ui.bot.time })
        ] }),
        ui.introMessages.map((message) => /* @__PURE__ */ jsx("div", { className: "bb-omago-bubble", children: message }, message)),
        /* @__PURE__ */ jsx("div", { className: "bb-omago-actions", children: ui.quickActions.map((action) => /* @__PURE__ */ jsx("button", { className: "bb-omago-action-pill", type: "button", onClick: () => onQuickAction(action), children: action }, action)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "bb-omago-user", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { className: "bb-omago-author", children: [
          ui.user.name,
          /* @__PURE__ */ jsx("span", { children: ui.user.time })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bb-omago-bubble", children: ui.userReply })
      ] }),
      /* @__PURE__ */ jsx(PersonAvatar, { person: ui.user })
    ] })
  ] });
}
function LiveTranscript({ messages, ui }) {
  return /* @__PURE__ */ jsx("div", { className: "bb-omago-live-list", children: messages.map((message) => {
    const isUser = message.role === "user";
    const person = isUser ? ui.user : ui.bot;
    const avatar = /* @__PURE__ */ jsx(PersonAvatar, { person });
    const copy = /* @__PURE__ */ jsxs("div", { className: "bb-omago-live-copy", children: [
      /* @__PURE__ */ jsxs("div", { className: "bb-omago-live-meta", children: [
        isUser ? (ui.user.name || "You") : (ui.bot.name || "AI Agent"),
        /* @__PURE__ */ jsx("time", { children: formatTime(message.timestamp) })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "bb-omago-live-bubble", children: message.text })
    ] });
    return /* @__PURE__ */ jsxs("div", { className: `bb-omago-live-message ${isUser ? "is-user" : ""}`, children: isUser ? [copy, avatar] : [avatar, copy] }, message.id);
  }) });
}
function ChatWidget({
  sdk,
  position = "bottom-right",
  primaryColor = "#b93fff",
  accentColor = "#08080a",
  backgroundColor = "#fbf1ff",
  buttonText = "Chat",
  placeholder = void 0,
  width = "320px",
  height = "480px",
  borderRadius = "22px",
  border = "2px solid rgba(255, 255, 255, .82)",
  defaultOpen = false,
  design = "omago",
  logoUrl = void 0,
  logoText = void 0,
  user = void 0,
  bot = void 0,
  data = void 0,
  manualData = void 0
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("chat");
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [voiceError, setVoiceError] = useState("");
  const { messages, loading, error, sendMessage, sendVoiceNote, uploadFile } = useBrainboxChat(sdk);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const sdkUser = useMemo(() => sdk.getUserProfile?.(), [sdk]);
  const ui = useMemo(() => {
    const merged = mergeData(defaultChatWidgetData, manualData || data);
    return {
      ...merged,
      brand: {
        ...merged.brand,
        name: logoText || merged.brand.name,
        logoUrl: logoUrl || merged.brand.logoUrl
      },
      bot: { ...merged.bot, ...(bot || {}) },
      user: { ...merged.user, ...(sdkUser || {}), ...(user || {}) }
    };
  }, [bot, data, logoText, logoUrl, manualData, sdkUser, user]);
  const positionStyle = useMemo(() => {
    const base = {
      position: "fixed",
      zIndex: 9999,
      width,
      maxWidth: `min(${width}, calc(100vw - 28px))`
    };
    if (position.includes("bottom")) base.bottom = "24px";
    if (position.includes("top")) base.top = "24px";
    if (position.includes("right")) base.right = "24px";
    if (position.includes("left")) base.left = "24px";
    if (position === "center") {
      base.left = "50%";
      base.transform = "translateX(-50%)";
      base.bottom = "24px";
    }
    return base;
  }, [position, width]);
  useEffect(() => {
    var _a;
    if (messages.length > 0) {
      (_a = endRef.current) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);
  const handleSend = async () => {
    if (!input.trim()) return;
    setVoiceError("");
    await sendMessage(input.trim());
    setInput("");
  };
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadFile(file);
      event.target.value = "";
    }
  };
  const handleVoice = async () => {
    setVoiceError("");
    if (recording) {
      mediaRecorder?.stop();
      return;
    }
    try {
      const canUseMicrophone = typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia;
      if (!canUseMicrophone) {
        const secureHint = typeof window !== "undefined" && !window.isSecureContext ? " Microphone recording requires HTTPS or localhost." : "";
        throw new Error(`Microphone recording is not available in this browser context.${secureHint}`);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.onstart = () => setRecording(true);
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach(track => track.stop());
        await sendVoiceNote(new Blob(chunks, { type: 'audio/webm' }));
      };
      setMediaRecorder(recorder);
      recorder.start();
    } catch (err) {
      setRecording(false);
      setVoiceError(err?.message || "Microphone access was denied.");
    }
  };
  const fillComposer = (value) => {
    setInput(value.replace(/\\u\\{[0-9A-Fa-f]+\\}/g, "").trim());
  };
  const composerPlaceholder = placeholder || ui.composer.placeholder;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "bb-omago-root",
      "data-design": design,
      style: {
        ...positionStyle,
        "--bb-widget-purple": primaryColor,
        "--bb-widget-ink": accentColor,
        "--bb-widget-panel": backgroundColor,
        "--bb-widget-radius": borderRadius,
        "--bb-widget-border": border,
        "--bb-widget-height": height
      },
      children: [
        /* @__PURE__ */ jsx("style", { children: chatWidgetCss }),
        open ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("section", { className: "bb-omago-panel", "aria-label": ui.brand.name, children: [
            /* @__PURE__ */ jsxs("header", { className: "bb-omago-header", children: [
              /* @__PURE__ */ jsx("span", { className: `bb-omago-logo ${ui.brand.logoUrl ? "has-image" : ""}`, "aria-hidden": "true", children: ui.brand.logoUrl ? /* @__PURE__ */ jsx("img", { src: ui.brand.logoUrl, alt: "" }) : null }),
              /* @__PURE__ */ jsxs("div", { className: "bb-omago-header-copy", children: [
                /* @__PURE__ */ jsx("h2", { className: "bb-omago-title", children: ui.brand.name }),
                /* @__PURE__ */ jsx("div", { className: "bb-omago-subtitle", children: ui.brand.subtitle })
              ] }),
              /* @__PURE__ */ jsx("button", { className: "bb-omago-close", type: "button", onClick: () => setOpen(false), "aria-label": "Close chat", children: /* @__PURE__ */ jsx(Icon, { name: "x", size: 22, strokeWidth: 1.8 }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bb-omago-body", children: [
              /* @__PURE__ */ jsxs("div", { className: "bb-omago-transcript", children: [
                messages.length > 0 ? /* @__PURE__ */ jsx(LiveTranscript, { messages, ui }) : /* @__PURE__ */ jsx(ManualTranscript, { ui, onQuickAction: fillComposer }),
                /* @__PURE__ */ jsx("div", { ref: endRef })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "bb-omago-mode-switch", role: "tablist", "aria-label": "Conversation mode", children: ui.modes.map((item) => /* @__PURE__ */ jsxs("button", { className: `bb-omago-mode ${mode === item.icon ? "is-active" : ""}`, type: "button", onClick: () => setMode(item.icon), children: [
                /* @__PURE__ */ jsx(Icon, { name: item.icon, size: 20, strokeWidth: 1.9 }),
                item.label
              ] }, item.label)) }),
              /* @__PURE__ */ jsxs("div", { className: "bb-omago-composer", children: [
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
                    placeholder: mode === "voice" ? "Voice mode ready..." : composerPlaceholder
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "bb-omago-composer-bar", children: [
                  /* @__PURE__ */ jsxs("button", { className: "bb-omago-tool", type: "button", onClick: () => fileInputRef.current?.click(), "aria-label": "Attach file", children: [
                    /* @__PURE__ */ jsx(Icon, { name: "paperclip", size: 22, strokeWidth: 1.8 }),
                    /* @__PURE__ */ jsx("input", { ref: fileInputRef, className: "bb-omago-file-input", type: "file", onChange: handleFileSelect })
                  ] }),
                  /* @__PURE__ */ jsx("button", { className: "bb-omago-tool", type: "button", "aria-label": "Emoji", children: /* @__PURE__ */ jsx(Icon, { name: "smile", size: 22, strokeWidth: 1.8 }) }),
                  /* @__PURE__ */ jsxs("button", { className: "bb-omago-search", type: "button", children: [
                    /* @__PURE__ */ jsx(Icon, { name: "search", size: 21, strokeWidth: 2.2 }),
                    ui.composer.searchLabel
                  ] }),
                  /* @__PURE__ */ jsx("button", { className: "bb-omago-send", type: "button", onClick: mode === "voice" ? handleVoice : handleSend, "aria-label": mode === "voice" ? recording ? "Stop recording" : "Record voice note" : "Send message", children: /* @__PURE__ */ jsx(Icon, { name: mode === "voice" ? "voice" : "send", size: 22, strokeWidth: 2.1 }) })
                ] }),
                recording && /* @__PURE__ */ jsx("div", { className: "bb-omago-recording", children: "Recording..." }),
                (error || voiceError) && /* @__PURE__ */ jsx("div", { className: "bb-omago-error", children: error || voiceError }),
                loading && /* @__PURE__ */ jsx("span", { style: { display: "none" }, children: "Sending..." })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "bb-omago-floating-close", type: "button", onClick: () => setOpen(false), "aria-label": "Close chat", children: /* @__PURE__ */ jsx(Icon, { name: "x", size: 28, strokeWidth: 1.7 }) })
        ] }) : /* @__PURE__ */ jsxs("button", { className: "bb-omago-launcher", type: "button", onClick: () => setOpen(true), "aria-label": "Open chat", children: [
          /* @__PURE__ */ jsx(Icon, { name: "chat", size: 22 }),
          buttonText
        ] })
      ]
    }
  );
}
export {
  ChatWidget,
  defaultChatWidgetData
};
