# Salsa Website

A small static website for browsing salsa moves scraped from https://salsalap.hu/videotar/salsa.

## Files in this project

- `scrape_salsalap_salsa.py` — scraper that collects salsa move data.
- `salsa_moves.json` — generated data file used by the website.
- `index.html` — main page.
- `style.css` — styling.
- `app.js` — frontend logic for loading and filtering the moves.

## 1. Create a Python environment with uv

If you do not have uv installed yet on macOS:

```bash
brew install uv
```

From the project folder:

```bash
cd /Users/szilard/Documents/Python/salsa_website
uv venv
source .venv/bin/activate
```

## 2. Install dependencies with uv

This project needs `requests` and `beautifulsoup4` for scraping.

```bash
uv pip install requests beautifulsoup4
```

If you want to save the dependencies to a requirements file:

```bash
uv pip freeze --requirements-txt > requirements.txt
```

## 3. Run the scraper

```bash
python scrape_salsalap_salsa.py
```

This will regenerate:

- `salsa_moves.json`

## 4. Test the website locally

Do **not** open `index.html` directly with `file:///...` in the browser, because `fetch()` may fail when trying to load `salsa_moves.json`.

Instead, start a local server from the project folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## 5. Upload to GitHub with GitHub CLI

### First-time GitHub CLI authentication

If needed:

```bash
gh auth login
```

Follow the prompts and authenticate with your GitHub account.

### Create a new repo from this existing folder and push it

From the project folder:

```bash
cd /Users/szilard/Documents/Python/salsa_website
```

Initialize git if needed:

```bash
git init
git branch -M main
```

Create a `.gitignore` so the virtual environment is not uploaded:

```bash
cat > .gitignore <<'GITIGNORE'
.venv/
__pycache__/
.DS_Store
GITIGNORE
```

Stage and commit everything:

```bash
git add .
git commit -m "Initial commit: salsa website"
```

Create a new **private** GitHub repo from this folder and push it:

```bash
gh repo create salsa-website --private --source=. --remote=origin --push
```

If you want it to be public instead:

```bash
gh repo create salsa-website --public --source=. --remote=origin --push
```

## 6. Upload without GitHub CLI (web + git)

If you prefer, create an empty repository on github.com first, then run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit: salsa website"
git remote add origin https://github.com/YOUR_USERNAME/salsa-website.git
git push -u origin main
```

## 7. Deploy to Netlify later

After the repo is on GitHub, you can:

1. Sign in to Netlify.
2. Choose **Add new site** -> **Import an existing project**.
3. Select your GitHub repository.
4. Leave the build command empty.
5. Use the repository root as the publish directory.

Because this is a static site, Netlify can serve it directly.
