# Connect your AI: the MCP server for Claude Code, Claude Desktop and Codex

## What it is

Pluton runs a local **MCP server** (Model Context Protocol, the standard AI assistants use to call outside tools). It lets Claude Code, Claude Desktop or Codex read your leads, Plays, Brain, sequences, replies and spend, and act on them, from their own chat. The page is **Settings → Connect your AI**: "Ask Claude or Codex about your leads and Plays, and let them act on them, through Pluton's local MCP server."

Key facts:

- The server is part of Pluton's API and runs whenever Pluton runs. Its address is shown on the page; by default it is localhost on port 8787, path /api/mcp, over HTTP (Streamable HTTP transport).
- Access needs a **token**. Each workspace has its own token, created automatically the first time Pluton starts; the token decides which workspace a client works in.
- The tools are the same ones the in-app agent uses (see the Agent documentation). Reading is free and direct; anything that starts a search, adds people to a LinkedIn sequence or exports to a CRM needs an explicit confirmation.
- Whatever a client spends (for example a search it starts) is charged to that workspace's budget and appears in Usage under the agent's spend.
- Everything a client does appears in **Activity**.

You don't need the MCP server to use Pluton; it's for founders who already work in Claude or Codex and want Pluton available there.

## The Connect your AI page

The page has five parts.

**Server and token** (first box):

- **Server**: the full server address, with **Copy server URL**.
- **Token**: shown partly hidden (the first 10 characters, then dots), with **Show token** / **Hide token** and **Copy token**. Tokens start with "pluton_".
- **New token** ("Every connected client stops working until you set it up again."): asks "Make a new token? Every connected client stops working until you set it up again." and replaces the token. Open sessions using the old token end.

Footnote: "Local only: the server answers on this machine and checks the token on every call. Anything that can read your config files can use it."

**AI client**: a switcher with **Claude Code**, **Claude Desktop** and **Codex**. Each shows a short instruction and a ready-made block, already filled in with your server address and token, with a copy button. See the next section.

**Guardrails**: the switch **Pause searches started from AI clients** ("Clients can still read everything and review leads."), off by default, and three rules:

- "A search shows its expected cost and the budget left first; it starts only when called again with an explicit confirmation. Your monthly budget still applies."
- "Adding people to a LinkedIn sequence or exporting them to a CRM also needs an explicit confirmation, for those people."
- "Everything a client does shows up in Activity."

**Connected clients**: every client that has connected to this workspace, with its name and version, "{count} tool calls · last {tool}", when it was last seen, and **Forget** (removes it from the list; it reappears if it connects again). Empty: "No clients yet. The first one to connect appears here."

**Claude Code skill**: see "Installing the Claude Code skill".

## Setting up Claude Code, Claude Desktop or Codex

Pick your client in the **AI client** switcher, click the copy button next to the block, then:

**Claude Code** ("Run it in a terminal."): the block is a single command that registers an MCP server named "pluton" with Claude Code, using the HTTP transport, your server address, and an Authorization header carrying "Bearer" followed by your token. Paste it in a terminal and press Enter. Start (or restart) Claude Code; the "pluton" server and its tools are then available. You can check with Claude Code's own MCP listing.

**Claude Desktop** ("Merge into claude_desktop_config.json (Settings → Developer → Edit config), then restart Claude Desktop. Needs Node."): the block is a JSON configuration with an "mcpServers" entry named "pluton". It launches the small bridge "mcp-remote" through npx, pointing it at your server address with the Authorization header. In Claude Desktop, open Settings → Developer → Edit config, merge the "pluton" entry into the existing "mcpServers" section (don't replace other servers you have), save, and quit and reopen Claude Desktop. Node.js must be installed, since npx comes with it.

**Codex** ("Add to ~/.codex/config.toml."): the block is a section named "mcp_servers.pluton" with the server "url" and "http_headers" carrying the Authorization header. Add it to Codex's config.toml file (in your home folder, under .codex), save, and restart Codex.

Pluton must be running (the usual start command launches the web app, the API and the worker) for any client to reach it. The first call from a client adds it to **Connected clients** and writes "{name} connected to Pluton over MCP" in Activity.

If you make a **New token**, repeat the setup for every client with the new block.

## The "Connect your AI" checklist item

The sidebar's **Get started** card has five steps: **Review a lead**, **Create a Play**, **Edit the Brain**, **Ask the agent**, **Connect your AI**. Each ticks itself off; the card disappears once all five are done. Clicking **Connect your AI** opens Settings → Connect your AI.

**Connect your AI** counts as done as soon as either:

- an AI client has connected to this workspace's MCP server at least once (it appears in Connected clients), or
- an AI client on this computer is **configured** to reach Pluton, even before its first call.

For the second case, Pluton looks into the configuration files of the clients on this computer and checks whether one of them mentions Pluton's server address (localhost or 127.0.0.1 on Pluton's port, path /api/mcp):

