#!/usr/bin/env python3
import json
from ruamel import yaml
import sys
import re
import os.path
import collections
import util
from string import Template

def load_profile(filename):
    return yaml.load(open(filename))

def load_config(profile):
    conf_default = yaml.load(open('config/default.yml'))
    return util.merge_objects(conf_default, profile)

def load_strings(language):
    return yaml.load(open('locales/{}.yml'.format(language)))

def generate_file(src, dest, var):
    template = Template(open(src).read())
    open(dest, 'w+').write(template.substitute(**var))

def generate_links(cdn_url, css_alt, style):
    module = [
        'contextmenu', 'cookie', 'replacetext', 'strophe',
        'strophe/attention', 'strophe/disco', 'strophe/caps', 'strophe/ping',
        'strophe/storage', 'strophe/time', 'strophe/version', 'moment',
        'xbbcode', 'buzz', 'babel', 'filesaver', 'isotope'
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
}

def main(filename):
    profile = load_profile(filename)
    config = load_config(profile['config'])
    cdn = config['cdnUrl'] = profile['install']['cdn']['url'] or ''

    css_alt = profile['install']['styles']
    css, libjs, corejs = generate_links(cdn, css_alt, config['settings']['activeStyle'])

    variables = {
      'title': config['ui']['title'],
      'config': json.dumps(config),
      'strings': json.dumps(load_strings(profile['install']['language'])),
      'cdnUrl': cdn,
      'emoticons': generate_emoticons(cdn, profile['install']['packs']),
      'styles': css,
      'styleOptions': '\n'.join('<option value="{name}">{name}</option>'.format(name=name) for name in css_alt),
      'scripts': libjs + corejs
    }

    return generate_file('index.tpl.html', 'index.html', variables)

main(*sys.argv[1:])
