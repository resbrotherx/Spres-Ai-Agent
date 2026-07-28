from pathlib import Path
text = Path('sdk-react/src/brainbox-sdk.ts').read_text(encoding='utf-8')
old = "        'Content-Type': 'application/json',\n        Authorization: `******      }\n"
print('contains', old in text)
print('repr old', repr(old))
idx = text.find("'Content-Type'")
print('idx', idx)
print('repr text', repr(text[idx:idx+90]))
