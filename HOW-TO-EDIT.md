# Hilliard Assistant — how to make changes from any computer

Everything needed to run and change the assistant lives in this repository. Nothing is
stored only on one person's laptop. You can edit from City Hall, from home, or from a
borrowed machine with nothing installed but a browser.

## The two halves

| Piece | File | Where it runs | How it deploys |
|---|---|---|---|
| The web page residents use | `index.html` | GitHub Pages — <https://hilliardohio.github.io/chat/> | Automatically, ~1 min after you commit |
| The backend (Claude API key, permit lookups, admin page) | `worker.js` | Cloudflare Worker — `hilliard-assistant.ralley.workers.dev` | Automatically, ~1–2 min after you commit |
| Planning & Zoning master list | `projects.csv` | Served from GitHub Pages, read by the Worker | Automatically |
| Model legislation library (staff drafting) | `legislation-index.json` | Served from GitHub Pages, read by the Worker | Automatically |
| Worker settings (bindings, variables) | `wrangler.jsonc` | Cloudflare | Read on every deploy |

**Commit a change → it goes live.** There is no copy-and-paste step any more, and no way to
accidentally deploy a stale copy of a file.

## Editing in the browser (no installs)

1. Go to <https://github.com/hilliardohio/chat>.
2. Press the **`.`** key. GitHub opens a full VS Code editor in your browser.
3. Edit `index.html` or `worker.js`.
4. In the left sidebar, click the **Source Control** icon, type a short message describing
   the change, and click **Commit & Push**.
5. Wait a minute or two, then reload the chat page with a cache-buster:
   <https://hilliardohio.github.io/chat/?cb=1> (change the number each time).

For a one-line fix you can skip the editor: open the file on GitHub, click the pencil icon,
edit, and **Commit changes**.

## Watching a deploy

- **Worker:** Cloudflare dashboard → Workers & Pages → `hilliard-assistant` → **Deployments**
  → *View build history*. A red build means the Worker did **not** change; the previous
  version keeps serving, so a broken commit cannot take the assistant down.
- **Web page:** GitHub → **Actions** tab. A green check means it is live.

## Undoing a bad change

- **Worker:** Cloudflare → `hilliard-assistant` → **Deployments** → find the previous version
  → **Rollback**. Takes about ten seconds and does not require touching the repo.
- **Web page:** In GitHub, open the file, click **History**, open the good version, and use
  the **Revert** option — or just commit a fix.

## What is NOT in this repository, on purpose

These are stored encrypted on the Worker itself and survive every deploy. They are never in
the repo, never in the browser, and never visible to residents:

- `ADMIN_PASSWORD` — password for the `/admin` page
- `OPENGOV_API_KEY` — OpenGov Permitting & Licensing API token
- `STAFF_PASSWORD` — unlocks legislation drafting for City staff
- The Claude API key — stored in Workers KV, set through the `/admin` page

## Staff legislation drafting

Staff can draft Council ordinances and resolutions in the chat: tick **Staff mode** under
the message box, enter the staff password, and describe what's needed. The draft and its
staff report each come back with a Word download button.

Two things are worth understanding about how this is gated. The staff-mode checkbox is a
display setting stored in the visitor's own browser — it proves nothing and unlocks nothing
on its own. What actually unlocks drafting is the `STAFF_PASSWORD` secret, which the Worker
checks on every single request. The password is held in `sessionStorage`, so it clears when
the tab closes.

It is a *shared* password, which means no record of who drafted what. That is the main
reason to move to Cloudflare Access with real city accounts if this gets used beyond a
couple of people.

Drafts are modeled on real adopted legislation from `legislation-index.json`. To add more
model types, that file needs rebuilding from the CivicWeb Document Center — ask Claude to
do it. Any fact not supplied comes back as a `[[NEEDS CONFIRMATION: …]]` marker rather than
an invented parcel number, and every draft goes to the Law Director before Council.

To change any of them, use the Cloudflare dashboard (Worker → Settings → *Variables and
Secrets*) or the assistant's own `/admin` page. Never paste a key into a file in this repo.

## Things you can change without touching code

Open `https://hilliard-assistant.ralley.workers.dev/admin` and sign in with the admin
password:

- **Knowledge base** — the facts the assistant answers from. Takes effect immediately.
- **Topic overrides** — fixed answers or extra guidance for specific subjects.
- **Claude API key and model**
- **Planning & Zoning list** — point it at a different CSV, or paste new data
- **Chat log** — what residents have asked

Changes made in `/admin` are stored in Cloudflare KV, not in this repo, so they are not
version-controlled. Anything you want a record of belongs in the knowledge base section of
`worker.js` instead.

## Careful with `wrangler.jsonc`

Cloudflare treats that file as the truth on every deploy. If a KV binding or a variable is
removed from it, it is removed from the running Worker — which would disconnect the
assistant from its stored knowledge base and API key. Leave the `kv_namespaces` block alone
unless you know exactly what you are changing.

## Working with Claude from home

Install the Claude desktop app on the home machine, clone or download this repository into a
folder, and point Cowork at that folder. Claude can then read and edit the same files. Pull
the latest changes before you start and commit when you finish, so the two machines never
drift apart.
