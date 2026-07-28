from pathlib import Path

path = Path('sdk-react/src/brainbox-sdk.ts')
text = path.read_text(encoding='utf-8')
idx = text.find('Authorization:')
if idx == -1:
    raise SystemExit('Authorization not found')
line_start = text.rfind('\n', 0, idx) + 1
line_end = text.find('\n', idx)
if line_end == -1:
    line_end = len(text)
new_line = "        Authorization: `Bearer ${self.apiKey}`\n"
text = text[:line_start] + new_line + text[line_end + 1:]
path.write_text(text, encoding='utf-8')
print('patched')
