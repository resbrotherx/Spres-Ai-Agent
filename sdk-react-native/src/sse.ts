/** A parsed Server-Sent Event. */
export interface SSEEvent {
  event: string;
  data: string;
  id?: string;
}

/**
 * Incremental Server-Sent Events parser (https://html.spec.whatwg.org/#event-stream-interpretation).
 * Feed it arbitrary text chunks; it returns the complete events contained so far and keeps any
 * partial line/event for the next call. Handles \n, \r\n and \r line endings, comments (`: ping`),
 * multi-line `data:` and a missing space after the colon.
 */
export class SSEParser {
  private buffer = '';
  private eventName = '';
  private dataLines: string[] = [];
  private lastId: string | undefined;
  private sawData = false;

  push(chunk: string): SSEEvent[] {
    const out: SSEEvent[] = [];
    if (!chunk) return out;
    this.buffer += chunk;
    // Split on any line terminator; keep the trailing partial line in the buffer. A lone trailing
    // "\r" may be the first half of "\r\n", so keep it too.
    let start = 0;
    const buf = this.buffer;
    for (let i = 0; i < buf.length; i++) {
      const ch = buf[i];
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i === buf.length - 1) break; // wait for a possible \n
        const line = buf.slice(start, i);
        if (ch === '\r' && buf[i + 1] === '\n') i++;
        start = i + 1;
        const ev = this.line(line);
        if (ev) out.push(ev);
      }
    }
    this.buffer = buf.slice(start);
    return out;
  }

  /** Flush at end of stream: a final event without a trailing blank line is dispatched. */
  end(): SSEEvent[] {
    const out: SSEEvent[] = [];
    if (this.buffer) {
      const ev = this.line(this.buffer.replace(/\r$/, ''));
      if (ev) out.push(ev);
      this.buffer = '';
    }
    const ev = this.dispatch();
    if (ev) out.push(ev);
    return out;
  }

  private line(line: string): SSEEvent | null {
    if (line === '') return this.dispatch();
    if (line[0] === ':') return null; // comment / heartbeat
    const idx = line.indexOf(':');
    let field = line;
    let value = '';
    if (idx !== -1) {
      field = line.slice(0, idx);
      value = line.slice(idx + 1);
      if (value[0] === ' ') value = value.slice(1);
    }
    if (field === 'event') this.eventName = value;
    else if (field === 'data') {
      this.dataLines.push(value);
      this.sawData = true;
    } else if (field === 'id') this.lastId = value;
    // `retry` and unknown fields are ignored.
    return null;
  }

  private dispatch(): SSEEvent | null {
    if (!this.sawData) {
      this.eventName = '';
      return null;
    }
    const ev: SSEEvent = { event: this.eventName || 'message', data: this.dataLines.join('\n') };
    if (this.lastId !== undefined) ev.id = this.lastId;
    this.eventName = '';
    this.dataLines = [];
    this.sawData = false;
    return ev;
  }
}
