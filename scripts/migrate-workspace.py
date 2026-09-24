#!/usr/bin/env python3
"""Copy local workspace files to an existing matching checkout; preview by default."""
import argparse
import filecmp
import os
from pathlib import Path
import shutil
import subprocess
import sys


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--destination', type=Path, default=Path('/Users/steve/_projects/Active/dekorte.com/fun/TRON'))
    parser.add_argument('--apply', action='store_true', help='Copy files after the complete conflict check')
    args = parser.parse_args()
    source, destination = args.source.resolve(), args.destination.resolve()
    if source == destination or source in destination.parents or destination in source.parents:
        parser.error('Source and destination must be separate, non-nested directories.')
    for root in (source, destination):
        if Path(os.fsdecode(git(root, 'rev-parse', '--show-toplevel')).strip()).resolve() != root:
            parser.error(f'Not a checkout root: {root}')
    if git(source, 'rev-parse', 'HEAD') != git(destination, 'rev-parse', 'HEAD'):
        parser.error('Checkouts must have matching commits. Commit/push and update the submodule first.')
    for root in (source, destination):
        if git(root, 'status', '--porcelain', '--untracked-files=no').strip():
            parser.error(f'Tracked changes in {root}; commit or preserve them before migration.')

    # Git enumerates ignored files too, without traversing tracked submodules.
    paths = set()
    for options in [[], ['--ignored']]:
        paths.update(os.fsdecode(p) for p in git(source, 'ls-files', '--others', '--exclude-standard', '-z', *options).split(b'\0') if p)
    pending, conflicts = [], []
    for name in sorted(paths):
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts or '.git' in relative.parts:
            continue
        src, dst = source / relative, destination / relative
        # Do not follow destination symlink directories out of the checkout.
        if any(parent.is_symlink() for parent in dst.parents if parent != destination and destination in parent.parents):
            conflicts.append(name)
            continue
        if src.is_dir() and not src.is_symlink():
            conflicts.append(name)  # Nested repositories need separate handling.
            continue
        if os.path.lexists(dst):
            same = (src.is_symlink() and dst.is_symlink() and os.readlink(src) == os.readlink(dst))
            if not src.is_symlink() and not dst.is_symlink() and src.is_file() and dst.is_file():
                same = filecmp.cmp(src, dst, shallow=False)
            if not same:
                conflicts.append(name)
        else:
            pending.append((src, dst))
    if conflicts:
        print('No files copied. Resolve differing destination files first:')
        for name in conflicts:
            print(' ', name)
        return 1
    counts = {}
    for src, _ in pending:
        category = src.relative_to(source).parts[0]
        counts[category] = counts.get(category, 0) + 1
    print(f'{len(pending)} missing files to copy (contents and credentials are never printed):')
    for name, count in sorted(counts.items()):
        print(f'  {name}: {count}')
    if not args.apply:
        print('Preview only. Run again with --apply to copy; no source files will be removed.')
        return 0
    for src, dst in pending:
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_symlink():
            dst.symlink_to(os.readlink(src))
        else:
            # Exclusive creation prevents overwriting files created since preflight.
            with src.open('rb') as reader, dst.open('xb') as writer:
                shutil.copyfileobj(reader, writer)
            shutil.copystat(src, dst)
    print('Copied successfully. Original checkout and all Git metadata were preserved.')
    print('Codex session history remains in your existing Codex home; resume the same session at the destination.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
