import pypdf, hashlib

path = 'scripts/_debug_1b.pdf'
with open(path, 'rb') as f:
    data = f.read()

sha256 = hashlib.sha256(data).hexdigest().upper()
md5    = hashlib.md5(data).hexdigest().upper()
print(f'FILE  : {path}')
print(f'SIZE  : {len(data)} bytes ({len(data)/1024:.1f} KB)')
print(f'SHA256: {sha256}')
print(f'MD5   : {md5}')
print()

reader = pypdf.PdfReader(path)
full_text = ''
for p in reader.pages:
    full_text += (p.extract_text() or '')

print(f'Total extracted chars: {len(full_text)}')
print()

targets = [
    'wanna zabudowana',
    'parawan nawannowy',
    'przedścianka',
    'gips-karton',
    'karton-gips',
    'długi blat',
    'blat',
    'panele laminowane',
    'płytki gresowe',
    'stelaż',
    'prysznic',
    'walk-in',
    'geberit',
    'umywalka',
    'wanna',
    'parawan',
]

print('=== RAW TEXT SEARCH (binary PDF, no LLM) ===')
for t in targets:
    found = t.lower() in full_text.lower()
    idx = full_text.lower().find(t.lower())
    ctx = ''
    if idx >= 0:
        start = max(0, idx-30)
        end   = min(len(full_text), idx+len(t)+40)
        ctx = repr(full_text[start:end])
    status = 'FOUND  ' if found else 'MISSING'
    print(f'  [{status}] "{t}"' + (f'  <- {ctx}' if found else ''))
