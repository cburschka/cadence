#!/usr/bin/env python3
import argparse
import urllib.parse
import os
import sys
import shutil
import subprocess
from ruamel import yaml

yaml.rload = lambda *z: yaml.load(*z, Loader=yaml.RoundTripLoader)
yaml.rdump = lambda *z: yaml.dump(*z, Dumper=yaml.RoundTripDumper)

def main():
    template = yaml.rload(open('install.dist.yml'))

    # Parse the arguments once to look for the profile.
    args = parser(template, partial=True).parse_args()

    # If the profile exists, load that instead.
    if os.path.isfile(args.profile):
        template = yaml.rload(open(args.profile))

    # Reparse the arguments with new defaults.
    args = parser(template).parse_args()

    profile = generate_profile(template, args)
    yaml.rdump(profile, open(args.profile, 'w'))

def generate_profile(profile, args):
    profile['config']['xmpp']['domain'] = args.domain

    args.protocol = args.protocol or ((args.websocket and 'ws' or 'http') + (args.secure and 's' or ''))
    args.host = args.host or args.domain
    args.path = args.path or (args.websocket and '/websocket' or '/http-bind')
    args.port = args.port or str(5280 + args.secure)

    profile['config']['xmpp']['url'] = args.url or args.protocol + '://' + args.host + ':' + args.port + args.path

    profile['config']['xmpp']['muc'] = args.muc or 'conference.' + args.domain

    packs = {folder for folder in os.listdir('emoticon-packs')
            if os.path.isfile('emoticon-packs/{}/emoticons.yml'.format(folder))}
    profile['install']['packs'] = sorted(packs)

    styles = {x[:-4] for x in os.listdir('assets/css/alt/') if x[-4:] == '.css'}
    profile['install']['styles'] = sorted(styles)

    languages = {x[:-4] for x in os.listdir('locales/') if x[-4:] == '.yml'}
    profile['install']['languages'] = sorted(languages)

    return profile


def parser(defaults, partial=False):
    domain = defaults['config']['xmpp']['domain']
    url = urllib.parse.urlparse(defaults['config']['xmpp']['url'] or '')

    #m = re.match('^(?:\[(?P<ip6>.*)\]|(?P<host>.*))(?::(?P<port>\d+))', url.netloc)

    websocket = url.scheme in ('ws', 'wss')
    secure = url.scheme in ('wss', 'https')
    custom_scheme = url.scheme not in ('ws', 'wss', 'http', 'https')
    custom_port = url.port not in (5280, 5281)
    custom_path = url.path not in ('/websocket', '/http-bind')
    custom_host = url.hostname != domain

    muc = defaults['config']['xmpp']['muc']
    custom_muc = domain and (muc != 'conference.' + domain)
    parser = argparse.ArgumentParser(
      prog='./configure.py',
      description='''Configure cadence for installation.
    '''
      )
    parser.add_argument(
      '-s', '--secure', '--https', action='store_const',
      help='Generate secure URLs (append "s" and increment port number)', dest='secure', const=True, default=secure
      )
    parser.add_argument(
      '-ws', '--websocket', action='store_const',
      help='Use websocket instead of BOSH', dest='websocket', const=True, default=websocket
      )
    parser.add_argument(
      '--domain', type=str,
      help='XMPP domain to log in on.', dest='domain', metavar='DOMAIN', required=not partial and not domain,
      default=domain
      )
    parser.add_argument(
      '--protocol', type=str,
      help='Protocol\n[(ws|http)s?]', dest='protocol', metavar='PROTOCOL', default=custom_scheme and url.scheme or ''
      )
    parser.add_argument(
      '--host', type=str,
      help='Hostname\n[DOMAIN]', dest='host', metavar='HOST', default=custom_host and url.hostname or ''
      )
    parser.add_argument(
      '--port', type=str,
      help='Port\n[5280|5281]', dest='port', metavar='PORT', default=custom_port and url.port or ''
      )
    parser.add_argument(
      '--path', type=str,
      help='Path\n[/http-bind|/websocket]', dest='path', metavar='PATH', default=custom_path and url.path or ''
      )
    parser.add_argument(
      '--url', '--bosh', type=str,
      help='Socket URL to connect to [PROTOCOL://HOST:PORT/PATH]', metavar='URL', dest='url', default=''
      )
    parser.add_argument(
      '--session-auth', type=str,
      help='The URL to use for session authentication.', metavar='AUTH', dest='session_auth', default=defaults['config']['xmpp']['sessionAuth']
      )
    parser.add_argument(
      '--muc', type=str,
      help='The MUC conference server to connect to.', metavar='MUC', dest='muc', default=custom_muc and muc or ''
      )
    parser.add_argument(
      '--profile', type=str,
      help='Where to put the configuration file. ["install.yml"]', dest='profile', default='install.yml'
    )

    return parser

main()
