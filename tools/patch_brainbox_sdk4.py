from pathlib import Path
path = Path('sdk-react/src/brainbox-sdk.ts')
text = path.read_text(encoding='utf-8')
old = "        'Content-Type': 'application/json',\n        Authorization: `******      }\n"
new = "        'Content-Type': 'application/json',\n        Authorization: `Bearer ${self.apiKey}`\n"
if old not in text:
    raise SystemExit('old text not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('patched')
