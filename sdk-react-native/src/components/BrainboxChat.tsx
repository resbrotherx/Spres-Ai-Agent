import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle
} from 'react-native';
import { BrainboxClient } from '../client';
import type { BrainboxSearchResult, BrainboxSession, BrainboxStorage, BrainboxUser } from '../types';
import {
  BrainboxChatEventName,
  BrainboxMessage,
  UseBrainboxChatResult,
  parseServerTime,
  useBrainboxChat
} from '../useBrainboxChat';
import { BrainboxThemeOptions, BrainboxTokens, typo, useBrainboxTheme } from '../theme';
import { BrainboxHaptics, triggerHaptic } from '../haptics';
import { BrainboxClipboard, copyText, resolveClipboard } from '../clipboard';
import { safeHref } from '../markdown';
import { BrainboxIcon, BrainboxIconName } from './Icon';
import { BrainboxGradientFill, BrainboxLogo, BrainboxPanelBackground } from './Logo';
import { Markdown } from './Markdown';
import { Appear, Caret, EASE_SHEET, TypingDots, useReducedMotion } from './motion';

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface BrainboxBranding {
  /** Assistant name (default 'Brainbox AI'). Replaces {{botName}}. */
  botName?: string;
  /** Header title (defaults to botName). */
  title?: string;
  /** Header subtitle next to the green status dot (default 'Online'). */
  subtitle?: string;
  /** Custom image for the header and bot avatar instead of the blue orb. */
  logoUrl?: string;
  /** Welcome heading (default 'Hi {{name}}'). */
  greeting?: string;
}

export type BrainboxQuickAction = string | { title: string; description?: string; prompt?: string; icon?: BrainboxIconName };

export interface BrainboxFeatures {
  history?: boolean;
  newChat?: boolean;
  feedback?: boolean;
  copy?: boolean;
  sources?: boolean;
}

/** Connection props (same names as sdk-web / sdk-react). Pass `client` to reuse your own BrainboxClient. */
export interface BrainboxConnectionProps {
  apiUrl?: string;
  apiKey?: string;
  tenantId?: string;
  user?: BrainboxUser;
  headers?: Record<string, string>;
  timeout?: number;
  client?: BrainboxClient;
  /** Stream answers token by token (default true). Falls back to whole answers automatically. */
  streaming?: boolean;
  storage?: BrainboxStorage | null;
  storageKey?: string;
  persistSession?: boolean;
  initialSessionId?: string;
  onEvent?: (name: BrainboxChatEventName, detail: any) => void;
}

export interface BrainboxAppearanceProps {
  theme?: BrainboxThemeOptions;
  branding?: BrainboxBranding;
  /** Welcome text under the greeting. `{{name}}` / `{{botName}}` are replaced. */
  welcomeMessages?: string[];
  quickActions?: BrainboxQuickAction[];
  placeholder?: string;
  /** Tiny haptics on send/receive/error (default true). Pass a function to use expo-haptics etc. */
  haptics?: BrainboxHaptics;
  features?: BrainboxFeatures;
  /** Clipboard for the copy buttons (e.g. expo-clipboard). Default: RN core Clipboard if present; `null` hides copy. */
  clipboard?: BrainboxClipboard | null;
  /** Shows the black close circle in the header. */
  onClose?: () => void;
  /** Shows the paperclip button in the composer and calls this when tapped (wire it to your file picker). */
  onAttach?: () => void;
  /** Wrap in SafeAreaView (default true). */
  safeArea?: boolean;
  keyboardVerticalOffset?: number;
  style?: StyleProp<ViewStyle>;
}

export type BrainboxChatProps = BrainboxConnectionProps & BrainboxAppearanceProps;

