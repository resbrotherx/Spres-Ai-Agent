/** Markdown-lite parser: no HTML, no dependencies. Produces a tiny AST rendered with RN <Text>. */

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'bold'; children: MdInline[] }
  | { type: 'italic'; children: MdInline[] }
  | { type: 'link'; href: string; children: MdInline[] };

export interface MdListItem {
  inline: MdInline[];
  indent: number;
  index?: number;
}

export type MdBlock =
  | { type: 'paragraph'; inline: MdInline[] }
  | { type: 'heading'; level: number; inline: MdInline[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'list'; ordered: boolean; items: MdListItem[] }
  | { type: 'quote'; inline: MdInline[] }
  | { type: 'table'; header: MdInline[][]; rows: MdInline[][][] }
  | { type: 'hr' };

/** Only http(s) and mailto links are clickable. */
export function safeHref(href: string): string | null {
  const h = (href || '').trim();
  if (/^https?:\/\/[^\s]+$/i.test(h)) return h;
  if (/^mailto:[^\s]+$/i.test(h)) return h;
  return null;
}

const INLINE_RE =
  /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)|\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__|\*(?=[^\s*])([^*\n]*?[^\s*])\*|\b_(?=[^\s_])([^_\n]*?[^\s_])_\b|\[([^\]\n]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|((?:https?:\/\/|mailto:)[^\s<>()]*[^\s<>().,;:!?'"\]*_])/g;

export function parseInline(src: string): MdInline[] {
  const out: MdInline[] = [];
  const push = (n: MdInline) => {
    const last = out[out.length - 1];
    if (n.type === 'text' && last && last.type === 'text') last.text += n.text;
    else out.push(n);
  };
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // Fresh regex per call (global regexes are stateful and parseInline recurses).
  const re = new RegExp(INLINE_RE.source, 'g');
  while ((m = re.exec(src))) {
    if (m.index > last) push({ type: 'text', text: src.slice(last, m.index) });
    if (m[1] !== undefined) push({ type: 'code', text: m[2].replace(/^ (.*) $/, '$1') });
    else if (m[3] !== undefined) out.push({ type: 'bold', children: parseInline(m[3]) });
    else if (m[4] !== undefined) out.push({ type: 'bold', children: parseInline(m[4]) });
    else if (m[5] !== undefined) out.push({ type: 'italic', children: parseInline(m[5]) });
    else if (m[6] !== undefined) out.push({ type: 'italic', children: parseInline(m[6]) });
    else if (m[7] !== undefined) {
      const href = safeHref(m[8]);
      if (href) out.push({ type: 'link', href, children: parseInline(m[7]) });
      else push({ type: 'text', text: m[7] }); // unsafe scheme: show the label only
    } else if (m[9] !== undefined) {
      const href = safeHref(m[9]);
      if (href) out.push({ type: 'link', href, children: [{ type: 'text', text: m[9] }] });
      else push({ type: 'text', text: m[9] });
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) push({ type: 'text', text: src.slice(last) });
  return out;
}

const FENCE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

export function parseMarkdown(text: string): MdBlock[] {
  const lines = (text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: 'paragraph', inline: parseInline(para.join('\n')) });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const marker = fence[1];
      const code: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}\\s*$`).test(lines[i])) code.push(lines[i++]);
      // Unclosed fence (e.g. while streaming): everything to the end is code.
      blocks.push({ type: 'code', lang: fence[2] || '', code: code.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'heading', level: h[1].length, inline: parseInline(h[2]) });
      continue;
    }
    if (HR.test(line) && !BULLET.test(line.replace(/\s+/g, ' ').trim() + ' x')) {
      flush();
      blocks.push({ type: 'hr' });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      flush();
      const header = splitRow(line).map(parseInline);
      const rows: MdInline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]).map(parseInline));
      i--;
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    if (b || o) {
      flush();
      const ordered = !!o;
      const items: MdListItem[] = [];
      let j = i;
      while (j < lines.length) {
        const lb = BULLET.exec(lines[j]);
        const lo = lb ? null : ORDERED.exec(lines[j]);
        if (lb || lo) {
          const indent = Math.floor(((lb || lo)![1].replace(/\t/g, '  ').length) / 2);
          // A different list type at the top level starts a new list.
          if (indent === 0 && !!lo !== ordered) break;
          items.push(lo ? { inline: parseInline(lo[3]), indent, index: Number(lo[2]) } : { inline: parseInline(lb![2]), indent });
          j++;
        } else if (lines[j].trim() && /^\s{2,}\S/.test(lines[j]) && items.length) {
          // continuation line of the previous item
          const prev = items[items.length - 1];
          prev.inline = [...prev.inline, { type: 'text', text: '\n' }, ...parseInline(lines[j].trim())];
          j++;
        } else break;
      }
      blocks.push({ type: 'list', ordered, items });
      i = j - 1;
      continue;
    }
    const q = QUOTE.exec(line);
    if (q) {
      flush();
      const parts = [q[1]];
      while (i + 1 < lines.length && QUOTE.test(lines[i + 1])) parts.push(QUOTE.exec(lines[++i])![1]);
      blocks.push({ type: 'quote', inline: parseInline(parts.join('\n')) });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
