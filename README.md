# Salsa Moves Website

A static website for browsing salsa moves scraped from salsalap.hu.

The app itself is frontend-only (HTML/CSS/JS). Python is only needed for refreshing the move data JSON.

## Project files

- `index.html`: Main page.
- `style.css`: Visual design and responsive layout.
- `app.js`: Loads JSON, filters, sorting, and rendering.
- `scrape_salsalap_salsa.py`: Scraper to regenerate move data.
- `salsa_moves.json`: Dataset used by the website.
- `salsa_moves_vscode.json`: Alternate data export with extra details.

## Quick start (view website only)

1. Open a terminal in this project folder.
2. Start a local web server:

```bash
python -m http.server 8000
```

3. Open http://localhost:8000/

Note: Do not open `index.html` directly using file:// because browser fetch restrictions can block JSON loading.

## Setup for scraping data (macOS)

### 1. Install Python

- Recommended: Python 3.10+ from https://www.python.org/downloads/macos/

### 2. Install uv (recommended)

If Homebrew is installed:

```bash
brew install uv
```

If you do not use Homebrew, see: https://docs.astral.sh/uv/getting-started/installation/

### 3. Create and activate a virtual environment

```bash
uv venv
source .venv/bin/activate
```

### 4. Install scraper dependencies

```bash
uv pip install requests beautifulsoup4
```

### 5. Run the scraper

```bash
python scrape_salsalap_salsa.py
```

This regenerates `salsa_moves.json`.

## Setup for scraping data (Windows)

### 1. Install Python

- Recommended: Python 3.10+ from https://www.python.org/downloads/windows/
- During install, enable Add Python to PATH.

### 2. Install uv (recommended)

Using Winget (PowerShell):

```powershell
winget install --id=astral-sh.uv -e
```

Alternative install options: https://docs.astral.sh/uv/getting-started/installation/

### 3. Create and activate a virtual environment

PowerShell:

```powershell
uv venv
.\.venv\Scripts\Activate.ps1
```

Command Prompt:

```bat
uv venv
.\.venv\Scripts\activate.bat
```

If PowerShell blocks script activation, run this once in the same shell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 4. Install scraper dependencies

```powershell
uv pip install requests beautifulsoup4
```

### 5. Run the scraper

```powershell
python scrape_salsalap_salsa.py
```

This regenerates `salsa_moves.json`.

## Fallback setup without uv

If you prefer plain Python venv + pip:

```bash
python -m venv .venv
```

Activate it:

- macOS/Linux: `source .venv/bin/activate`
- Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
- Windows CMD: `.\.venv\Scripts\activate.bat`

Then install dependencies:

```bash
pip install requests beautifulsoup4
```

## Deploy notes

Because this is a static site, it can be deployed directly to Netlify (or similar static hosting) with no build command.
