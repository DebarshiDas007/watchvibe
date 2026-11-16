@echo off
set "PATH=C:\Users\USER\.gemini\antigravity\scratch\tools\gh\bin;C:\Users\USER\.gemini\antigravity\scratch\tools\git\cmd;%PATH%"
echo Launching GitHub CLI login in browser...
"C:\Users\USER\.gemini\antigravity\scratch\tools\gh\bin\gh.exe" auth login --web -h github.com -p https
pause
