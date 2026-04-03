import pypdf, hashlib

path = r'C:\FIRMA\chmura\kasia\BUDZÓW_projekt wykonawczy.pdf'
with open(path, 'rb') as f:
    data = f.read()

sha256 = hashlib.sha256(data).hexdigest().upper()
print(f'FILE  : {path}')
print(f'SIZE  : {len(data)} bytes ({len(data)/1024/1024:.1f} MB)')
print(f'SHA256: {sha256}')

reader = pypdf.PdfReader(path)
print(f'PAGES : {len(reader.pages)}\n')

# Search for key strings in each page
targets = ['wanna', 'parawan', 'wanna zabudowana', 'parawan nawannowy', 'przedścianka',
           'gips-karton', 'stelaż', 'geberit', '1.1', 'układ funkcjonalny', 'BUDZÓW', 'Budzów']

print('=== PAGE-BY-PAGE SCAN ===')
for i, page in enumerate(reader.pages):
    t = page.extract_text() or ''
    hits = [tg for tg in targets if tg.lower() in t.lower()]
    if hits or len(t) > 50:
        snippet = t[:200].replace('\n', ' ')
        print(f'  str:{i+1:02d} ({len(t):4d} chars) | hits: {hits or ["(no hits)"]}')
        if hits:
            # Show context for each hit
            for h in hits:
                idx = t.lower().find(h.lower())
                if idx >= 0:
                    ctx = t[max(0,idx-20):idx+len(h)+40].replace('\n',' ')
                    print(f'    "{h}" -> {repr(ctx)}')
