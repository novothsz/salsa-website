# Salsa Moves Website

A static website for browsing salsa moves scraped from salsalap.hu.

The app itself is frontend-only (HTML/CSS/JS). Python is only needed for refreshing the move data JSON.

## Project files

- `index.html`: Main page.
- `style.css`: Visual design and responsive layout.
- `app.js`: Loads JSON, filters, sorting, and rendering.
- `auth-config.js`: Frontend auth configuration for Google sign-in and approval checks.
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

## Member-only videos (Google sign-in + admin approval)

This branch supports hiding video links unless the user is both:

1. Signed in with Google.
2. Approved by an admin.

### Beginner quick start (5-10 minutes)

If you are completely new to auth, follow only these steps first:

1. Create a Supabase project (free tier is fine).
2. Open `auth-config.js` and set:
	- `enabled: true`
	- your `supabaseUrl`
	- your `supabaseAnonKey`
3. In Supabase dashboard, enable Google provider:
	- Authentication -> Providers -> Google
4. In Supabase Google provider settings, add this redirect URL:
	- `http://localhost:8000/`
5. Run the site locally and reload.
6. Click the setup/sign-in button in the Member Access banner.

If the sign-in button says Setup Google sign-in, it means configuration is not finished yet.

### 1. Configure Supabase auth values

Edit `auth-config.js`:

```js
window.SALSA_AUTH_CONFIG = {
	enabled: true,
	supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
	supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
	profileTable: 'profiles',
	userIdColumn: 'user_id',
	approvalColumn: 'approved',
	rejectedColumn: ''
};
```

Important:

- Use only the anon/public key in this file.
- Never put Supabase service-role keys in frontend code.
- Keep this file local/private if you prefer not to commit environment values.

### 2. Enable Google provider in Supabase

In Supabase Dashboard:

1. Authentication -> Providers -> Google -> Enable.
2. Set OAuth client ID/secret from Google Cloud.
3. Add your site URL and callback URL exactly as Supabase requires.

### 3. Create approval table

Run SQL in Supabase SQL editor:

```sql
create table if not exists public.profiles (
	user_id uuid primary key references auth.users(id) on delete cascade,
	approved boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);
```

### 4. Approve users as admin

When a new user signs in, insert/update their profile row:

```sql
insert into public.profiles (user_id, approved)
values ('USER_UUID_HERE', true)
on conflict (user_id)
do update set approved = excluded.approved, updated_at = now();
```

### 5. Behavior in this app

- Not signed in: video buttons show as locked.
- Signed in but not approved: still locked.
- Signed in and approved: `Open video` links appear and hover preview works.

### Troubleshooting sign-in button

- Button says Setup Google sign-in:
	- `auth-config.js` is still disabled or missing URL/key.
- Button says Retry auth setup:
	- Supabase script loaded, but auth setup is invalid or incomplete.
- Button says Sign in with Google but nothing happens:
	- Check browser console and ensure Google provider is enabled in Supabase.
	- Verify Supabase redirect URL matches your local URL exactly.

## Security note for YouTube links

This setup hides links from unapproved users on the site, but if you use unlisted YouTube URLs, approved users can still share those links.

For stronger protection later:

1. Keep videos in private storage.
2. Serve short-lived signed URLs from a backend function.
3. Keep authorization checks server-side.

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
