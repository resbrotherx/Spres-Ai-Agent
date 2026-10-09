import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
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
import { BrainboxLogo } from './Logo';
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
  /** Custom image for the header and bot avatar instead of the Brainbox logo. */
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
  /** Shows a close button in the header. */
  onClose?: () => void;
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

function IconButton({
  icon, label, onPress, t, active
}: { icon: BrainboxIconName; label: string; onPress: () => void; t: BrainboxTokens; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: pressed || active ? t.fill : 'transparent', transform: [{ scale: pressed ? 0.97 : 1 }] }
      ]}
    >
      <BrainboxIcon name={icon} size={20} color={active ? t.accent : t.secondary} />
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
        <View style={[styles.sources, { borderColor: t.separator, backgroundColor: t.surface2 }]}>
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
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.surface }, animStyle]} accessibilityViewIsModal>
      <View style={[styles.sheetHeader, { borderBottomColor: t.separator }]}>
        <Text style={[ty.headline, { color: t.label }]} accessibilityRole="header">Conversations</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
          <Text style={[ty.body, { color: t.accent, fontWeight: '500' }]}>Done</Text>
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: t.fill }]}>
        <BrainboxIcon name="search" size={16} color={t.tertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={t.tertiary}
          style={[ty.body, styles.searchInput, { color: t.label }]}
          returnKeyType="search"
          accessibilityLabel="Search conversations"
        />
      </View>
      {chat.sessionsLoading && !chat.sessions ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={t.tertiary} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: t.accentTint }]}>
            <BrainboxIcon name="message" size={32} color={t.accent} />
          </View>
          <Text style={[ty.headline, { color: t.label, marginTop: 14 }]}>
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
          contentContainerStyle={{ paddingBottom: 24 }}
          renderSectionHeader={({ section }) => (
            <Text style={[ty.caption2, styles.sectionLabel, { color: t.secondary }]}>{section.title.toUpperCase()}</Text>
          )}
          renderItem={({ item }) => {
            const active = item.session_id === chat.sessionId;
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  chat.loadSession(item.session_id);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.sessionRow,
                  { backgroundColor: active ? t.accentTint : pressed ? t.fill : 'transparent' }
                ]}
              >
                <Text numberOfLines={1} style={[ty.body, { color: t.label, flex: 1 }]}>
                  {item.title || 'Untitled conversation'}
                </Text>
                <Text style={[ty.caption, { color: t.tertiary, marginLeft: 8 }]}>
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

