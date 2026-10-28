# Pluton LinkedIn extension (prototype)

Sends Pluton's LinkedIn steps from the founder's own Chrome: their address, their LinkedIn
session, no proxy and no hosted login. Steps run only while Chrome is open, one at a time, each in a
tab opened in the background and closed afterwards.

**Prototype.** It sends a test invitation from its popup. It is not wired to Pluton yet: the
sequence engine still talks to Unipile.

LinkedIn's terms forbid browser extensions that automate its site, and accounts can be restricted.
Try it on an account you can afford to lose.

## Build and load

```bash
pnpm --filter @pluton/linkedin-extension build        # or `dev`, which also acts on http://localhost
```

Then in Chrome: `chrome://extensions` → Developer mode → Load unpacked → `apps/linkedin-extension/dist`.

## Test on a real account

1. Sign in to LinkedIn in that Chrome; the popup's dot turns green.
2. In the popup, paste a profile URL you know, without a note first, and send.
3. If it answers "Bouton d'invitation introuvable", LinkedIn has probably renamed a button: the
   names are at the top of `src/invite.ts`.

## Files

- `src/background.ts`: the worker. Opens the profile in a background tab, injects `invite.js`,
  closes the tab, keeps the last 20 results.
- `src/invite.ts`: runs in the profile tab. Finds Connect (or More → Connect), adds the note by
  typing it, sends.
- `src/popup.ts`: LinkedIn sign-in state, the test form, the latest results.
