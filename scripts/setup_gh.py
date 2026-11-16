import os
import subprocess
import zipfile

target_dir = r"C:\Users\USER\.gemini\antigravity\scratch\tools\gh"
zip_path = r"C:\Users\USER\.gemini\antigravity\scratch\tools\gh.zip"

gh_exe = os.path.join(target_dir, "bin", "gh.exe")
if not os.path.exists(gh_exe):
    url = "https://github.com/cli/cli/releases/download/v2.45.0/gh_2.45.0_windows_amd64.zip"
    print(f"Downloading GitHub CLI with curl.exe from {url}...")
    res = subprocess.run(["curl.exe", "-L", "-o", zip_path, url], capture_output=True, text=True)
    if res.returncode != 0:
        print("curl failed:", res.stderr)
    else:
        print("Downloaded. Extracting...")
        os.makedirs(target_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(target_dir)
        print("Extraction complete.")
        if os.path.exists(zip_path):
            os.remove(zip_path)

for root, dirs, files in os.walk(target_dir):
    if "gh.exe" in files:
        found = os.path.join(root, "gh.exe")
        print("Found gh.exe at:", found)
        # Test running gh.exe
        proc = subprocess.run([found, "--version"], capture_output=True, text=True)
        print(proc.stdout)
