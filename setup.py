#!/usr/bin/env python
import sys
import re

def load_variables():
    data = open('.config.vars').read().strip().split('\n')
    return dict(line.split('=', 2) for line in data)


def generate_file(src, dest, var):
    template = open(src).read()
    template = re.sub('([{}])', '\\1\\1', template)
    template = re.sub('@@@([A-Z_]+)@@@', '{\\1}', template)
    open(dest, 'w+').write(template.format(**var))

def generate_files(src_path, var):
    files = [('index.tpl.html', 'index.html'), ('js/core/config.tpl.js', 'js/core/config.js')]
    for src, dest in files:
        generate_file(src_path + '/' + src, dest, var)

def generate_script_links(cdn_url, mode):
    if mode == 'minify':
        lib = ['js/lib.min.js']
        core = ['js/core.min.js']
    elif mode == 'aggregate':
        lib = ['js/lib.js']
        core = ['js/core.js']
    else:
        lib = [
            'js/lib/jquery.replacetext.js',
            'js/lib/jquery.cookie.js',
            'js/lib/strophe.js',
            'js/lib/moment.js'
            'js/lib/xbbcode.js',
            'js/lib/buzz.js',
            'js/lib/filesaver.js'
        ]
        core = [
            'js/core/strings.js', 'js/core/chat.js', 'js/core/xmpp.js',
            'js/core/ui.js', 'js/core/visual.js', 'js/core/config.js',
            'js/core/init.js'
        ]
    template = '<script type="text/javascript" src="{src}" charset="UTF-8"></script>'
    lib_links = ''.join(template.format(src=cdn_url + filename) for filename in lib)
    core_links = ''.join(template.format(src=cdn_url + filename) for filename in core)
    return lib_links, core_links

def main():
    variables = load_variables()
    libjs, corejs = generate_script_links(variables['CDN_URL'], variables['MODE'])
    variables['JS_LINKS_LIB'] = libjs
    variables['JS_LINKS_CORE'] = corejs
    variables['VERSION'] = sys.argv[1]

    if variables['MODE'] == 'minify':
        variables['CSS_LINK_GLOBAL'] = 'css/global/all.min.css'
    elif variables['MODE'] == 'aggregate':
        variables['CSS_LINK_GLOBAL'] = 'css/global/all.css'
    else:
        variables['CSS_LINK_GLOBAL'] = 'css/global/import.css'

    generate_files(variables['SRC_PATH'], variables)

main()
