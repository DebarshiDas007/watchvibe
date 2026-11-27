# Buying the domain: everything in one place

Checked on 2026-11-28 with the registry lookup (RDAP). "Not registered" means nobody owns it right now; it can still be taken before you pay, and this is not a trademark check.

## 1. Names that are not registered today

| Name | .com | .in | .app | Meaning / feel |
|---|---|---|---|---|
| dekhovibe | not registered | not registered | not registered | "dekho" = look, watch (Hindi). Keeps "vibe", clearly for India |
| tonightreel | not registered | not registered | not registered | says what the site does: what to watch tonight |
| pardapick | not registered | not registered | - | "parda" = screen. Short, playful |
| cosyreel | not registered | - | - | soft, comfort-watching mood |
| binjio | not registered | - | - | short, invented, easy to say |
| watchvibe | taken | - | not registered | your current name (watchvibe.com and .net are taken) |
| reelvibe.in, filmvibe.in | - | taken | - | skip |

You said you want a name different from WatchVibe, so the .app of the current name is only a fallback.

## 2. Suggested choice

- First pick: **dekhovibe.com** (also buy **dekhovibe.in** so nobody else sits on it). Fits an India-first audience and keeps the "vibe" idea.
- Second pick: **tonightreel.com**. Most descriptive for people who do not know the brand.
- Before paying, search the name in Google, Instagram, X and YouTube to see that it is not someone else's brand, and check the Play Store / App Store if you plan an app.

## 3. Where to buy

**Cloudflare Registrar** (you already use Cloudflare for the site): sells at cost, no renewal surprise, free WHOIS privacy, DNS is already there, and the domain attaches to the Pages project in a few clicks.
Prices (check at checkout, they change): .com about $10 to $11 a year, .app about $13 to $15, .in roughly the same as other country names.

Steps (you do these, it involves payment and your account):
1. Sign in to dash.cloudflare.com with your own account.
2. Left menu: Domain Registration, then Register Domains. Search the name.
3. Add to cart, check the price and the renewal price, pay (card or UPI where offered).
4. Turn on auto-renew and two-step verification on the Cloudflare account.
5. Tell me the name when it shows under "Manage Domains".

## 4. What I do after you tell me the name

- Change the address everywhere: `scripts/seo.config.json` (siteUrl), the canonical / og:url / og:image / twitter:image / JSON-LD in `index.html`, `/privacy`, `/terms`, sitemap, robots.
- If you rename the product: site title, logo text, install name in `manifest.json`, share image, legal pages, footer, the credit line.
- Add the redirect from watchvibe-b92.pages.dev to the new domain.
- Deploy, then check the live pages (home, a film page, a best list, sitemap, robots) on the new address.
- Attach the domain to the Pages project (needs your Cloudflare sign-in; I will tell you the exact clicks, or do it if you give me a scoped API token).

## 5. What you do (sign-ins and settings)

1. **Supabase** (your dashboard): Authentication, URL Configuration: set Site URL to the new address and add it (and `/*`) to Redirect URLs. Keep the old address there for a few weeks.
2. **Google Cloud** (OAuth client used for Google sign-in): add the new address under Authorised JavaScript origins and the Supabase callback stays as it is. Update the OAuth consent screen name and homepage / privacy / terms links.
3. **Google Search Console**: add the new domain as a property (Cloudflare DNS makes the TXT verification one click), submit `https://<new>/sitemap.xml`, then URL Inspection, Request indexing for the home page. Keep the old property for the move.
4. **Supabase leaked-password protection** toggle (Authentication, Providers or Policies; may need a paid plan).
5. **2-step verification** on the admin Google account.
6. Confirm the contact email shown on the legal pages (it is your Gmail now).

## 6. Order that avoids trouble

1. Pick and buy the domain.
2. I prepare and deploy the code changes with both addresses working (old redirects to new).
3. You update Supabase and Google settings.
4. You submit the sitemap in Search Console.
5. Test sign-in with Google and with email on the new address.
6. After about 4 weeks with no problems, remove the old address from the settings.
