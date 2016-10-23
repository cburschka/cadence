#!/usr/bin/env python3
import argparse
import os
import shutil
import subprocess
from ruamel import yaml

def main():
    args = parser().parse_args()
    template = yaml.load(open('install.dist.yml'), Loader=yaml.RoundTripLoader)
    config = generate_config(template, args)
    yaml.dump(config, open(args.profile, 'x'), Dumper=yaml.RoundTripDumper)

def generate_config(config, args):
    config['config']['xmpp']['domain'] = args.domain

    args.protocol = args.protocol or ((args.websocket and 'ws' or 'http') + (args.secure and 's' or ''))
    args.host = args.host or args.domain
    args.path = args.path or (args.websocket and '/websocket' or '/http-bind')
    args.port = args.port or str(5280 + args.secure)
    config['config']['xmpp']['url'] = args.url or args.protocol + '://' + args.host + ':' + args.port + args.path

    config['config']['xmpp']['muc'] = args.muc or 'conference.' + args.domain

    packs = {folder for folder in os.listdir('emoticon-packs')
            if os.path.isfile('emoticon-packs/{}/emoticons.yml'.format(folder))}
    config['install']['packs'] = sorted(packs)

    styles = {x[:-4] for x in os.listdir('assets/css/alt/') if x[-4:] == '.css'}
    config['install']['styles'] = sorted(styles)
    return config


def parser():
    parser = argparse.ArgumentParser(
      prog='./configure.py',
      description='''Configure cadence for installation.
    '''
      )
    parser.add_argument(
      '-s', '--secure', '--https', action='store_const',
      help='Generate secure URLs (append "s" and increment port number)', dest='secure', const=True, default=False
      )
    parser.add_argument(
      '-ws', '--websocket', action='store_const',
      help='Use websocket instead of BOSH', dest='websocket', const=True, default=False
      )
    parser.add_argument(
      '--domain', type=str,
      help='XMPP domain to log in on.', dest='domain', metavar='DOMAIN', required=True
      )
    parser.add_argument(
      '--protocol', type=str,
      help='Protocol\n[(ws|http)s?]', dest='protocol', metavar='PROTOCOL', default=''
      )
    parser.add_argument(
      '--host', type=str,
      help='Hostname\n[DOMAIN]', dest='host', metavar='HOST', default=''
      )
    parser.add_argument(
      '--port', type=str,
      help='Port\n[5280|5281]', dest='port', metavar='PORT', default=''
      )
    parser.add_argument(
      '--path', type=str,
      help='Path\n[/http-bind|/websocket]', dest='path', metavar='PATH', default=''
      )
    parser.add_argument(
      '--url', '--bosh', type=str,
      help='Socket URL to connect to [PROTOCOL://HOST:PORT/PATH]', metavar='URL', dest='url', default=''
      )
    parser.add_argument(
      '--session-auth', type=str,
      help='The URL to use for session authentication.', metavar='AUTH', dest='session_auth', default=''
      )
    parser.add_argument(
      '--muc', type=str,
      help='The MUC conference server to connect to.', metavar='MUC', dest='muc', default=''
      )

    parser.add_argument(
      '--profile', type=str,
      help='Where to put the configuration file. ["install.yml"]', dest='profile', default='install.yml'
    )

    return parser

main()
