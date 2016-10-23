#!/usr/bin/env python3
import json
from ruamel import yaml
import sys
import re
import os.path
import collections

def load_profile(filename):
    return yaml.load(open(filename))

def load_config(profile):
    conf_default = yaml.load(open('config/default.yml'))
    return merge_config(conf_default, profile)

def load_strings(language):
    return yaml.load(open('locales/{}.yml'.format(language)))

def merge_config(a, b):
    # If a is a dict, either merge or ignore b.
    if type(a) is dict:
        if type(b) is dict:
            for key in a.keys() & b.keys():
                a[key] = merge_config(a[key], b[key])
    # Override lists only with lists, but anything else with anything.
    elif (type(a) is list) <= (type(b) is list):
        return b
    return a

def generate_file(src, dest, var):
    template = open(src).read()
    template = re.sub('([{}])', '\\1\\1', template)
    template = re.sub('@@@([A-Z_]+)@@@', '{\\1}', template)
    open(dest, 'w+').write(template.format(**var))

def generate_links(cdn_url, css_alt, style):
    module = [
        'contextmenu', 'cookie', 'replacetext', 'strophe',
        'strophe/attention', 'strophe/disco', 'strophe/caps', 'strophe/ping',
        'strophe/storage', 'strophe/time', 'strophe/version', 'moment',
        'xbbcode', 'buzz', 'babel', 'filesaver'
    ]
    core = ['chat', 'xmpp', 'commands', 'ui', 'visual', 'init', 'util']
    css_template = '<link class="alternate-style" rel="{alt}stylesheet" title="{name}" type="text/css" href="{cdn}assets/css/alt/{name}.css" />'
    css_links = '\n'.join(
        css_template.format(
            cdn=cdn_url, name=name, alt=('alternate ' if name != style else '')
        )
        for name in css_alt
    )
    js_template = '<script src="{src}"></script>'
    core_links = '\n'.join(js_template.format(src='{}lib/{}.js'.format(cdn_url, script)) for script in core)
    module_links = '\n'.join(js_template.format(src='{}lib/modules/{}.js'.format(cdn_url, script)) for script in module)
    return css_links, module_links, core_links

def generate_emoticons(cdn_url, packs):
    output = {'packages': {}, 'sidebars': {}}
    imagepath = 'assets/emoticons'
    try:
        for pack in packs:
            datafile = 'emoticon-packs/' + pack + '/emoticons.yml'
            baseURL = cdn_url + imagepath + '/' + pack + '/'
            data = yaml.load(open(datafile, 'r'), Loader=yaml.RoundTripLoader)
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
        return json.dumps(output)
    except ValueError as e:
        print("Error parsing emoticon pack {}".format(pack))
        raise(e)

targets = {
    'index.html': lambda v: generate_file('index.tpl.html', 'index.html', v)
}

def main(target, filename='install.yml'):
    profile = load_profile(filename)
    config = load_config(profile['config'])
    config['cdnURL'] = profile['install']['cdn']['url']

    variables = {}

    variables['TITLE'] = config['ui']['title']
    variables['STRINGS'] = json.dumps(load_strings(profile['install']['language']))

    css_alt = profile['install']['styles']
    variables['CDN_URL'] = profile['install']['cdn']['url'] or ''
    css, libjs, corejs = generate_links(variables['CDN_URL'], css_alt, config['settings']['activeStyle'])

    variables['EMOTICONS'] = generate_emoticons(variables['CDN_URL'], profile['install']['packs'])
    variables['CONFIG'] = json.dumps(config)
    variables['CSS_LINKS'] = css
    variables['CSS_OPTIONS'] = '\n'.join('<option value="{name}">{name}</option>'.format(name=name) for name in css_alt)
    variables['JS_LINKS_LIB'] = libjs
    variables['JS_LINKS_CORE'] = corejs
    return targets[target](variables)

main(*sys.argv[1:])
