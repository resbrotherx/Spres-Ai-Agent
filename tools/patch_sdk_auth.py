from pathlib import Path
path = Path('sdk-react/src/brainbox-sdk.ts')
text = path.read_text(encoding='utf-8')
old = '        Authorization: `******\r\n'
new = '        Authorization: `Bearer ${self.apiKey}`\r\n'
if old not in text:
    raise SystemExit(f'old substring not found ({repr(old)})')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('patched')
