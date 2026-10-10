'use client';
import { memo, useInsertionEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorDots, HighlightedCode, useSublimeStyles } from './design/code';

/* ------------------------------------------------------------------ */
/* Styles (token-aware, injected once)                                 */
/* ------------------------------------------------------------------ */

const STYLE_ID = 'bb-md-styles-v3';
const MD_CSS = `
.bb-md { font-size: inherit; line-height: 1.45; overflow-wrap: anywhere; }
.bb-md > :first-child { margin-top: 0; }
.bb-md > :last-child { margin-bottom: 0; }
.bb-md p { margin: 0 0 8px; }
.bb-md h1, .bb-md h2, .bb-md h3, .bb-md h4, .bb-md h5, .bb-md h6 { font-size: 15px; font-weight: 600; line-height: 1.3; margin: 12px 0 4px; letter-spacing: 0; }
.bb-md h1, .bb-md h2 { font-size: 16px; }
.bb-md ul, .bb-md ol { margin: 4px 0 8px; padding-left: 20px; }
.bb-md li { margin: 2px 0; }
.bb-md li > ul, .bb-md li > ol { margin: 2px 0; }
.bb-md strong { font-weight: 600; }
.bb-md a { color: var(--bb-accent, #0071E3); text-decoration: none; }
.bb-md a:hover { text-decoration: underline; }
.bb-md code.bb-md-inline { font-family: var(--bb-mono, "SF Mono", ui-monospace, Menlo, Consolas, monospace); font-size: 13px; padding: 1px 5px; border-radius: 5px; background: var(--bb-fill, rgba(120,120,128,0.08)); }
.bb-md blockquote { margin: 6px 0 8px; padding: 2px 0 2px 12px; border-left: 3px solid var(--bb-separator-strong, rgba(60,60,67,0.2)); color: var(--bb-secondary, #6E6E73); }
.bb-md hr { border: 0; border-top: 1px solid var(--bb-separator, rgba(60,60,67,0.12)); margin: 10px 0; }
.bb-md-table-wrap { overflow-x: auto; margin: 6px 0 8px; max-width: 100%; }
.bb-md table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
.bb-md th, .bb-md td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--bb-separator, rgba(60,60,67,0.12)); vertical-align: top; }
.bb-md th { font-weight: 600; color: var(--bb-secondary, #6E6E73); }
.bb-md tr:last-child td { border-bottom: 0; }
`;

const useIsoEffect: typeof useInsertionEffect =
  typeof window === 'undefined' ? ((() => undefined) as any) : typeof useInsertionEffect === 'function' ? useInsertionEffect : useLayoutEffect;

function useMdStyles() {
  useIsoEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = MD_CSS;
    document.head.appendChild(style);
  }, []);
}

/* ------------------------------------------------------------------ */
/* Code block                                                          */
/* ------------------------------------------------------------------ */

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const lang = (language || '').toLowerCase();
  useSublimeStyles();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="bb-code bb-sublime">
      <div className="bb-sublime-head">
        <EditorDots />
        <span className="bb-sublime-title">{lang || 'code'}</span>
        <button className={`bb-sublime-copy${copied ? ' is-copied' : ''}`} type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <HighlightedCode code={code} lang={lang} />
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline markdown                                                     */
/* ------------------------------------------------------------------ */

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function Link({ href, children }: { href: string; children: ReactNode }) {
  if (!SAFE_URL.test(href.trim())) return <>{children}</>;
  const external = /^https?:/i.test(href);
  return (
    <a href={href.trim()} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
      {children}
    </a>
  );
}

