from pathlib import Path
p = Path('sdk-react/src/brainbox-sdk.ts')
text = p.read_text(encoding='utf-8')
print('exists', p.exists())
idx = text.find('Authorization:')
print('idx', idx)
print(repr(text[idx-10:idx+80]))
line_start = text.rfind('\n', 0, idx) + 1
line_end = text.find('\n', idx)
print('start', line_start, 'end', line_end)
new_line = "        Authorization: `Bearer ${self.apiKey}`\n"
text2 = text[:line_start] + new_line + text[line_end+1:]
p.write_text(text2, encoding='utf-8')
text3 = p.read_text(encoding='utf-8')
print('after', repr(text3[idx-10:idx+80]))
