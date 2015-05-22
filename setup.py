#!/usr/bin/env python
import json
import sys
import re
import os.path
import collections

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

def generate_links(cdn_url, mode, css_alt, style):
    if mode == 'minify':
        css = 'css/global/all.min.css'
        lib = ['js/lib.min.js']
        core = ['js/core.min.js']
    elif mode == 'aggregate':
        css = 'css/global/all.css'
        lib = ['js/lib.js']
        core = ['js/core.js']
    else:
        css = 'css/global/import.css'
        lib = [
            'js/lib/contextmenu.js',
            'js/lib/cookie.js',
            'js/lib/replacetext.js',
            'js/lib/strophe.js',
            'js/lib/moment.js',
            'js/lib/xbbcode.js',
            'js/lib/buzz.js',
            'js/lib/filesaver.js'
        ]
        core = [
            'js/core/strings.js', 'js/core/chat.js', 'js/core/xmpp.js',
            'js/core/ui.js', 'js/core/visual.js', 'js/core/config.js',
            'js/core/emoticons.js', 'js/core/init.js'
        ]
    css_links = '<link id="global-style" rel="stylesheet" type="text/css" href="{href}" />\n'.format(href=cdn_url + css)
    css_template = '<link class="alternate-style" rel="{alt}stylesheet" title="{name}" type="text/css" href="{cdn}css/alt/{name}.css" />'
    css_links += '\n'.join(
        css_template.format(
            cdn=cdn_url, name=name, alt=('alternate ' if name != style else '')
        )
        for name in css_alt
    )
    js_template = '<script src="{src}"></script>'
    lib_links = ''.join(js_template.format(src=cdn_url + filename) for filename in lib)
    core_links = ''.join(js_template.format(src=cdn_url + filename) for filename in core)
    return css_links, lib_links, core_links

def generate_emoticons(cdn_url, packs, src_path):
    output = {'packages': {}, 'sidebars': {}}
    imagepath = 'img/emoticons/packs'
    try:
        for pack in packs:
            datafile = src_path + '/emoticon-packs/' + pack + '/emoticons.conf'
            baseURL = cdn_url + imagepath + '/' + pack + '/'
            data = json.load(open(datafile, 'r'), object_pairs_hook=collections.OrderedDict)
            if 'codes' in data:
                output['packages'][pack] = {
                    'baseURL': baseURL,
                    'codes': data['codes']
                }
                if 'title' in data and 'icon' in data:
                    output['sidebars'][pack] = {
                        'icon': data['icon'],
                        'title': data['title']
                    }

            if 'aliases' in data:
                output['packages'][pack + '_hidden'] = {
                    'baseURL': baseURL,
                    'codes': data['aliases']
                }
        open('js/core/emoticons.js', 'w+').write('var emoticons = ' + json.dumps(output) + ';')
    except ValueError as e:
        print("Error parsing emoticon pack {}".format(pack))
        raise(e)




def main():
    variables = load_variables()
    css_alt = variables['CSS_ALT'].split()
    css, libjs, corejs = generate_links(variables['CDN_URL'], variables['MODE'], css_alt, variables['STYLE'])
    variables['CSS_LINKS'] = css
    variables['CSS_OPTIONS'] = ''.join('<option value="{name}">{name}</option>'.format(name=name) for name in css_alt)
    variables['JS_LINKS_LIB'] = libjs
    variables['JS_LINKS_CORE'] = corejs
    variables['VERSION'] = sys.argv[1]

    generate_files(variables['SRC_PATH'], variables)
    generate_emoticons(variables['CDN_URL'], variables['PACKS'].split(), variables['SRC_PATH'])

main()
