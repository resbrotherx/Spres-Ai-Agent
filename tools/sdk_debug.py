from pathlib import Path
text = Path('sdk-react/src/brainbox-sdk.ts').read_text(encoding='utf-8')
idx = text.find('Authorization:')
print('idx', idx)
print(repr(text[idx-5:idx+40]))
for i,ch in enumerate(text[idx-5:idx+40]):
    print(i, repr(ch), ord(ch))
