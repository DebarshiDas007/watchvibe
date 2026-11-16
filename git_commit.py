import subprocess
import os

repo_dir = r"C:\Users\USER\.gemini\antigravity\scratch\watchvibe"
git_exe = r"C:\Users\USER\.gemini\antigravity\scratch\tools\git\cmd\git.exe"

def run_git(args):
    res = subprocess.run([git_exe] + args, cwd=repo_dir, capture_output=True, text=True)
    print(f"git {' '.join(args)} -> {res.returncode}")
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(res.stderr.strip())
    return res.returncode

run_git(["add", "."])
run_git(["commit", "-m", "feat: initial commit with Mimicore auth, Cloudflare CLI deploy, and handoff docs"])
run_git(["status"])
run_git(["log", "-n", "1"])