- Claude Code: its user configuration file in your home folder, and a project MCP file in Pluton's own folder.
- Codex: its config.toml (in the .codex folder, or wherever CODEX_HOME points).
- Claude Desktop: its claude_desktop_config.json in the Claude folder of your Mac's Application Support.

Pluton reads these files at most every 30 seconds and the sidebar refreshes every minute, so the tick can take up to about a minute and a half to appear. Pluton only looks for the address; it doesn't read or use anything else in these files. Note that this check doesn't verify the token: a client configured with an old token still ticks the item but will be refused when it calls.

## Every tool the server exposes

Read tools (run directly, no confirmation):

- **workspace_get**: workspace name, website, timezone, lead counts waiting for review, and the budget this period.
- **brain_get**: the Brain (company, ICP, personas, competitors, influencers, voice, keywords, message pillars, hiring and stack signals), optionally one section.
- **brain_proposals_list**: Brain suggestions waiting for a decision.
- **plays_list**: Plays with pipeline, schedule, status, target, leads to review and approved, last search.
- **plays_get**: one Play's audience definition and its last 10 searches.
- **plays_plan**: turns a goal into a Play proposal; returns one clarifying question or a proposal. Waits up to 3 minutes. Doesn't create or run anything.
- **lead_finding_get_run**: a search's status, report (funnel, why people were set aside) and stop reason.
- **leads_list**: leads by tab (all, new, to_review, approved, in_campaign, contacted, rejected; default to_review), optional Play and search text, sorted by newest, fit (default) or warmness, 1–100 per page (default 25).
- **leads_get**: one lead with evidence, timeline and feedback.
- **campaign_get_overview**: a Play's sequence: steps, objective, window, accounts, counters and what's missing.
- **campaign_list_leads**: people in a Play's sequence and where each is.
- **campaign_get_lead**: one lead's sequence: messages, actions and next step.
- **campaign_list_linkedin_accounts**: LinkedIn accounts with status and daily limits.
- **replies_needing_you**: LinkedIn replies waiting for your answer.
- **credits_get_balance**: spent, held by running searches, available this period (amounts in micro-dollars: 1,000,000 = $1).
- **credits_get_usage**: spend by day, Play, type and source, for this period, the previous one, 30 or 90 days.
- **activity_since**: what happened since a cursor (0 the first time), optionally filtered by area, up to 200 events.

Tools that change things are listed in the next section.

## Tools that change things, and their guardrails

These tools act on your data or reach outside Pluton. Three of them have a built-in two-step confirmation:

