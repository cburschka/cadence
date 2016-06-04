#!/usr/bin/env python
import json
import sys
import re
import os.path
import collections

def load_variables():
    data = open('.config.vars').read().strip().split('\n')
    if (os.path.isfile('.version')):
      data += open('.version').read().strip().split('\n')
    return dict(line.split('=', 2) for line in data)

def generate_file(src, dest, var):
    template = open(src).read()
    template = re.sub('([{}])', '\\1\\1', template)
    template = re.sub('@@@([A-Z_]+)@@@', '{\\1}', template)
    open(dest, 'w+').write(template.format(**var))

def generate_links(cdn_url, css_alt, style):
    css = 'css/global/import.css'
    lib = [
        'js/lib/contextmenu.js',
        'js/lib/cookie.js',
        'js/lib/replacetext.js',
        'js/lib/strophe.js',
        'js/lib/strophe.attention.js',
        'js/lib/strophe.disco.js',
        'js/lib/strophe.caps.js',
        'js/lib/strophe.ping.js',
        'js/lib/strophe.storage.js',
        'js/lib/strophe.time.js',
        'js/lib/strophe.version.js',
        'js/lib/moment.js',
        'js/lib/xbbcode.js',
        'js/lib/buzz.js',
        'js/lib/filesaver.js'
    ]
    core = ['strings', 'chat', 'xmpp', 'commands', 'ui', 'visual', 'init', 'util']
    css_links = '<link id="global-style" rel="stylesheet" type="text/css" href="{href}" />\n'.format(href=cdn_url + css)
    css_template = '<link class="alternate-style" rel="{alt}stylesheet" title="{name}" type="text/css" href="{cdn}css/alt/{name}.css" />'
    css_links += '\n'.join(
        css_template.format(
            cdn=cdn_url, name=name, alt=('alternate ' if name != style else '')
        )
        for name in css_alt
    )
    js_template = '<script src="{src}"></script>'
    lib_links = '\n'.join(js_template.format(src=cdn_url + filename) for filename in lib)
    core_links = '\n'.join(js_template.format(src='{}lib/{}.js'.format(cdn_url, script)) for script in core)
    return css_links, lib_links, core_links

def generate_emoticons(cdn_url, packs):
    output = {'packages': {}, 'sidebars': {}}
    imagepath = 'img/emoticons/packs'
    try:
        for pack in packs:
            datafile = 'emoticon-packs/' + pack + '/emoticons.conf'
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
        open('emoticons.js', 'w+').write('const emoticons = ' + json.dumps(output) + ';')
    except ValueError as e:
        print("Error parsing emoticon pack {}".format(pack))
        raise(e)

targets = {
    'index.html': lambda v: generate_file('index.tpl.html', 'index.html', v),
    'config.js': lambda v: generate_file('config.tpl.js', 'config.js', v),
    'emoticons.js': lambda v: generate_emoticons(v['CDN_URL'], v['PACKS'].split()),
}

def main(target, version=None):
    variables = load_variables()
    if (version):
        variables['VERSION'] = version
    css_alt = variables['CSS_ALT'].split()
    css, libjs, corejs = generate_links(variables['CDN_URL'], css_alt, variables['STYLE'])
    variables['CSS_LINKS'] = css
    variables['CSS_OPTIONS'] = '\n'.join('<option value="{name}">{name}</option>'.format(name=name) for name in css_alt)
    variables['JS_LINKS_LIB'] = libjs
    variables['JS_LINKS_CORE'] = corejs
    return targets[target](variables)

main(*sys.argv[1:])
