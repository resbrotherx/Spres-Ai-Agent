/**
 * Sublime Text–style (Monokai) syntax colouring for chat code blocks — a tiny dependency-free
 * tokenizer: comments, strings, numbers, keywords, literals, calls and types.
 */
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

/** Monokai colours used by the code block (always a dark editor, in light and dark mode). */
export const SUBLIME = {
  bg: '#272822',
  head: '#1e1f1c',
  line: '#141512',
  text: '#f8f8f2',
  gutter: '#75715e',
  label: '#a59f85',
  copy: '#cfcfc2',
  dots: ['#ff5f57', '#febc2e', '#28c840'],
  com: '#75715e',
  str: '#e6db74',
  num: '#ae81ff',
  lit: '#ae81ff',
  kw: '#f92672',
  fn: '#a6e22e',
  type: '#66d9ef'
} as const;

/** Tokens grouped per source line. */
export function highlightLines(src: string, lang?: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  highlightTokens(String(src ?? '').replace(/\n+$/, ''), lang).forEach(([cls, text]) => {
    text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push([cls, part]);
    });
  });
  return lines;
}
