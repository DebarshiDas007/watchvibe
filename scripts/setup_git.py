import os
import urllib.request
import zipfile

target_dir = r"C:\Users\USER\.gemini\antigravity\scratch\tools\git"
zip_path = r"C:\Users\USER\.gemini\antigravity\scratch\tools\mingit.zip"

os.makedirs(os.path.dirname(target_dir), exist_ok=True)
url = "https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/MinGit-2.44.0-64-bit.zip"

if not os.path.exists(os.path.join(target_dir, "cmd", "git.exe")):
    print(f"Downloading MinGit from {url}...")
    opener = urllib.request.build_opener()
    opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
    urllib.request.install_opener(opener)
    urllib.request.urlretrieve(url, zip_path)
    print("Download complete. Extracting...")
    os.makedirs(target_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_dir)
    print("Extraction complete.")
    if os.path.exists(zip_path):
        os.remove(zip_path)

git_cmd = os.path.join(target_dir, "cmd", "git.exe")
print("Git executable:", git_cmd, "Exists:", os.path.exists(git_cmd))
