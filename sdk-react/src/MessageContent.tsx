import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ContentPart {
  type: "text" | "code";
  value: string;
  language?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<boolean>(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fail silently
    }
  };
  return (
    <button className="bb-code-copy" type="button" onClick={handleCopy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// function CodeBlock({ language, code }: { language?: string; code: string }) {
//   return (
//     <div className="bb-code-block">
//       <div className="bb-code-header">
//         <span>{language || "code"}</span>
//         <CopyButton text={code} />
//       </div>
//       <pre><code>{code}</code></pre>
//     </div>
//   );
// }

function CodeBlock({ language, code }: { language?: string; code: string }) {
  return (
    <div className="bb-code-block">
      <div className="bb-code-header">
        <span>{language || "code"}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{ margin: 0, padding: "12px", fontSize: "12.5px", background: "transparent" }}
        codeTagProps={{ style: { fontFamily: "'Fira Code', Menlo, Consolas, monospace" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
// Splits raw text into segments: code fences, tables, lists, paragraphs
function parseContent(text: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", language: match[1], value: match[2].trim() });
    lastIndex = fenceRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

function renderInline(line: string): React.ReactNode[] {
  // bold **text**
  return line.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**")
      ? <strong key={i}>{chunk.slice(2, -2)}</strong>
      : chunk
  );
}

function TextBlock({ value }: { value: string }) {
  const lines = value.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="bb-msg-list">
          {listBuffer.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      );
      listBuffer = [];
    }
  };

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      const headerCells = tableBuffer[0].split("|").map(c => c.trim()).filter(Boolean);
      const rows = tableBuffer.slice(2).map(r => r.split("|").map(c => c.trim()).filter(Boolean));
      elements.push(
        <table key={`tbl-${elements.length}`} className="bb-msg-table">
          <thead><tr>{headerCells.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    }
    tableBuffer = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^\|.*\|$/.test(trimmed)) {
      flushList();
      tableBuffer.push(trimmed);
      return;
    }
    flushTable();

    if (/^[-*]\s+/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList();

    if (trimmed.length === 0) {
      elements.push(<br key={`br-${elements.length}`} />);
    } else {
      elements.push(<p key={`p-${elements.length}`}>{renderInline(trimmed)}</p>);
    }
  });
  flushList();
  flushTable();

  return <>{elements}</>;
}

export function MessageContent({ text }: { text?: string }) {
  const parts = parseContent(text || "");
  return (
    <div className="bb-msg-content">
      {parts.map((part, i) =>
        part.type === "code"
          ? <CodeBlock key={i} language={part.language} code={part.value} />
          : <TextBlock key={i} value={part.value} />
      )}
    </div>
  );
}