export interface BrainboxChatViewProps extends BrainboxAppearanceProps {
  /** Controller from `useBrainboxChat`. */
  chat: UseBrainboxChatResult;
  user?: BrainboxUser;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Build (and memoise) a BrainboxClient from props, or use `props.client`. */
export function useClientFromProps(p: BrainboxConnectionProps): BrainboxClient {
  const headersKey = p.headers ? JSON.stringify(p.headers) : '';
  return useMemo(() => {
    if (p.client) return p.client;
    if (!p.apiUrl) throw new Error('Brainbox: pass `apiUrl` (and `apiKey`) or a `client`.');
    return new BrainboxClient({
      apiUrl: p.apiUrl,
      apiKey: p.apiKey,
      tenantId: p.tenantId,
      user: p.user,
      headers: p.headers,
      timeout: p.timeout,
      streaming: p.streaming
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.client, p.apiUrl, p.apiKey, p.tenantId, p.user?.id, p.user?.name, p.timeout, p.streaming, headersKey]);
}

/** Wrap onEvent with haptics. */
export function useHapticEvents(haptics: BrainboxHaptics | undefined, onEvent?: BrainboxConnectionProps['onEvent']) {
  const ref = useRef({ haptics, onEvent });
  ref.current = { haptics, onEvent };
  return useCallback((name: BrainboxChatEventName, detail: any) => {
    const h = ref.current.haptics ?? true;
    if (name === 'message') triggerHaptic(h, 'send');
    else if (name === 'response') triggerHaptic(h, 'receive');
    else if (name === 'error' && detail?.action === 'chat') triggerHaptic(h, 'error');
    ref.current.onEvent?.(name, detail);
  }, []);
}

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in vars ? vars[k] : ''));
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(d: Date): string {
  const now = new Date();
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  try {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return d.toDateString();
  }
}

function timeLabel(d: Date): string {
  try {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; msg: BrainboxMessage; first: boolean; last: boolean };

const GROUP_MS = 5 * 60 * 1000;

function buildRows(messages: BrainboxMessage[]): Row[] {
  const rows: Row[] = [];
  let prevDate: Date | null = null;
  messages.forEach((m, i) => {
    const d = new Date(m.createdAt);
    if (!prevDate || !sameDay(prevDate, d)) rows.push({ kind: 'day', key: `day-${m.id}`, label: dayLabel(d) });
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const joins = (a?: BrainboxMessage, b?: BrainboxMessage) =>
      !!a && !!b && a.role === b.role && sameDay(new Date(a.createdAt), new Date(b.createdAt)) &&
      Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < GROUP_MS;
    rows.push({ kind: 'msg', key: m.id, msg: m, first: !joins(prev, m), last: !joins(m, next) });
    prevDate = d;
  });
  return rows;
}

function sourceTitle(s: BrainboxSearchResult, i: number): string {
  const md = (s.metadata || {}) as Record<string, any>;
  return String(s.title || md.title || s.source || md.source || md.filename || md.file_name || s.url || md.url || `Source ${i + 1}`);
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

/** 34pt round translucent tool button (composer bar). */
function ToolButton({
  icon, label, onPress, t, active
}: { icon: BrainboxIconName; label: string; onPress: () => void; t: BrainboxTokens; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        { backgroundColor: pressed || active ? t.fillStrong : t.toolBg, transform: [{ scale: pressed ? 0.96 : 1 }] }
      ]}
    >
      <BrainboxIcon name={icon} size={20} strokeWidth={1.8} color={active ? t.accent : t.label} />
    </Pressable>
  );
}

function FooterButton({
  icon, label, onPress, color, filled
}: { icon: BrainboxIconName; label: string; onPress: () => void; color: string; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <BrainboxIcon name={icon} size={15} color={color} filled={filled} />
    </Pressable>
  );
}

/** Omago pill: accent text, hairline accent border, translucent white fill, 32pt tall. */
function Pill({
  label, onPress, t, icon, hint, stretch
}: { label: string; onPress: () => void; t: BrainboxTokens; icon?: BrainboxIconName; hint?: string; stretch?: boolean }) {
  const ty = typo(t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        stretch ? { alignSelf: 'stretch' } : null,
        { borderColor: t.pillBorder, backgroundColor: pressed ? t.fillStrong : t.pillBg, transform: [{ scale: pressed ? 0.97 : 1 }] }
      ]}
    >
      {icon ? <BrainboxIcon name={icon} size={14} color={t.pillText} /> : null}
      <Text style={[ty.pill, { color: t.pillText, marginLeft: icon ? 6 : 0, flexShrink: 1 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function UserAvatar({ user, t, size = 34 }: { user?: BrainboxUser; t: BrainboxTokens; size?: number }) {
  if (user?.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const initial = ((user?.name || '').trim()[0] || 'Y').toUpperCase();
  return (
    <View style={[styles.userAvatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accentTint }]}>
      <Text style={[typo(t).meta, { color: t.pillText }]}>{initial}</Text>
    </View>
  );
}

function Sources({ results, t }: { results: BrainboxSearchResult[]; t: BrainboxTokens }) {
  const [open, setOpen] = useState(false);
  const ty = typo(t);
  const list = results.slice(0, 6);
  return (
    <View style={{ marginTop: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        hitSlop={6}
        style={styles.row}
      >
        <BrainboxIcon name={open ? 'chevronDown' : 'chevronRight'} size={13} color={t.tertiary} />
        <Text style={[ty.caption, { color: t.tertiary, marginLeft: 2 }]}>
          {results.length === 1 ? '1 source' : `${results.length} sources`}
        </Text>
      </Pressable>
      {open ? (
        <View style={[styles.sources, { borderColor: t.pillBorder, backgroundColor: t.botBubble }]}>
          {list.map((s, i) => {
            const md = (s.metadata || {}) as Record<string, any>;
            const href = safeHref(String(s.url || md.url || ''));
            return (
              <Pressable
                key={i}
                disabled={!href}
                onPress={() => href && Linking.openURL(href).catch(() => undefined)}
                style={[styles.sourceRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }]}
              >
                <BrainboxIcon name="file" size={14} color={t.tertiary} />
                <Text numberOfLines={1} style={[ty.caption, { color: href ? t.accent : t.secondary, flex: 1, marginLeft: 6 }]}>
                  {sourceTitle(s, i)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* History sheet                                                       */
/* ------------------------------------------------------------------ */

function HistorySheet({
  chat, t, onClose, reduced
}: { chat: UseBrainboxChatResult; t: BrainboxTokens; onClose: () => void; reduced: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  const [q, setQ] = useState('');
  const ty = typo(t);
  const { refreshSessions } = chat;
  useEffect(() => {
    refreshSessions();
    Animated.timing(v, { toValue: 1, duration: reduced ? 100 : 320, easing: EASE_SHEET, useNativeDriver: true }).start();
  }, [refreshSessions, v, reduced]);

  const sections = useMemo(() => {
    const g = chat.sessions;
    if (!g) return [];
    const needle = q.trim().toLowerCase();
    const f = (list: BrainboxSession[]) =>
      needle ? list.filter((s) => (s.title || '').toLowerCase().includes(needle)) : list;
    return [
      { title: 'Today', data: f(g.today) },
      { title: 'Yesterday', data: f(g.yesterday) },
      { title: 'This week', data: f(g.this_week) },
      { title: 'Older', data: f(g.older) }
    ].filter((s) => s.data.length);
  }, [chat.sessions, q]);

  const animStyle = reduced
    ? { opacity: v }
    : { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.panel }, animStyle]} accessibilityViewIsModal>
      <BrainboxPanelBackground from={t.bodyFrom} to={t.bodyTo} glow={t.bodyGlow} />
      <View style={styles.sheetHeader}>
        <Text style={[ty.title, { color: t.label }]} accessibilityRole="header">Conversations</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
          <Text style={[ty.pill, { color: t.pillText }]}>Done</Text>
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: t.pillBg, borderColor: t.pillBorder }]}>
        <BrainboxIcon name="search" size={16} color={t.tertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={t.tertiary}
          style={[ty.body, styles.searchInput, { color: t.label }]}
          returnKeyType="search"
          accessibilityLabel="Search conversations"
          keyboardAppearance={t.dark ? 'dark' : 'light'}
          selectionColor={t.accent}
        />
      </View>
      {chat.sessionsLoading && !chat.sessions ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={t.accent} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <BrainboxLogo size={56} />
          <Text style={[ty.title, { color: t.label, marginTop: 14 }]}>
            {q ? 'No matches' : 'No conversations yet'}
          </Text>
          <Text style={[ty.footnote, { color: t.secondary, marginTop: 4, textAlign: 'center' }]}>
            {q ? 'Try a different search.' : 'Your past chats will appear here.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => s.session_id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 12 }}
          renderSectionHeader={({ section }) => (
            <Text style={[ty.metaTime, styles.sectionLabel, { color: t.tertiary }]}>{section.title.toUpperCase()}</Text>
          )}
          renderItem={({ item }) => {
            const active = item.session_id === chat.sessionId;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  chat.loadSession(item.session_id);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.sessionRow,
                  {
                    borderColor: active ? t.accent : t.pillBorder,
                    backgroundColor: active ? t.accentTint : pressed ? t.fillStrong : t.pillBg
                  }
                ]}
              >
                <Text numberOfLines={1} style={[ty.pill, { color: active ? t.pillText : t.label, flex: 1 }]}>
                  {item.title || 'Untitled conversation'}
                </Text>
                <Text style={[ty.metaTime, { color: t.tertiary, marginLeft: 8 }]}>
                  {timeLabel(parseServerTime(item.created_at))}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

/** The omago chat UI driven by a `useBrainboxChat` controller. */
export function BrainboxChatView(props: BrainboxChatViewProps) {
  const {
    chat, user, branding = {}, welcomeMessages, quickActions = [], placeholder = 'Message…',
    haptics = true, features = {}, onClose, onAttach, safeArea = true, keyboardVerticalOffset = 0, style
  } = props;
  const t = useBrainboxTheme(props.theme);
  const ty = typo(t);
  const reduced = useReducedMotion();
  const clipboard = useMemo(
    () => (features.copy === false ? null : resolveClipboard(props.clipboard)),
    [features.copy, props.clipboard]
  );
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const mountedAt = useRef(Date.now());

  const botName = branding.botName || 'Brainbox AI';
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';
  const userName = (user?.name || '').trim() || 'You';
  const vars = { name: firstName, botName };
  const greeting = fill(branding.greeting || 'Hi {{name}}', vars);
  const welcome = (welcomeMessages && welcomeMessages.length ? welcomeMessages : ["I'm {{botName}}. How can I help you today?"]).map(
    (w) => fill(w, vars)
  );
  const rows = useMemo(() => buildRows(chat.messages), [chat.messages]);
  const showFeedback = features.feedback !== false;

  const submit = useCallback(
    (text?: string) => {
      const q = (text ?? draft).trim();
      if (!q || chat.sending) return;
      nearBottom.current = true;
      if (text === undefined) setDraft('');
      setHistoryOpen(false);
      chat.send(q);
    },
    [draft, chat]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    nearBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
  };

  const header = (
    <View style={[styles.header, { borderBottomColor: t.headerBorder, backgroundColor: t.headerBg }]}>
      <BrainboxLogo size={38} logoUrl={branding.logoUrl} />
      <View style={styles.headerText}>
        <Text numberOfLines={1} style={[ty.title, { color: t.label }]} accessibilityRole="header">
          {branding.title || botName}
        </Text>
        <View style={[styles.row, { marginTop: 4 }]}>
          <View style={[styles.statusDot, { backgroundColor: t.success }]} />
          <Text numberOfLines={1} style={[ty.subtitle, { color: t.secondary, flexShrink: 1 }]}>
            {chat.sending ? (chat.streaming ? 'Typing…' : 'Thinking…') : branding.subtitle || 'Online'}
          </Text>
        </View>
      </View>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close chat"
          hitSlop={6}
          onPress={onClose}
          style={({ pressed }) => [styles.close, { backgroundColor: t.closeBg, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <BrainboxIcon name="close" size={20} strokeWidth={1.8} color={t.closeIcon} />
        </Pressable>
      ) : null}
    </View>
  );

  const botAvatar = <BrainboxLogo size={34} logoUrl={branding.logoUrl} />;

  // Centred start screen: orb, bot name, greeting + welcome lines, quick-action pills.
  const welcomeView = (
    <ScrollView contentContainerStyle={[styles.messages, styles.start]} keyboardShouldPersistTaps="handled">
      <View style={styles.startInner}>
        <BrainboxLogo size={64} logoUrl={branding.logoUrl} />
        <Text style={[ty.title3, styles.startTitle, { color: t.label }]} numberOfLines={2}>{botName}</Text>
        {[greeting, ...welcome].map((w, i) => (
          <Text key={i} style={[i === 0 ? ty.bodyStrong : ty.body, styles.startText, { color: i === 0 ? t.label : t.secondary }]}>
            {w}
          </Text>
        ))}
        {quickActions.length ? (
            <View style={[styles.pills, styles.startPills]}>
              {quickActions.map((qa, i) => {
                const a = typeof qa === 'string' ? { title: qa } : qa;
                return (
                  <Pill
                    key={i}
                    t={t}
                    label={a.title}
                    icon={a.icon}
                    hint={a.description}
                    onPress={() => submit(a.prompt || a.title)}
                  />
                );
              })}
            </View>
        ) : null}
      </View>
    </ScrollView>
  );

  const renderMessage = (r: Extract<Row, { kind: 'msg' }>) => {
    const m = r.msg;
    const isUser = m.role === 'user';
    const created = new Date(m.createdAt);
    const animate = !m.fromHistory && created.getTime() >= mountedAt.current - 1000;
    const streamingNow = m.status === 'streaming';
    const bubbleRadius = isUser
      ? { borderBottomRightRadius: r.last ? 6 : 14 }
      : { borderBottomLeftRadius: r.last ? 6 : 14 };
    const bubble = (
      <View
        style={[
          styles.bubble,
          bubbleRadius,
          { backgroundColor: isUser ? t.accent : t.botBubble, opacity: isUser && m.status === 'sending' ? 0.85 : 1 }
        ]}
      >
        {streamingNow && !m.text ? (
          <TypingDots color={t.tertiary} reduced={reduced} />
        ) : isUser ? (
          <Text selectable style={[ty.body, { color: t.onAccent }]}>{m.text}</Text>
        ) : (
          <Markdown
            text={m.text}
            tokens={t}
            color={t.botText}
            linkColor={t.accent}
            clipboard={clipboard}
            trailing={streamingNow ? <Caret color={t.accent} /> : undefined}
          />
        )}
      </View>
    );
    const showFooter = !isUser && (m.status === 'done' || m.status === 'stopped' || m.status === 'error') && !!m.text;
    const avatar = <View style={styles.avatarSlot}>{r.first ? (isUser ? <UserAvatar user={user} t={t} /> : botAvatar) : null}</View>;
    return (
      <Appear key={r.key} enabled={animate} reduced={reduced}>
        <View style={[styles.msgRow, isUser ? styles.msgRowUser : null, { marginTop: r.first ? 12 : 4 }]}>
          {!isUser ? avatar : null}
          <View style={[styles.msgCol, isUser ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
            {r.first ? (
              <View style={[styles.row, styles.meta, isUser ? { flexDirection: 'row-reverse' } : null]}>
                <Text style={[ty.meta, { color: t.label, flexShrink: 1 }]} numberOfLines={1}>
                  {isUser ? userName : botName}
                </Text>
                <Text style={[ty.metaTime, { color: t.tertiary, marginHorizontal: 7 }]}>{timeLabel(created)}</Text>
              </View>
            ) : null}
            {bubble}
            {showFooter ? (
              <View style={styles.footer}>
                {m.status === 'stopped' ? <Text style={[ty.caption2, { color: t.tertiary, marginRight: 8 }]}>Stopped</Text> : null}
                {m.status === 'error' ? <Text style={[ty.caption2, { color: t.dangerText, marginRight: 8 }]}>Interrupted</Text> : null}
                {clipboard ? (
                  <FooterButton
                    icon={copiedId === m.id ? 'check' : 'copy'}
                    label="Copy answer"
                    color={copiedId === m.id ? t.successText : t.tertiary}
                    onPress={async () => {
                      if (await copyText(clipboard, m.text)) {
                        triggerHaptic(haptics, 'selection');
                        setCopiedId(m.id);
                        setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500);
                      }
                    }}
                  />
                ) : null}
                {showFeedback && chat.sessionId && m.status === 'done' ? (
                  <>
                    <FooterButton
                      icon="thumbsUp"
                      label="Good answer"
                      filled={m.feedback === 'up'}
                      color={m.feedback === 'up' ? t.accent : t.tertiary}
                      onPress={() => { triggerHaptic(haptics, 'selection'); chat.sendFeedback(m.id, 'up'); }}
                    />
                    <FooterButton
                      icon="thumbsDown"
                      label="Bad answer"
                      filled={m.feedback === 'down'}
                      color={m.feedback === 'down' ? t.accent : t.tertiary}
                      onPress={() => { triggerHaptic(haptics, 'selection'); chat.sendFeedback(m.id, 'down'); }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
            {!isUser && features.sources !== false && m.status === 'done' && m.searchResults && m.searchResults.length ? (
              <Sources results={m.searchResults} t={t} />
            ) : null}
            {isUser && m.status === 'error' ? (
              <Text style={[ty.caption2, { color: t.dangerText, marginTop: 3 }]}>Not delivered</Text>
            ) : null}
          </View>
          {isUser ? avatar : null}
        </View>
      </Appear>
    );
  };

  const body =
    chat.historyLoading && chat.messages.length === 0 ? (
      <View style={styles.center}>
        <ActivityIndicator color={t.accent} />
      </View>
    ) : chat.messages.length === 0 ? (
      welcomeView
    ) : (
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={() => {
          if (nearBottom.current) scrollRef.current?.scrollToEnd({ animated: !reduced });
        }}
        accessibilityLiveRegion="polite"
      >
        {rows.map((r) =>
          r.kind === 'day' ? (
            <Text key={r.key} style={[ty.metaTime, styles.day, { color: t.tertiary }]}>{r.label}</Text>
          ) : (
            renderMessage(r)
          )
        )}
      </ScrollView>
    );

  const canSend = draft.trim().length > 0 && !chat.sending;
  const composer = (
    <View style={styles.composerWrap}>
      <View
        style={[
          styles.composer,
          { backgroundColor: t.composerBg, borderColor: focused ? t.pillBorder : t.composerBorder }
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={t.secondary}
          multiline
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[ty.body, styles.input, { color: t.label }]}
          accessibilityLabel="Message"
          keyboardAppearance={t.dark ? 'dark' : 'light'}
          selectionColor={t.accent}
          textAlignVertical="top"
        />
        <View style={styles.bar}>
          {onAttach ? <ToolButton icon="paperclip" label="Attach file" t={t} onPress={onAttach} /> : null}
          {features.newChat !== false ? (
            <ToolButton icon="newChat" label="New chat" t={t} onPress={() => { setHistoryOpen(false); chat.newChat(); }} />
          ) : null}
          {features.history !== false ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={historyOpen ? 'Back to chat' : 'Conversation history'}
              accessibilityState={{ expanded: historyOpen }}
              onPress={() => setHistoryOpen((v) => !v)}
              style={({ pressed }) => [
                styles.historyPill,
                { backgroundColor: pressed || historyOpen ? t.fillStrong : t.toolBg, transform: [{ scale: pressed ? 0.97 : 1 }] }
              ]}
            >
              <BrainboxIcon name={historyOpen ? 'message' : 'history'} size={18} strokeWidth={2} color={historyOpen ? t.accent : t.label} />
              <Text style={[ty.pill, { color: historyOpen ? t.pillText : t.label, marginLeft: 5 }]}>
                {historyOpen ? 'Back to chat' : 'History'}
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          {chat.sending ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop generating"
              onPress={chat.stop}
              style={({ pressed }) => [styles.sendBtn, { backgroundColor: t.closeBg, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
            >
              <BrainboxIcon name="stop" size={16} color={t.closeIcon} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={() => submit()}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: t.accent, opacity: canSend ? 1 : 0.45, transform: [{ scale: pressed ? 0.96 : 1 }] }
              ]}
            >
              <BrainboxGradientFill light={t.accentLight} mid={t.accent} deep={t.accentDeep} cx="36%" cy="28%" />
              <BrainboxIcon name="send" size={18} strokeWidth={2.1} color={t.onAccent} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  const errorBanner = chat.error ? (
    <View style={[styles.banner, { backgroundColor: t.dangerTint }]} accessibilityLiveRegion="assertive">
      <BrainboxIcon name="alert" size={18} color={t.dangerText} />
      <Text style={[ty.footnote, { color: t.label, flex: 1, marginHorizontal: 8 }]} numberOfLines={3}>
        {chat.error.message}
      </Text>
      {chat.canRetry ? (
        <Pressable accessibilityRole="button" onPress={() => chat.retry()} hitSlop={6} style={styles.retry}>
          <Text style={[ty.footnoteMedium, { color: t.dangerText }]}>Retry</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={chat.clearError} hitSlop={8}>
        <BrainboxIcon name="close" size={16} color={t.secondary} />
      </Pressable>
    </View>
  ) : null;

  const content = (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {header}
      <View style={{ flex: 1 }}>
        <BrainboxPanelBackground from={t.bodyFrom} to={t.bodyTo} glow={t.bodyGlow} />
        <View style={{ flex: 1 }}>
          {body}
          {historyOpen ? <HistorySheet chat={chat} t={t} reduced={reduced} onClose={() => setHistoryOpen(false)} /> : null}
        </View>
        {historyOpen ? null : errorBanner}
        {composer}
      </View>
    </KeyboardAvoidingView>
  );

  const rootStyle = [{ flex: 1, backgroundColor: t.panel }, style];
  return safeArea ? <SafeAreaView style={rootStyle}>{content}</SafeAreaView> : <View style={rootStyle}>{content}</View>;
}

/** Full-screen Brainbox chat (omago design): header, history, streaming answers, feedback, composer. */
export function BrainboxChat(props: BrainboxChatProps) {
  const client = useClientFromProps(props);
  const onEvent = useHapticEvents(props.haptics, props.onEvent);
  const chat = useBrainboxChat(client, {
    streaming: props.streaming,
    storage: props.storage,
    storageKey: props.storageKey,
    persistSession: props.persistSession,
    initialSessionId: props.initialSessionId,
    onEvent
  });
  return <BrainboxChatView {...props} chat={chat} user={props.user || client.user} />;
}

/* No shadows or elevation anywhere: the omago look is flat frosted glass. */
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    padding: 12,
    borderBottomWidth: 1,
    elevation: 0
  },
  headerText: { flex: 1, marginLeft: 10, marginRight: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tool: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  historyPill: { height: 34, borderRadius: 17, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  pills: { flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  start: { justifyContent: 'center' },
  startInner: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 24 },
  startTitle: { marginTop: 14, marginBottom: 6, textAlign: 'center' },
  startText: { textAlign: 'center', maxWidth: 290, marginTop: 4 },
  startPills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%'
  },
  userAvatar: { alignItems: 'center', justifyContent: 'center' },
  messages: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, flexGrow: 1 },
  day: { textAlign: 'center', marginTop: 16, marginBottom: 2 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  avatarSlot: { width: 34, marginHorizontal: 0 },
  msgCol: { maxWidth: '78%', flexShrink: 1, marginHorizontal: 8 },
  meta: { marginBottom: 4 },
  bubble: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 14, elevation: 0 },
  botBubble: { borderBottomLeftRadius: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 2 },
  footerBtn: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center' },
  sources: { marginTop: 4, borderRadius: 12, borderWidth: 1, overflow: 'hidden', alignSelf: 'stretch' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  composer: { minHeight: 88, padding: 10, borderRadius: 17, borderWidth: 1, elevation: 0 },
  input: {
    maxHeight: 120,
    minHeight: 30,
    paddingTop: 2,
    paddingBottom: 6,
    paddingHorizontal: 2
  },
  bar: { flexDirection: 'row', alignItems: 'center' },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    elevation: 0
  },
  retry: { paddingHorizontal: 6, marginRight: 6 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 36
  },
  searchInput: { flex: 1, marginLeft: 6, paddingVertical: 0 },
  sectionLabel: { paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6, letterSpacing: 0.44 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 44,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1
  },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 }
});
