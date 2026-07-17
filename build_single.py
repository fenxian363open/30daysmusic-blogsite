#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""打包「30天推歌挑战」为单文件 HTML + zip。
把 css/js 内联、30 张 B 面图转 Base64，输出可直接手机打开的单文件 HTML，
以及用于部署/备份的 blog-site.zip。
"""
import os
import re
import base64
import shutil

ROOT = r'C:/Users/38488/WorkBuddy/2026-07-13-23-19-50/blog-site'
OUT_HTML = r'C:/Users/38488/WorkBuddy/2026-07-13-23-19-50/30天推歌挑战-手机版.html'
ZIP_PATH = r'C:/Users/38488/WorkBuddy/2026-07-13-23-19-50/blog-site.zip'


def read(p):
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()


def readb(p):
    with open(p, 'rb') as f:
        return f.read()


def main():
    html = read(os.path.join(ROOT, 'index.html'))

    # 1) 内联 CSS
    css = read(os.path.join(ROOT, 'css/styles.css'))
    html = html.replace('<link rel="stylesheet" href="css/styles.css" />',
                        '<style>\n' + css + '\n</style>')

    # 2) 内联 JS（flipboard.js 需把 B 面图替换为 Base64）
    js_files = ['js/blog-data.js', 'js/markdown.js', 'js/cell-texts.js',
                'js/song-data.js', 'js/flipboard.js', 'js/app.js']
    for jf in js_files:
        jp = os.path.join(ROOT, jf)
        if not os.path.exists(jp):
            print('skip missing', jf)
            continue
        content = read(jp)

        if jf == 'js/flipboard.js':
            uris = []
            for i in range(1, 31):
                n = f'{i:02d}'
                imgp = os.path.join(ROOT, 'imagesB', n + '.jpg')
                b = readb(imgp)
                uris.append('data:image/jpeg;base64,' + base64.b64encode(b).decode('ascii'))
            arr = ',\n    '.join('"%s"' % u for u in uris)
            newblock = 'const IMAGE_PATHS = { b: [\n    ' + arr + '\n  ] };'
            m = re.search(r"const IMAGE_PATHS = \{ b: \[\] \};.*?\n  \}", content, re.DOTALL)
            if not m:
                raise SystemExit('IMAGE_PATHS block not found in flipboard.js')
            content = content[:m.start()] + newblock + content[m.end():]

        tag = f'<script src="{jf}"></script>'
        inline = f'<script>\n{content}\n</script>'
        if tag not in html:
            raise SystemExit('script tag not found: ' + jf)
        html = html.replace(tag, inline)

    # 2.5) 内联图标（网易云 wyy.png / B站 bili.webp），全局替换相对路径为 Data URI
    for name in ['wyy.png', 'bili.webp']:
        ip = os.path.join(ROOT, 'images', name)
        if not os.path.exists(ip):
            raise SystemExit('icon not found: ' + name)
        b = readb(ip)
        mime = 'image/png' if name.endswith('.png') else 'image/webp'
        uri = 'data:%s;base64,%s' % (mime, base64.b64encode(b).decode('ascii'))
        html = html.replace('images/' + name, uri)

    # 3) 写出单文件 HTML
    with open(OUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html)
    print('HTML written:', os.path.getsize(OUT_HTML), 'bytes')

    # 4) 打包 zip
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)
    shutil.make_archive(ZIP_PATH[:-4], 'zip', ROOT)
    print('ZIP written:', os.path.getsize(ZIP_PATH), 'bytes')


if __name__ == '__main__':
    main()
