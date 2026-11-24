# -*- coding: utf-8 -*-
"""Puts the content hash of web_live_build/tailwind.css into every address that points at it
(index.html, admin.html, sw.js), e.g. /tailwind.css?v=3fa9c1d2.

Why: tailwind.css was the only stylesheet without a version in its address. A browser (or the service worker) that
still held an old copy would pair it with a newer page, and any new layout class was missing: broken windows for
returning visitors. With the hash in the address, a changed stylesheet is always a new address, so an old copy can
never be used. Run automatically by deploy.py after the CSS build; safe to run any time (changes nothing when the
hash is already right, keeps line endings, writes no BOM)."""
import hashlib, io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(os.path.dirname(ROOT), 'web_live_build')
CSS = os.path.join(BUILD, 'tailwind.css')

def main():
    with open(CSS, 'rb') as f:
        data = f.read()
    # hash the content without line-ending differences, so a CRLF/LF change alone never changes the address
    h = hashlib.sha1(data.replace(b'\r\n', b'\n')).hexdigest()[:10]
    changed = []
    for name, pattern, repl in (
        ('index.html', r'(href=")/tailwind\.css(?:\?v=[0-9a-f]+)?(")', r'\1/tailwind.css?v=%s\2' % h),
        ('admin.html', r'(href=")/tailwind\.css(?:\?v=[0-9a-f]+)?(")', r'\1/tailwind.css?v=%s\2' % h),
        ('sw.js', r"(')\./tailwind\.css(?:\?v=[0-9a-f]+)?(')", r"\1./tailwind.css?v=%s\2" % h),
    ):
        path = os.path.join(BUILD, name)
        if not os.path.exists(path):
            continue
        with io.open(path, 'r', encoding='utf-8', newline='') as f:
            s = f.read()
        new, n = re.subn(pattern, repl, s)
        if n == 0:
            print('[stamp_css] WARNING: no tailwind.css reference found in ' + name)
            continue
        if new != s:
            with io.open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(new)
            changed.append(name)
    print('[stamp_css] tailwind.css?v=%s %s' % (h, ('updated in ' + ', '.join(changed)) if changed else 'already current'))
    return 0

if __name__ == '__main__':
    sys.exit(main())
