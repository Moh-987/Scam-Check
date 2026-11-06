# 🛡️ ScamCheck

Helps people spot warning signs of online scams *before* they click, reply, or send money.
Upload a screenshot, paste text, or enter a link → get a simple risk level
(**Low Concern / Suspicious / High Risk**), a "Why was this flagged?" breakdown with the
suspicious parts highlighted, and safe next steps. Includes a Learn section with a quiz,
English + Arabic (right-to-left), read-aloud, and a larger-text button.

ScamCheck never says something is "definitely a scam" or "definitely safe" and always tells
people to verify through official channels.

## How it works

```
public/        the website (plain HTML/CSS/JS, no build step)
api/analyze.js small server function that calls Claude. Your API key lives ONLY here.
```

GitHub Pages can't hide an API key, so the AI call runs in a tiny free serverless function.
The simplest setup is to deploy **everything on Vercel** (free "Hobby" plan), straight from this GitHub repo.

## Put it on GitHub

1. Create a new repo on github.com (e.g. `scamcheck`).
2. Upload all files from this folder (or `git init && git add . && git commit && git push`).
   `.env` is git-ignored, so keys never get uploaded.

## Deploy (about 5 minutes)

1. Get an Anthropic API key at <https://console.anthropic.com> (pay-as-you-go; set a low monthly spend limit).
2. Go to <https://vercel.com>, sign in with GitHub → **Add New → Project** → pick the `scamcheck` repo.
3. Before deploying, open **Environment Variables** and add `ANTHROPIC_API_KEY` = your key.
4. Click **Deploy**. Vercel gives you a link like `https://scamcheck.vercel.app`. Share it.

Every future push to GitHub redeploys automatically.

### Optional: front end on GitHub Pages instead
Deploy as above (the function needs a home), then in `public/config.js` set
`window.SCAMCHECK_API = "https://YOUR-PROJECT.vercel.app/api/analyze";`, enable
**Settings → Pages** with the `public` folder as source (or via a GitHub Action), and set the
Vercel env var `ALLOWED_ORIGIN=https://YOURNAME.github.io` so only your site can use the function.

## Run it on your computer

```bash
npm i -g vercel
cp .env.example .env     # then put your real key in .env
vercel dev               # opens http://localhost:3000
```

## Privacy

- Nothing is saved: no database, no logs of message content. The browser resizes screenshots
  (which also removes photo metadata such as GPS) and sends them to the function, which forwards
  them to Claude for analysis and returns the result.
- Links are **never opened**; only the address text is examined.
- The only thing kept in the browser is the chosen language (`localStorage`).
- Anthropic processes the content under its API terms; see <https://www.anthropic.com/legal/privacy>.

## Customising

- Text and Arabic translations: `public/i18n.js` (add quiz questions there too).
- Look and feel: `public/style.css`.
- What the AI looks for and how it talks: the `SYSTEM` prompt in `api/analyze.js`.
- Model: set `ANTHROPIC_MODEL` env var.

## Good ideas for later
More languages, a rate limit (e.g. Vercel KV / Upstash) to cap costs, report-a-scam links for her country, offline-friendly PWA.
