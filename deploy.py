# -*- coding: utf-8 -*-
import subprocess
import os
import sys

def deploy():
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(repo_dir, 'web_live_build')
    
    # Candidate locations for wrangler / nodejs
    candidate_tools = [
        r'C:\Users\USER\.gemini\antigravity\scratch\tools\nodejs',
        os.path.join(repo_dir, 'tools', 'nodejs'),
        r'D:\tools\nodejs'
    ]
    tools_dir = next((d for d in candidate_tools if os.path.exists(os.path.join(d, 'wrangler.cmd'))), candidate_tools[0])
    wrangler_cmd = os.path.join(tools_dir, 'wrangler.cmd')
    env_file = os.path.join(repo_dir, '.env')

    # Load from .env if present
    api_token = os.environ.get('CLOUDFLARE_API_TOKEN')
    account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '1e1e9dd88e0400bb9afff0d37c72717d')

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
    env['PATH'] = tools_dir + ';' + env.get('PATH', '')
    env['CLOUDFLARE_API_TOKEN'] = api_token
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
