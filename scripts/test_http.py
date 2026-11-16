import urllib.request

req = urllib.request.Request('http://localhost:8080/', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        print('HTTP Status:', resp.status)
        print('HTML Length:', len(html))
        print('Has mimicore-card:', 'mimicore-card' in html)
        print('Has auth-btn google:', 'auth-btn google' in html)
        print('Has mimicoreEmailBox:', 'mimicoreEmailBox' in html)
        print('Has Continue with Google:', 'Continue with Google' in html)
        print('Has Continue with Discord:', 'Continue with Discord' in html)
        print('Has Continue with email:', 'Continue with email' in html)
except Exception as e:
    print('Error:', e)