- **plays_run**: starts a lead search. Called without confirmation it only returns the expected cost and the budget left (Claude through your subscription isn't charged). Called again with confirmation it starts the search. Refused with "Searches started from AI clients are paused in Pluton (Settings → Connect your AI)." when **Pause searches started from AI clients** is on. Your monthly budget and the per-search cap still apply.
- **campaign_add_lead**: adds up to 100 people to their Play's LinkedIn sequence ("this starts real LinkedIn outreach in the user's name"). Without confirmation it lists who would join and any conflict (already in a sequence, rejected). With confirmation, Pluton starts writing their messages and adds them; the 10-minute undo window applies, and messages not yet written are written when due.
- **crm_export_leads**: creates up to 200 leads in a connected CRM (create-only). Without confirmation, or without a CRM or leads, it lists the connected CRMs.

The others run when the client calls them. The client is instructed to use them only on your decision, and Claude Code, Claude Desktop and Codex ask your permission before running tools unless you've allowed them:

- **brain_proposal_decide**: accept, reject or answer a Brain suggestion.
- **brain_review_start**: starts a Brain review (a few minutes; uses Claude).
- **plays_create**: saves a Play proposal from plays_plan, without running a search.
- **plays_set_status**: pause, resume or archive a Play.
- **lead_finding_cancel_run**: stops a running search (what it found stays).
- **lead_feedback_submit**: approve or reject up to 200 leads, with reasons (wrong persona, seniority, company, geography, other) and a comment. Teaches later searches; can trigger the CRM export on approval. Activity shows "from your AI client".
- **leads_find_email**: email lookup for up to 50 leads (free sources first, then Hunter if set up, which uses your Hunter quota).
- **campaign_remove_lead**: takes people out of their sequence.
- **campaign_set_status**: pauses or resumes a Play's sequence.

The server also gives every client standing instructions: read before writing, quote the cost and get a yes before a search, never add people to a sequence or export to a CRM without a yes for those people, and don't add up lead counts across Plays (one person can be in several).

## Installing the Claude Code skill

The **Claude Code skill** ("Teaches Claude how to work with Pluton: the morning check, reviewing leads, running Plays with the cost first, sequences, the Brain and spend.") is a single instruction file for Claude Code. It contains no secret.

Two ways to install it:

- Copy the one-line terminal command shown on the page: it creates the folder for a "pluton" skill in your personal Claude Code skills folder and downloads the file from Pluton's server into it. Pluton must be running.
- Or click **Download SKILL.md** and place the file yourself in a "pluton" folder inside your Claude Code skills folder.

What the skill teaches Claude:

- **Rules**: read first; cost first, then an explicit yes; real outreach needs a yes per person; verdicts are yours, and it asks for a rejection reason; don't add counts across Plays; amounts are micro-dollars.
- **Morning check** ("what's new?"): activity since last time, what waits, replies first, then a short summary and a next step.
- **Reviewing leads**: leads to review by fit, grouped by Play, then your verdicts.
- **Finding new leads**: estimate, your yes, run, then the report; or plan a new Play from your idea.
- **Sequences**: overview, who is where, replies to answer (it drafts replies for you to send; it doesn't send them).
- **Brain** and **Spend**.

## Security and privacy

- **Token on every call**: requests without the right token are refused with "Missing or wrong token: copy it from Pluton → Settings → Connect your AI". The token is compared safely and stored encrypted in Pluton's local database. It can be sent as an Authorization header (what the setup blocks do) or, for clients that can't set headers, as a token parameter in the address.
- **One token per workspace**: a client only ever sees the workspace its token belongs to.
- **Browser protection**: calls coming from a web page are refused ("Forbidden origin") unless that page is on localhost, so a website you visit can't use the server. Command-line and desktop clients aren't affected.
- **Network**: the server only listens on this computer's own loopback address (localhost), so other devices on your Wi-Fi or office network can't reach it at all, token or not. Treat the token like a password anyway; if it may have leaked, click **New token**.
- **Config files**: the token sits in plain text in your AI clients' config files. As the page says, anything that can read those files can use it.
- **Sessions**: a client's session ends after an hour of inactivity; clients reconnect on their own. After a token change, an old session gets "Session expired; reconnect".
- **Outside services**: the MCP server itself sends nothing anywhere. A client's actions only reach outside services the same way the app does (Claude, data sources, Unipile, CRMs), and the risky ones need confirmation.
- **Kill switches**: **Pause searches started from AI clients** stops new searches from clients; **New token** cuts every client off at once; **Forget** only tidies the list (it doesn't block a client).

## Troubleshooting

- **The client says the server is unreachable**: Pluton isn't running, or the port changed. Start Pluton and check the address on the page matches the one in the client's config.
- **"Missing or wrong token: copy it from Pluton → Settings → Connect your AI"**: the token in the client's config is wrong or old (after **New token**, or from another workspace). Copy the block again and redo the setup.
- **"Session expired; reconnect"**: the session ended (idle for an hour, Pluton restarted, or token changed). Restart the client or reconnect the server from it.
- **"Forbidden origin"**: the call came from a web page that isn't on localhost.
- **Claude Desktop shows no Pluton tools**: Node.js is missing (needed for npx), the JSON wasn't merged correctly, or Claude Desktop wasn't fully restarted.
- **"Searches started from AI clients are paused in Pluton (Settings → Connect your AI)."**: switch off **Pause searches started from AI clients**, or start the search from the app.
- **A search was refused for budget**: the monthly budget or the per-search cap blocks it; change it in Settings → Budget.
- **The client sees another workspace's data**: each workspace has its own token; set the client up with the token shown while the right workspace is open.
- **The checklist item didn't tick**: wait about a minute and a half, make sure the client's config file contains Pluton's address, or make one call from the client.

## FAQ

**Q: Do I need the MCP server to use Pluton?**
A: No. It's optional, for using Pluton from Claude Code, Claude Desktop or Codex. The in-app agent (Agent page or ⌘K) uses the same tools without any setup.

**Q: Can Claude start an expensive search without asking me?**
A: No. plays_run first returns the expected cost and the budget left; it only starts when called again with a confirmation, which the client is told to send only after your explicit yes. Your budget caps still apply, and you can block client-started searches entirely with **Pause searches started from AI clients**.

**Q: Can an AI client send LinkedIn messages in my name?**
A: Only by adding people to a sequence with campaign_add_lead, which needs a confirmation for those people. The normal sequence rules then apply: messages written first, a 10-minute undo, sending hours and daily limits. Clients can't send a free-form LinkedIn message.

**Q: Can I connect several clients at once?**
A: Yes. Claude Code, Claude Desktop and Codex can all use the same token at the same time; each appears in **Connected clients**.

**Q: I made a new token. What do I need to redo?**
A: Copy the new block for each client and redo its setup. Until then, those clients get "Missing or wrong token".

**Q: Does the Connect your AI step need a real call?**
A: No. It ticks once a client on this computer is configured with Pluton's address, or after the first call from any client.

**Q: Where do I see what a client did?**
A: In Activity (verdicts say "from your AI client"), on each lead's timeline, and in **Connected clients** (number of tool calls and the last tool used).

**Q: Is the skill required?**
A: No, but it teaches Claude Code the good routines (morning check, lead review, cost first) and the guardrails. Install it with the command on the page or **Download SKILL.md**.

**Q: Does Claude Desktop need anything extra?**
A: Yes, Node.js, because the configuration uses a small bridge launched with npx to reach Pluton's HTTP server.