// Order matters: code first (its content is literal), then links, then emphasis.
const INLINE =
  /(`+)([\s\S]*?[^`])\1(?!`)|\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|\*([^*\s][^*\n]*?)\*|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]])/g;

function renderInline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  INLINE.lastIndex = 0;
  const re = new RegExp(INLINE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<code key={k} className="bb-md-inline">{m[2].trim() ? m[2].replace(/^ (.*) $/, '$1') : m[2]}</code>);
    else if (m[3] != null) out.push(<Link key={k} href={m[4]}>{renderInline(m[3], k)}</Link>);
    else if (m[5] != null) out.push(<strong key={k}>{renderInline(m[5], k)}</strong>);
    else if (m[6] != null) out.push(<strong key={k}>{renderInline(m[6], k)}</strong>);
    else if (m[7] != null) out.push(<del key={k}>{renderInline(m[7], k)}</del>);
    else if (m[8] != null) out.push(<em key={k}>{renderInline(m[8], k)}</em>);
    else if (m[9] != null) out.push(<Link key={k} href={m[9]}>{m[9]}</Link>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderLines(lines: string[], key: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`${key}-br-${i}`} />);
    out.push(...renderInline(line, `${key}-${i}`));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Block parser                                                        */
/* ------------------------------------------------------------------ */

const LIST_ITEM = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(row: string): string[] {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  return r.split('|').map((c) => c.trim());
}

interface ListNode {
  ordered: boolean;
  start: number;
  items: { text: string[]; children: ListNode[] }[];
  indent: number;
}

function renderList(list: ListNode, key: string): ReactNode {
  const items = list.items.map((it, i) => (
    <li key={i}>
      {renderLines(it.text, `${key}-${i}`)}
      {it.children.map((c, ci) => renderList(c, `${key}-${i}-${ci}`))}
    </li>
  ));
  return list.ordered ? (
    <ol key={key} start={list.start !== 1 ? list.start : undefined}>
      {items}
    </ol>
  ) : (
    <ul key={key}>{items}</ul>
  );
}

function parseBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b${k++}`;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code (an unclosed fence while streaming runs to the end).
    const fence = trimmed.match(/^(```+|~~~+)\s*([\w#+.-]*)/);
    if (fence) {
      const marker = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) body.push(lines[i++]);
      i++;
      out.push(<CodeBlock key={key()} language={fence[2]} code={body.join('\n').replace(/\s+$/, '')} />);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = (`h${Math.min(level + 2, 6)}`) as 'h3' | 'h4' | 'h5' | 'h6';
      out.push(<Tag key={key()}>{renderInline(heading[2])}</Tag>);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push(<hr key={key()} />);
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) body.push(lines[i++].trim().replace(/^>\s?/, ''));
      out.push(<blockquote key={key()}>{parseBlocks(body.join('\n'))}</blockquote>);
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      const k2 = key();
      out.push(
        <div key={k2} className="bb-md-table-wrap">
          <table>
            <thead>
              <tr>
                {head.map((h, hi) => (
                  <th key={hi}>{renderInline(h, `${k2}-h${hi}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, ci) => (
                    <td key={ci}>{renderInline(r[ci] || '', `${k2}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const root: ListNode[] = [];
      const stack: ListNode[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(LIST_ITEM);
        if (m) {
          const indent = m[1].replace(/\t/g, '    ').length;
          const ordered = /\d/.test(m[2]);
          while (stack.length && indent < stack[stack.length - 1].indent) stack.pop();
          let top = stack[stack.length - 1];
          if (top && indent > top.indent + 1 && top.items.length) {
            const child: ListNode = { ordered, start: ordered ? parseInt(m[2], 10) : 1, items: [], indent };
            top.items[top.items.length - 1].children.push(child);
            stack.push(child);
            top = child;
          } else if (!top || top.ordered !== ordered || indent !== top.indent) {
            if (top && indent === top.indent) stack.pop();
            const list: ListNode = { ordered, start: ordered ? parseInt(m[2], 10) : 1, items: [], indent };
            const parent = stack[stack.length - 1];
            if (parent && parent.items.length) parent.items[parent.items.length - 1].children.push(list);
            else root.push(list);
            stack.push(list);
            top = list;
          }
          top.items.push({ text: [m[3]], children: [] });
          i++;
        } else if (l.trim() && /^\s{2,}/.test(l) && stack.length) {
          // Continuation line of the current item.
          const top = stack[stack.length - 1];
          top.items[top.items.length - 1].text.push(l.trim());
          i++;
        } else {
          break;
        }
      }
      root.forEach((list) => out.push(renderList(list, key())));
      continue;
    }

    // Paragraph: consecutive plain lines.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (!t || /^(```|~~~)/.test(t) || /^#{1,6}\s/.test(t) || t.startsWith('>') || LIST_ITEM.test(l) || /^(-{3,}|\*{3,}|_{3,})$/.test(t)) break;
      if (t.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) break;
      para.push(t);
      i++;
    }
    const pk = key();
    out.push(<p key={pk}>{renderLines(para, pk)}</p>);
  }
  return out;
}

export interface MessageContentProps {
  text?: string;
  className?: string;
}

/**
 * Safe "markdown-lite" renderer for assistant messages: headings, bold/italic/strike, inline code,
 * fenced code with light syntax highlighting, bullet + numbered lists, links (http/https/mailto only),
 * tables, blockquotes and rules. Never injects HTML.
 */
export const MessageContent = memo(function MessageContent({ text, className }: MessageContentProps) {
  useMdStyles();
  return <div className={`bb-md bb-msg-content${className ? ` ${className}` : ''}`}>{parseBlocks(text || '')}</div>;
});

export default MessageContent;
