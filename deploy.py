# -*- coding: utf-8 -*-
import subprocess
import os
import sys

def deploy():
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(repo_dir, 'web_live_build')
    
    # Locate wrangler: env override, a portable install, or whatever is on PATH.
    import shutil
    candidate_tools = [
        os.environ.get('WATCHVIBE_NODE_DIR', ''),
        os.path.join(repo_dir, 'tools', 'nodejs'),
        r'D:\tools\nodejs',
        r'C:\Users\USER\.gemini\antigravity\scratch\tools\nodejs',
    ]
    tools_dir = next((d for d in candidate_tools if d and os.path.exists(os.path.join(d, 'wrangler.cmd'))), None)
    wrangler_cmd = os.path.join(tools_dir, 'wrangler.cmd') if tools_dir else (shutil.which('wrangler') or shutil.which('wrangler.cmd'))
    if not wrangler_cmd:
        print("[ERROR] wrangler not found. Install it (npm i -g wrangler) or set WATCHVIBE_NODE_DIR.")
        sys.exit(1)
    env_file = os.path.join(repo_dir, '.env')

    # Load from .env if present
    api_token = os.environ.get('CLOUDFLARE_API_TOKEN')
    account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID')

    if not api_token and os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('CLOUDFLARE_API_TOKEN='):
                    api_token = line.split('=', 1)[1].strip().strip('"').strip("'")
                elif line.startswith('CLOUDFLARE_ACCOUNT_ID='):
                    account_id = line.split('=', 1)[1].strip().strip('"').strip("'")

    if not api_token:
        print("[ERROR] CLOUDFLARE_API_TOKEN is not set.")
        print("Please create an API Token at https://dash.cloudflare.com/profile/api-tokens with 'Cloudflare Pages: Edit' permission,")
        print(f"and save it in {env_file} as CLOUDFLARE_API_TOKEN=your_token")
        sys.exit(1)

    env = os.environ.copy()
    if tools_dir:
        env['PATH'] = tools_dir + ';' + env.get('PATH', '')
    env['CLOUDFLARE_API_TOKEN'] = api_token
    if account_id:
        env['CLOUDFLARE_ACCOUNT_ID'] = account_id

    cmd = [
        wrangler_cmd,
        'pages', 'deploy',
        build_dir,
        '--project-name', 'watchvibe',
        '--commit-dirty=true'
    ]

    print(f"[WatchVibe CLI] Deploying {build_dir} to Cloudflare Pages (project: watchvibe)...")
    proc = subprocess.run(cmd, env=env, text=True, capture_output=True)
    print(proc.stdout)
    if proc.stderr:
        print(proc.stderr, file=sys.stderr)

    if proc.returncode == 0:
        print("\n✨ Deployment completed successfully!")
        print("Live Production URL: https://watchvibe-b92.pages.dev/")
    else:
        print(f"\n❌ Deployment exited with code {proc.returncode}")
        sys.exit(proc.returncode)

if __name__ == '__main__':
    deploy()
