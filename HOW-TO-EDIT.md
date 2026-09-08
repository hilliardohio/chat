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
- The Claude API key — stored in Workers KV, set through the `/admin` page

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
