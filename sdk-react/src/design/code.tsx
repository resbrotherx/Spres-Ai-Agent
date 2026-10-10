/**
 * Sublime Text–style (Monokai) code display shared by chat answers, the training SDK tab and the
 * staff dashboard: dark editor background, window dots, a line-number gutter and syntax colours.
 * Tiny dependency-free tokenizer — comments, strings, numbers, keywords, literals, calls, types.
 */
import { useInsertionEffect, useLayoutEffect, type ReactNode } from 'react';

export type CodeTokenKind = 'com' | 'str' | 'num' | 'kw' | 'lit' | 'fn' | 'type';
export type CodeToken = [CodeTokenKind | null, string];

const KEYWORDS =
  /^(?:import|from|as|def|class|return|if|elif|else|for|while|in|not|and|or|is|with|try|except|finally|raise|lambda|yield|await|async|pass|break|continue|global|const|let|var|function|new|this|self|export|default|extends|typeof|instanceof|case|switch|throw|catch|delete|of|do|void|static|public|private|interface|type|enum|echo|then|fi|done|sudo|curl|pip|npm|npx|cd|require|module)$/;
const LITERALS = /^(?:true|false|null|undefined|None|True|False|NaN)$/;
const C_LIKE = /^(?:js|javascript|jsx|mjs|ts|typescript|tsx|json|css|scss|html|xml|java|c|cpp|cs|go|rust|swift|kotlin|php)$/i;
const RE_HASH =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
const RE_C =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

/** Split source into coloured tokens. `#` starts a comment except in C-like languages. */
export function highlightTokens(src: string, lang?: string): CodeToken[] {
  const text = String(src ?? '');
  const re = new RegExp((C_LIKE.test(lang || '') ? RE_C : RE_HASH).source, 'g');
  const out: CodeToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    const tok = m[0];
    let cls: CodeTokenKind | null = null;
    if (m[1]) {
      const prev = text.charAt(start - 1);
      if (tok.startsWith('//') && prev === ':') {
        re.lastIndex = start + 2; // a URL, not a comment
        continue;
      }
      if (tok.startsWith('#') && start > 0 && !/\s/.test(prev)) {
        re.lastIndex = start + 1;
        continue;
      }
      cls = 'com';
    } else if (m[2]) cls = 'str';
    else if (m[3]) cls = 'num';
    else if (m[4]) {
      if (KEYWORDS.test(tok)) cls = 'kw';
      else if (LITERALS.test(tok)) cls = 'lit';
      else if (/^\s*\(/.test(text.slice(re.lastIndex, re.lastIndex + 24))) cls = 'fn';
      else if (/^[A-Z][a-z]/.test(tok)) cls = 'type';
    }
    if (!cls) continue;
    if (start > last) out.push([null, text.slice(last, start)]);
    out.push([cls, tok]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push([null, text.slice(last)]);
  return out;
}

/** `<code>` with one `.bb-ln` line per source line (gutter numbers come from CSS counters). */
export function HighlightedCode({ code, lang }: { code: string; lang?: string }) {
  const lines: ReactNode[][] = [[]];
  highlightTokens(String(code ?? '').replace(/\n+$/, ''), lang).forEach(([cls, text], ti) => {
    text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (!part) return;
      const line = lines[lines.length - 1];
      line.push(cls ? <span key={`${ti}-${i}`} className={`bb-tk-${cls}`}>{part}</span> : part);
    });
  });
  return (
    <code className={`bb-hl${lines.length === 1 ? ' is-single' : ''}`}>
      {lines.map((parts, i) => (
        <span key={i} className="bb-ln">
          {parts}
        </span>
      ))}
    </code>
  );
}

/** The three window dots of the editor title bar. */
export function EditorDots() {
  return (
    <span className="bb-sublime-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export const SUBLIME_CODE_CSS = `
.bb-sublime { margin: 8px 0; border-radius: 10px; overflow: hidden; background: #272822; border: 1px solid #1b1c18; color: #f8f8f2; min-width: 0; }
.bb-sublime-head { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 4px 6px 4px 10px; background: #1e1f1c; border-bottom: 1px solid #141512; color: #a59f85; font-size: 11.5px; }
.bb-sublime-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: "Fira Code", ui-monospace, Menlo, Consolas, monospace; }
.bb-sublime-dots { display: inline-flex; gap: 5px; flex: none; }
.bb-sublime-dots i { width: 10px; height: 10px; border-radius: 999px; background: #ff5f57; }
.bb-sublime-dots i:nth-child(2) { background: #febc2e; }
.bb-sublime-dots i:nth-child(3) { background: #28c840; }
.bb-sublime-copy { appearance: none; border: 0; background: transparent; color: #cfcfc2; font: inherit; font-size: 11.5px; font-weight: 600; padding: 4px 9px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; flex: none; }
.bb-sublime-copy:hover { background: rgba(255,255,255,.08); color: #fff; }
.bb-sublime-copy:focus-visible { outline: 2px solid #66d9ef; outline-offset: 1px; }
.bb-sublime-copy.is-copied { color: #a6e22e; }
.bb-sublime pre { margin: 0 !important; padding: 10px 14px 12px 6px !important; overflow-x: auto; background: transparent !important; border: 0; font-family: "Fira Code", "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.6; white-space: pre; color: #f8f8f2; tab-size: 2; scrollbar-width: thin; scrollbar-color: #49483e transparent; }
.bb-sublime pre:focus-visible { outline: 2px solid #66d9ef; outline-offset: -2px; }
.bb-sublime code.bb-hl { display: block; min-width: max-content; font: inherit; color: inherit; background: none; padding: 0; counter-reset: bbln; }
.bb-sublime .bb-ln { display: block; position: relative; min-height: 1.6em; padding-left: 3em; }
.bb-sublime .bb-ln::before { counter-increment: bbln; content: counter(bbln); position: absolute; left: 0; width: 2.2em; text-align: right; color: #75715e; opacity: .8; -webkit-user-select: none; user-select: none; }
.bb-sublime code.is-single .bb-ln { padding-left: 8px; }
.bb-sublime code.is-single .bb-ln::before { display: none; }
.bb-sublime .bb-tk-com { color: #75715e; font-style: italic; }
.bb-sublime .bb-tk-str { color: #e6db74; }
.bb-sublime .bb-tk-num, .bb-sublime .bb-tk-lit { color: #ae81ff; }
.bb-sublime .bb-tk-kw { color: #f92672; }
.bb-sublime .bb-tk-fn { color: #a6e22e; }
.bb-sublime .bb-tk-type { color: #66d9ef; font-style: italic; }
`;

const useIsoEffect: typeof useInsertionEffect =
  typeof window === 'undefined'
    ? ((() => undefined) as unknown as typeof useInsertionEffect)
    : typeof useInsertionEffect === 'function'
      ? useInsertionEffect
      : useLayoutEffect;

/** Inject the editor stylesheet once per document. */
export function useSublimeStyles() {
  useIsoEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('bb-sublime-styles')) return;
    const style = document.createElement('style');
    style.id = 'bb-sublime-styles';
    style.textContent = SUBLIME_CODE_CSS;
    document.head.appendChild(style);
  }, []);
}
