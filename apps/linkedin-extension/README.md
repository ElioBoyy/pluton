# Pluton LinkedIn extension

Does Pluton's LinkedIn visits and invitations from the founder's own Chrome: their address, their
LinkedIn session, no proxy and no hosted login. Steps run only while Chrome is open, one at a time,
each in a tab opened in the background and closed afterwards. Nothing is started from the
extension: Pluton queues the steps, the extension takes them when it checks in (every 30 s).

LinkedIn's terms forbid browser extensions that automate its site, and accounts can be restricted.

## For users

Settings → LinkedIn accounts → **Download the extension** gives a zip set to talk to that Pluton
(the server writes its own address into `config.json` and the manifest). The install guide is at
`/docs/linkedin`: unzip, `chrome://extensions` → Developer mode → Load unpacked, sign in to
LinkedIn, then paste the popup's token in Pluton and click **Pair**.

## Build

```bash
pnpm --filter @pluton/linkedin-extension build        # dist/, for https://app.plut0n.com
pnpm --filter @pluton/linkedin-extension dev          # dist/, for http://localhost:8787, and acts on http://localhost profiles
node apps/linkedin-extension/build.mjs --api=https://pluton.example.com   # another Pluton
```

The server zips `dist/` on `GET /api/extension/linkedin/download`, so it must be built where the
server runs (`pnpm build` does it).

An invitation is two steps. On the profile, the extension reads where things stand from LinkedIn's
icons (`svg#clock-outline-small` pending, `svg#person-plus-outline-small` or a
`/preload/custom-invite/` link for Connect, on the card or under More), only within the card that
holds the contact info link: "People you may know" further down has Connect buttons too. Then, if
Connect is there, it opens `/preload/custom-invite/?vanityName=…`, which shows the invitation dialog
straight away (it does so even for someone pending or connected, hence the profile first), and sends
it through its classes: `artdeco-button--secondary` adds a note, `textarea#custom-message` takes it,
`artdeco-button--primary` sends. None of these change with the interface's language; button names in
English and French are the fallback. More opens on a plain click: the full pointer sequence can open
and close it again on a page still loading. If invitations fail with "not_available", LinkedIn has
probably changed one of these: they are at the top of `src/invite.ts`.

## Files

- `src/background.ts`: the worker. Makes the token, checks in with Pluton, opens each profile in a
  background tab, runs the step, closes the tab, reports the result, keeps the last 20.
- `src/invite.ts`: runs in the profile tab. Finds Connect (or More → Connect), adds the note by
  typing it, sends.
- `src/popup.ts`: read-only. The token to pair, whether Pluton and LinkedIn are reached, the latest
  results.
- Server side: `apps/server/src/linkedin-extension.ts` (check-in, results, download) and
  `packages/core/src/linkedin-extension.ts` (pairing, the queue).
