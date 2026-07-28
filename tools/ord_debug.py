from pathlib import Path
text = Path('sdk-react/src/brainbox-sdk.ts').read_text(encoding='utf-8')
idx = text.find('Authorization:')
for i,ch in enumerate(text[idx:idx+40]):
    print(i, repr(ch), ord(ch))
