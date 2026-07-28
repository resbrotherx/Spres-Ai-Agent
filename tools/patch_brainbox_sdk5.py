from pathlib import Path
path = Path('sdk-react/src/brainbox-sdk.ts')
text = path.read_text(encoding='utf-8')
count = text.count('`******')
print('count', count)
if count == 0:
    raise SystemExit('pattern not found')
text = text.replace('`******', '`Bearer ${self.apiKey}`', 1)
path.write_text(text, encoding='utf-8')
print('patched')
