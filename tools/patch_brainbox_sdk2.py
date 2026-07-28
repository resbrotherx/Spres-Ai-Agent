from pathlib import Path

path = Path('sdk-react/src/brainbox-sdk.ts')
text = path.read_text(encoding='utf-8')
lines = text.splitlines(True)
for i, line in enumerate(lines):
    if 'Authorization: `******' in line:
        lines[i] = "        Authorization: `Bearer ${self.apiKey}`\n"
        path.write_text(''.join(lines), encoding='utf-8')
        print('patched')
        break
else:
    raise SystemExit('authorization line not found')
