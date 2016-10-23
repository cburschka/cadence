#!/usr/bin/env python3

from ruamel import yaml
import subprocess

def copy(dst, *src):
    subprocess.run(['mkdir', '-p', dst])
    subprocess.run(['cp', '-au', *src, dst])

profile = yaml.load(open('install.yml'))['install']

target = profile['target']
if target:
    copy(target, 'index.html', 'emoticons.js')

cdn_target = profile['cdn']['target'] or target
if cdn_target:
    copy(cdn_target, 'assets', 'lib')