/** The chat UI driven by a `useBrainboxChat` controller. */
export function BrainboxChatView(props: BrainboxChatViewProps) {
  const {
    chat, user, branding = {}, welcomeMessages, quickActions = [], placeholder = 'Message…',
    haptics = true, features = {}, onClose, safeArea = true, keyboardVerticalOffset = 0, style
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
      chat.send(q);
    },
    [draft, chat]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    nearBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
  };

  const header = (
    <View style={[styles.header, { borderBottomColor: t.separator, backgroundColor: t.surface }]}>
      <BrainboxLogo size={32} logoUrl={branding.logoUrl} />
      <View style={styles.headerText}>
        <Text numberOfLines={1} style={[ty.bodyStrong, { color: t.label }]} accessibilityRole="header">
          {branding.title || botName}
        </Text>
        <View style={styles.row}>
          <View style={[styles.statusDot, { backgroundColor: t.success }]} />
          <Text numberOfLines={1} style={[ty.caption, { color: t.secondary }]}>
            {chat.sending ? (chat.streaming ? 'Typing…' : 'Thinking…') : branding.subtitle || 'Online'}
          </Text>
        </View>
      </View>
      {features.newChat !== false ? (
        <IconButton icon="newChat" label="New chat" t={t} onPress={() => { setHistoryOpen(false); chat.newChat(); }} />
      ) : null}
      {features.history !== false ? (
        <IconButton icon="history" label="Conversation history" t={t} active={historyOpen} onPress={() => setHistoryOpen((v) => !v)} />
      ) : null}
      {onClose ? <IconButton icon="close" label="Close chat" t={t} onPress={onClose} /> : null}
    </View>
  );

  const welcomeView = (
    <ScrollView contentContainerStyle={styles.welcome} keyboardShouldPersistTaps="handled">
      <BrainboxLogo size={56} logoUrl={branding.logoUrl} />
      <Text style={[ty.title3, { color: t.label, marginTop: 16, textAlign: 'center' }]}>{greeting}</Text>
      {welcome.map((w, i) => (
        <Text key={i} style={[ty.body, { color: t.secondary, marginTop: 6, textAlign: 'center' }]}>{w}</Text>
      ))}
      {quickActions.length ? (
        <View style={styles.chips}>
          {quickActions.map((qa, i) => {
            const a = typeof qa === 'string' ? { title: qa } : qa;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityHint={a.description}
                onPress={() => submit(a.prompt || a.title)}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: pressed ? t.fillStrong : t.fill, transform: [{ scale: pressed ? 0.97 : 1 }] }
                ]}
              >
                <BrainboxIcon name={a.icon || 'sparkles'} size={14} color={t.accent} />
                <Text style={[ty.footnoteMedium, { color: t.label, marginLeft: 6 }]} numberOfLines={1}>
                  {a.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );

  const renderMessage = (r: Extract<Row, { kind: 'msg' }>) => {
    const m = r.msg;
    const isUser = m.role === 'user';
    const created = new Date(m.createdAt);
    const animate = !m.fromHistory && created.getTime() >= mountedAt.current - 1000;
    const streamingNow = m.status === 'streaming';
    const bubbleRadius = isUser
      ? { borderBottomRightRadius: r.last ? 6 : 18, borderTopRightRadius: r.first ? 18 : 6 }
      : { borderBottomLeftRadius: r.last ? 6 : 18, borderTopLeftRadius: r.first ? 18 : 6 };
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
            color={t.label}
            linkColor={t.accent}
            clipboard={clipboard}
            trailing={streamingNow ? <Caret color={t.tertiary} /> : undefined}
          />
        )}
      </View>
    );
    const showFooter = !isUser && (m.status === 'done' || m.status === 'stopped' || m.status === 'error') && !!m.text;
    return (
      <Appear key={r.key} enabled={animate} reduced={reduced}>
        <View style={[styles.msgRow, isUser ? styles.msgRowUser : null, { marginTop: r.first ? 12 : 2 }]}>
          {!isUser ? (
            <View style={styles.avatarSlot}>{r.last ? <BrainboxLogo size={28} logoUrl={branding.logoUrl} /> : null}</View>
          ) : null}
          <View style={[styles.msgCol, isUser ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
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
                {r.last ? <Text style={[ty.caption2, { color: t.tertiary, marginLeft: 6 }]}>{timeLabel(created)}</Text> : null}
              </View>
            ) : null}
            {!isUser && features.sources !== false && m.status === 'done' && m.searchResults && m.searchResults.length ? (
              <Sources results={m.searchResults} t={t} />
            ) : null}
            {isUser && r.last ? (
              <Text style={[ty.caption2, { color: m.status === 'error' ? t.dangerText : t.tertiary, marginTop: 3 }]}>
                {m.status === 'error' ? 'Not delivered' : timeLabel(created)}
              </Text>
            ) : null}
          </View>
        </View>
      </Appear>
    );
  };

  const body =
    chat.historyLoading && chat.messages.length === 0 ? (
      <View style={styles.center}>
        <ActivityIndicator color={t.tertiary} />
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
            <Text key={r.key} style={[ty.caption2, styles.day, { color: t.tertiary }]}>{r.label}</Text>
          ) : (
            renderMessage(r)
          )
        )}
      </ScrollView>
    );

  const canSend = draft.trim().length > 0 && !chat.sending;
  const composer = (
    <View style={[styles.composerWrap, { backgroundColor: t.surface }]}>
      <View
        style={[
          styles.capsule,
          {
            backgroundColor: focused ? t.surface : t.fill,
            borderColor: focused ? t.accentTint : 'transparent'
          }
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={t.tertiary}
          multiline
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[ty.body, styles.input, { color: t.label }]}
          accessibilityLabel="Message"
          keyboardAppearance={t.dark ? 'dark' : 'light'}
          selectionColor={t.accent}
          textAlignVertical="center"
        />
        {chat.sending ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop generating"
            onPress={chat.stop}
            style={({ pressed }) => [styles.sendBtn, { backgroundColor: t.label, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <BrainboxIcon name="stop" size={16} color={t.surface} />
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
              { backgroundColor: canSend ? (pressed ? t.accentPressed : t.accent) : t.fillStrong, transform: [{ scale: pressed ? 0.97 : 1 }] }
            ]}
          >
            <BrainboxIcon name="arrowUp" size={18} strokeWidth={2.2} color={canSend ? t.onAccent : t.quaternary} />
          </Pressable>
        )}
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
        {body}
        {historyOpen ? <HistorySheet chat={chat} t={t} reduced={reduced} onClose={() => setHistoryOpen(false)} /> : null}
      </View>
      {historyOpen ? null : errorBanner}
      {historyOpen ? null : composer}
    </KeyboardAvoidingView>
  );

  const rootStyle = [{ flex: 1, backgroundColor: t.surface }, style];
  return safeArea ? <SafeAreaView style={rootStyle}>{content}</SafeAreaView> : <View style={rootStyle}>{content}</View>;
}

/** Full-screen Brainbox chat: header, history, streaming answers, feedback, composer. */
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4
  },
  headerText: { flex: 1, marginLeft: 8, marginRight: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  welcome: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, height: 34, maxWidth: '100%' },
  messages: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  day: { textAlign: 'center', marginTop: 16, marginBottom: 2, fontWeight: '500' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  avatarSlot: { width: 28, marginRight: 8, alignSelf: 'flex-start', justifyContent: 'flex-end', minHeight: 28 },
  msgCol: { maxWidth: '78%', flexShrink: 1 },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 2 },
  footerBtn: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center' },
  sources: { marginTop: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignSelf: 'stretch' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  capsule: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 20,
    borderWidth: 3,
    paddingLeft: 11,
    paddingRight: 3,
    paddingVertical: 1,
    minHeight: 46
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 38,
    paddingTop: Platform.OS === 'ios' ? 9 : 6,
    paddingBottom: Platform.OS === 'ios' ? 9 : 6,
    paddingHorizontal: 0
  },
  sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 6, marginBottom: 3 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12
  },
  retry: { paddingHorizontal: 6, marginRight: 6 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  search: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 10, paddingHorizontal: 10, height: 36 },
  searchInput: { flex: 1, marginLeft: 6, paddingVertical: 0 },
  sectionLabel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, fontWeight: '500', letterSpacing: 0.44 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 44, marginHorizontal: 8, borderRadius: 10 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' }
});
