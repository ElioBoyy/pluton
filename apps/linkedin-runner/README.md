# LinkedIn runner (prototype)

Pluton's own LinkedIn automation, meant to replace Unipile. One Chromium profile per connected
account (its cookies are the session), always behind the same proxy, opened only while it works.

**Prototype.** It covers the hosted login (usable from a phone) and sending an invitation. It is
not wired into Pluton yet: the sequence engine still talks to Unipile.

LinkedIn's terms forbid automating its site, and accounts can be restricted. Try it on an account
you can afford to lose.

## Run

```bash
pnpm --filter @pluton/linkedin-runner exec playwright install chromium
RUNNER_TOKEN=change-me pnpm --filter @pluton/linkedin-runner start
```

| Variable | Default | Purpose |
|---|---|---|
| `RUNNER_TOKEN` | (none: every call refused) | Bearer token the app sends |
| `RUNNER_PORT` | `8790` | HTTP port |
| `RUNNER_DATA_DIR` | `data/linkedin` | Profiles (cookies) and per-account config. Keep it private |
| `RUNNER_LOGIN_URL` | `https://www.linkedin.com/login` | Login page (a local fake one for tests) |
| `RUNNER_HEADFUL` | | `1` shows the browser window, for debugging on a desktop |
| `RUNNER_DEBUG` | | `1` logs every tap, keystroke and frame |

## API (`Authorization: Bearer $RUNNER_TOKEN`)

- `POST /accounts/:id/login` `{ proxy?: { server, username?, password? }, locale?, timezone? }` →
  `{ url, expiresAt }`. Open `url` on the phone within 15 minutes. The proxy given the first time
  is kept for that account.
- `POST /accounts/:id/invite` `{ profileUrl, note? }` → `{ status: "sent" | "already_pending" |
  "already_connected" | "email_required" | "not_available" | "disconnected" }`. On an error, a
  screenshot of the page is saved as `<data>/<id>/last-error.png`.
- `DELETE /accounts/:id` forgets the account (profile and cookies).

## Testing on a real account

1. Start the runner with a proxy for the test account, ideally a residential one in its country.
2. `POST /accounts/test/login` with that proxy, open the link on your phone, sign in, pass
   LinkedIn's checks.
3. `POST /accounts/test/invite` with a profile you know, without a note first.
4. If it answers `not_available`, open `last-error.png`: LinkedIn has probably renamed a button
   (the names are in `src/invite.ts`).
