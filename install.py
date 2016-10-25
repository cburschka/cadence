#!/usr/bin/env python3

from ruamel import yaml
import subprocess
import sys

def main(filename):
    profile = yaml.load(open(filename))['install']

    target = profile['target']
    if target:
        copy(target, 'index.html')

    cdn_target = profile['cdn']['target'] or target
    if cdn_target:
        copy(cdn_target, 'assets', 'lib')


def run(args):
    print(*args)
    subprocess.run(args)

def copy(dst, *src):
    run(['mkdir', '-p', dst])
    run(['cp', '-au', *src, dst])

main(sys.argv[1])
