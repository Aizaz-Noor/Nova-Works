"""Create a new source-only NovaWorks delivery; never modifies the source checkout."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import subprocess
from datetime import datetime, timezone

source = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1]).resolve()
if target.exists() or target == source or source in target.parents:
    raise SystemExit('Destination must be a new directory outside the source checkout.')
roots = ['app/client', 'backend', 'api', 'scripts', 'docs', '.github']
root_files = ['package.json', 'package-lock.json', 'README.md', 'START-NOVAWORKS.cmd', '.gitignore',
              '.dockerignore', '.vercelignore', 'Dockerfile', 'vercel.json', 'LICENSE']
excluded = {'.git', 'node_modules', 'dist', 'build', 'tmp', 'coverage',
            'private-config', '.agents', '.codex', '__pycache__'}
blocked_suffixes = {'.sqlite', '.sqlite3', '.db', '.log', '.mp4', '.webm',
                    '.pem', '.key', '.crt', '.cer', '.pyc', '.zip'}
selected = []

def visit(directory):
    for item in sorted(directory.iterdir()):
        rel = item.relative_to(source)
        if item.name in excluded or rel.as_posix() == 'docs/assets':
            continue
        if item.is_symlink() or (hasattr(item, 'is_junction') and item.is_junction()):
            raise SystemExit(f'Review required for source link: {rel}')
        if item.is_dir():
            visit(item)
        elif item.is_file():
            if item.name.startswith('.env') and item.name != '.env.example':
                continue
            if item.suffix.lower() in blocked_suffixes or any(x in item.name for x in ['-wal', '-shm']):
                # This pinned certificate is public, not a private credential.
                if rel.as_posix() != 'backend/certs/supabase-root.pem':
                    continue
            selected.append(item)

for root in roots:
    if (source / root).is_dir():
        visit(source / root)
for name in root_files:
    item = source / name
    if item.is_symlink():
        raise SystemExit(f'Review required for root link: {name}')
    if item.is_file():
        selected.append(item)
target.mkdir(parents=True)
records = []
for item in selected:
    rel = item.relative_to(source)
    dest = target / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(item, dest)
    digest = hashlib.sha256(item.read_bytes()).hexdigest()
    if hashlib.sha256(dest.read_bytes()).hexdigest() != digest:
        raise SystemExit(f'Copy verification failed: {rel}')
    records.append({'path': rel.as_posix(), 'sha256': digest})
for record in records:
    if hashlib.sha256((source / record['path']).read_bytes()).hexdigest() != record['sha256']:
        raise SystemExit(f'Source changed during export; delivery incomplete: {record["path"]}')
def git(*args):
    result = subprocess.run(['git', '-C', str(source), *args], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None

(target / 'SOURCE_MANIFEST.json').write_text(json.dumps({
    'description': 'Source-only snapshot of current authorized working tree; originals preserved.',
    'createdUtc': datetime.now(timezone.utc).isoformat(),
    'sourceHead': git('rev-parse', 'HEAD'),
    'includesUncommittedWork': bool(git('status', '--porcelain')),
    'excludedDirectories': sorted(excluded | {'docs/assets'}),
    'excludedSuffixes': sorted(blocked_suffixes),
    'privateEnvironmentFilesExcluded': True,
    'files': records}, indent=2) + '\n', encoding='utf-8')
print(f'Copied and SHA256-verified {len(records)} source files to {target}')
