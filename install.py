#!/usr/bin/env python3

from ruamel import yaml
import subprocess

def run(args):
    print(*args)
    subprocess.run(args)

def copy(dst, *src):
    run(['mkdir', '-p', dst])
    run(['cp', '-au', *src, dst])

profile = yaml.load(open('install.yml'))['install']

target = profile['target']
if target:
    copy(target, 'index.html')

cdn_target = profile['cdn']['target'] or target
if cdn_target:
    copy(cdn_target, 'assets', 'lib')
