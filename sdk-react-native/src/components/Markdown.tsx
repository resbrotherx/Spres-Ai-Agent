import React, { ReactNode, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import { MdBlock, MdInline, parseMarkdown, safeHref } from '../markdown';
import type { BrainboxTokens } from '../theme';
import { typo } from '../theme';
import { BrainboxClipboard, copyText } from '../clipboard';
import { BrainboxIcon } from './Icon';

export interface MarkdownProps {
  text: string;
  tokens: BrainboxTokens;
  /** Text colour (bubble foreground). */
  color: string;
  linkColor: string;
  /** Rendered inline at the end of the last paragraph/list item (e.g. the streaming caret). */
  trailing?: ReactNode;
  clipboard?: BrainboxClipboard | null;
  /** On a coloured (user) bubble: inline code uses a translucent white fill. */
  inverted?: boolean;
}

function openLink(href: string) {
  const safe = safeHref(href);
  if (safe) Linking.openURL(safe).catch(() => undefined);
}

function renderInline(nodes: MdInline[], p: MarkdownProps, keyPrefix: string): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    switch (n.type) {
      case 'text':
        return n.text;
      case 'code':
        return (
          <Text
            key={key}
            style={{
              fontFamily: p.tokens.mono,
              fontSize: 13,
              backgroundColor: p.inverted ? 'rgba(255,255,255,0.2)' : p.tokens.fillStrong
            }}
          >
            {` ${n.text} `}
          </Text>
        );
      case 'bold':
        return (
          <Text key={key} style={{ fontWeight: '600' }}>
            {renderInline(n.children, p, key + 'b')}
          </Text>
        );
      case 'italic':
        return (
          <Text key={key} style={{ fontStyle: 'italic' }}>
            {renderInline(n.children, p, key + 'i')}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            accessibilityRole="link"
            onPress={() => openLink(n.href)}
            style={{ color: p.linkColor, textDecorationLine: p.inverted ? 'underline' : 'none' }}
          >
            {renderInline(n.children, p, key + 'l')}
          </Text>
        );
      default:
        return null;
    }
  });
}

function CodeBlock({ lang, code, p }: { lang: string; code: string; p: MarkdownProps }) {
  const [copied, setCopied] = useState(false);
  const t = p.tokens;
  return (
    <View style={[styles.code, { backgroundColor: t.surface2, borderColor: t.separator }]}>
      <View style={[styles.codeHeader, { borderBottomColor: t.separator }]}>
        <Text style={[typo(t).caption, { color: t.tertiary }]}>{lang || 'code'}</Text>
        {p.clipboard ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy code"
            hitSlop={8}
            onPress={async () => {
              if (await copyText(p.clipboard!, code)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            <BrainboxIcon name={copied ? 'check' : 'copy'} size={14} color={t.tertiary} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.codeBody}>
        <Text selectable style={{ fontFamily: t.mono, fontSize: 13, lineHeight: 19, color: t.label }}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

/** Safe markdown-lite renderer: bold, italic, inline code, code blocks, lists, headings, quotes, tables, links. */
export function Markdown(p: MarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(p.text), [p.text]);
  const t = p.tokens;
  const ty = typo(t);
  const base: TextStyle = { ...ty.body, color: p.color };
  const lastIdx = blocks.length - 1;
  const trailingInline = (i: number) => (i === lastIdx ? p.trailing : null);
  const lastIsInline = lastIdx >= 0 && ['paragraph', 'heading', 'list', 'quote'].includes(blocks[lastIdx].type);

  const renderBlock = (b: MdBlock, i: number): ReactNode => {
    const gap = i > 0 ? { marginTop: 8 } : null;
    switch (b.type) {
      case 'paragraph':
        return (
          <Text key={i} style={[base, gap]} selectable>
            {renderInline(b.inline, p, `p${i}-`)}
            {trailingInline(i)}
          </Text>
        );
      case 'heading':
        return (
          <Text key={i} style={[base, { fontWeight: '600' }, gap]} accessibilityRole="header">
            {renderInline(b.inline, p, `h${i}-`)}
            {trailingInline(i)}
          </Text>
        );
      case 'quote':
        return (
          <View key={i} style={[{ borderLeftWidth: 3, borderLeftColor: t.separatorStrong, paddingLeft: 10 }, gap]}>
            <Text style={[base, { color: p.inverted ? p.color : t.secondary }]}>
              {renderInline(b.inline, p, `q${i}-`)}
              {trailingInline(i)}
            </Text>
          </View>
        );
      case 'code':
        return (
          <View key={i} style={gap}>
            <CodeBlock lang={b.lang} code={b.code} p={p} />
          </View>
        );
      case 'hr':
        return <View key={i} style={[{ height: StyleSheet.hairlineWidth, backgroundColor: t.separatorStrong, marginVertical: 6 }, gap]} />;
      case 'list':
        return (
          <View key={i} style={gap}>
            {b.items.map((it, j) => (
              <View key={j} style={[styles.li, { paddingLeft: it.indent * 16 }, j > 0 && { marginTop: 3 }]}>
                <Text style={[base, styles.bullet]}>{b.ordered ? `${it.index ?? j + 1}.` : '•'}</Text>
                <Text style={[base, { flex: 1 }]} selectable>
                  {renderInline(it.inline, p, `l${i}-${j}-`)}
                  {i === lastIdx && j === b.items.length - 1 ? p.trailing : null}
                </Text>
              </View>
            ))}
          </View>
        );
      case 'table':
        return (
          <ScrollView key={i} horizontal style={gap} showsHorizontalScrollIndicator={false}>
            <View style={[styles.table, { borderColor: t.separator }]}>
              {[b.header, ...b.rows].map((row, r) => (
                <View
                  key={r}
                  style={[styles.tr, r > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }]}
                >
                  {row.map((cell, c) => (
                    <Text
                      key={c}
                      style={[ty.footnote, styles.td, { color: p.color }, r === 0 && { fontWeight: '600' }]}
                    >
                      {renderInline(cell, p, `t${i}-${r}-${c}-`)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <View>
      {blocks.map(renderBlock)}
      {!lastIsInline && p.trailing ? <Text style={[base, blocks.length ? { marginTop: 4 } : null]}>{p.trailing}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  code: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  codeBody: { padding: 10 },
  li: { flexDirection: 'row' },
  bullet: { minWidth: 18, paddingRight: 4 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row' },
  td: { minWidth: 90, maxWidth: 220, paddingHorizontal: 8, paddingVertical: 6 }
});
