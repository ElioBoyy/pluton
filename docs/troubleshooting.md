# Data, privacy and troubleshooting

## Where your data lives

Pluton is a hosted app, at https://app.plut0n.com. Your data is hosted in the European Union, on a server in Germany (Hetzner):

- **Your account**: name, email, how you sign in, and your subscription (plan, status, dates). Your card details are entered at Stripe and never reach Pluton.
- **Each workspace**: Brain, Plays, searches, leads, sequences and drafts, replies, agent conversations, activity, notifications, the cost ledger, the cache of provider answers, its wallpapers, and every setting and API key (keys encrypted).

The language and the Light/Dark choice are not stored with your account: they are kept by your browser.

Some providers may process data in the United States: Anthropic, and where applicable OpenAI, Stripe, Google or Apple. Your data is never sold or used to train AI models. Account and workspace data is kept during the subscription, then 30 days after it ends. The privacy policy, linked on the sign-in page, has the full details and how to exercise your rights.

Prospect data (names, titles, companies, LinkedIn profiles, emails, messages) is personal data. For it, you are the controller and Pluton processes it on your behalf: you are responsible for using it lawfully (for example a legitimate-interest basis for B2B outreach, honouring opt-outs, and not keeping data longer than needed).

Installing Pluton on your own servers (on-premise) is by arrangement: write to mathis.sportiello@gmail.com.

## What leaves Pluton

Pluton only talks to the outside world for the work you ask it to do:

- **The AI**: prompts include what the task needs: your Brain, a Play's audience, candidates being scored, a lead's profile and posts when writing messages, your question to the agent. Web search and page reading go out from the AI provider's side.
  - **Your own AI**: Anthropic or OpenAI, through your own key and account.
  - **All included**: Anthropic, through Pluton's own key.
- **Free sources**: the French company registry API (recherche-entreprises.api.gouv.fr), public job boards (Greenhouse, Lever, Ashby, Recruitee), and companies' own websites (homepage for tech detection, contact, legal and team pages for emails, careers pages).
- **Paid data sources**: Apify, TheirStack, Hunter (names and company domain for an email search), through Pluton's keys or the ones you saved.
- **The Pluton LinkedIn extension**, if you paired one: it checks in with your Pluton from your Chrome and does visits and invitations on LinkedIn.
- **Your mail server**, if set: the digest email, outreach emails and reading replies over IMAP.
- **Slack, HubSpot, Attio, Pipedrive**, if connected: leads you post or export.
- **Your workspace's website**, to fetch its icon.

AI clients you connect over MCP reach your workspace only with its token (see "Connect your AI").

## API key encryption

Secret settings (your Anthropic or OpenAI key, Apify, TheirStack and Hunter keys you saved, SMTP and IMAP passwords, Slack and CRM tokens, the MCP token) are encrypted with AES-256-GCM before they are stored. The Settings pages never send a saved secret back to the browser: you only see "Saved here · ••••" with its last four characters. Pluton's own keys, included in your plan, are never shown at all.

Non-secret settings (research model, SMTP host, port, user and From address, IMAP host, port and user, switches) are stored as plain text.

To replace a key, paste the new one over it; to stop using it, click **Remove**. A row included in your plan then goes back to Pluton's own key.

## Signing in and paying

- **"Wrong email or password."**: check both, or use **Forgot password?** to get a link by email. If you created your account with Google or Apple, use that button instead, or set a password from Settings → Profile → Sign-in once you are in.
- **"Too many tries. Wait a few minutes and try again."**: sign-in is paused for a while after repeated failures.
- **"That link has expired or was already used. Start again."**: ask for a new confirmation or reset link. After you choose a new password you are signed in right away, and your other devices are signed out.
- **"Sign-in was cancelled. Try again when you're ready."**, **"That sign-in took too long. Start again."** or **"We couldn't sign you in. Try again, or use the other option."**: the Google or Apple step didn't finish. Start again, or use another way in.
- **"That account already signs in to another Pluton account."**: when connecting Google or Apple from Settings → Profile, that account is already used by a different Pluton account.
- **"Stripe hasn't confirmed the payment yet."** after paying: click **Check again** after a moment.
- **"Payment couldn't start. Try again in a moment."**: the Stripe page could not be opened; try again.
- **You land on "Choose your plan" while signed in**: your subscription is not active (not paid yet, or ended). Choose a plan again to get back in.

## Background jobs

Searches, onboarding research, Brain reviews, Play planning, agent replies, message writing, email lookups, sequences, digests, Slack posts and CRM exports run in the background as **jobs**. You can close the tab: they carry on. A job has one of five statuses:

- **Queued**: waiting for its turn (or for its scheduled time).
- **Running**: being worked on.
- **Completed**: finished.
- **Failed**: stopped on an error after its last attempt.
- **Cancelled**: you stopped it (Stop search, Stop on an agent reply), or it was cancelled before it started.

**Retries.** Almost every job you start runs **once**: a search, onboarding stage, Play planning, an agent turn, message writing, email lookups, digest, CRM export. If it fails, the error is shown where you started it and you run it again yourself. A Slack post of new leads gets one extra try. Separately, calls to outside services retry on their own: up to two more times on a rate limit, a server error or a network error, with growing pauses, before the job sees a failure.

**Cancelling.** Stopping asks the job to abort; it checks every 2 seconds. A job still queued is cancelled at once.

**Interruptions.** If a job is interrupted before it finishes, a search ends with a message asking you to run it again (people already found aren't duplicated), and an agent action says to check the result in Pluton before asking again. No job runs for more than 3 hours: past that it is stopped and marked failed ("Stopped after running for more than 3 hours."), so its Play can search again. Money held by an interrupted search is settled automatically within about a minute.

## Checking that everything runs

The bottom of **Home** has a **System** section:

- **API server**: "online" in green, "checking…", or "unreachable" in orange (the app can't reach Pluton: check your connection and reload the page).
- **Jobs queued**, **Jobs running**, **Jobs completed**, **Jobs failed**: counts for this workspace, refreshed every 3 seconds.
- **Run test job**: sends a small test job and streams each step back. If it keeps waiting, jobs are not being picked up yet.

## AI problems

What can go wrong depends on your plan.

**Your own AI.** The AI runs on the Anthropic or OpenAI key saved in Settings → API keys. Open that page, check the key and click **Test**: an Anthropic key answers "The API key works ({model} available)." An authentication error means the key is wrong or revoked: paste a valid one. A billing error means your account at that provider has no credit left: add credit in the provider's console. The provider's own usage limits also apply to your key.

**All included.** The AI runs on Pluton's own key and draws on your credits. When the month's credits are used up, AI work stops with "Your plan's included usage is used up until (date). Add your own key in Settings → API keys to keep going." Buy a credit pack in Settings → Budget, wait for the next period, or paste your own Anthropic key in Settings → API keys (it is then billed by Anthropic).

**Messages you may see from AI jobs (both plans):**
- "Claude declined this request." The AI refused (rare; rephrase what you asked).
- "Claude's answer was cut off before the end." The answer hit its length limit; try again.
- "Claude didn't finish within its turn limit." The task took too many steps; try again or narrow it.
- "Claude stopped: {reason}" or "Claude returned an error." Read the reason; overload or rate limits pass with time.

A new key applies within seconds, to new work.

## Plan limits

- **Credits used up**: calls that go through Pluton's own keys (the AI on All included; Apify, TheirStack and Hunter on both plans) stop with "Your plan's included usage is used up until (date). …" until the next period. A credit pack (Settings → Budget → **Buy credits**) counts at once. A key you saved yourself keeps that source going, billed by its provider.
- **A source's monthly cap**: "This month's Hunter allowance on your plan is used up until (date). A credit pack raises it, or add your own Hunter key in Settings → API keys." (the same for TheirStack). Hunter and TheirStack each have a cap per period, even when credits are left; packs raise it in proportion.
- **Too much work at once**: to protect your account from a runaway script or a stuck tab, Pluton limits how much paid work one account can start, across all its workspaces:
  - "N searches are already running. Start this one when one of them is done."
  - "That's a lot of work for one hour: Pluton takes it up again in a few minutes."
  - "Pluton has done all it can for today on this account. It picks up again tomorrow."

Your plan's credits are shared by all the workspaces of your account: a busy workspace uses them up for the others too.

## Missing keys and data source errors

When a feature needs a key that isn't set, the error names the source and says "not configured: add its key in Settings → API keys" (or, for Slack and CRMs, "add its token in Settings → Integrations"). Add the key and run it again. Apify, TheirStack and Hunter are included in both plans, so this mostly concerns your AI key on Your own AI, SMTP, Slack and CRMs.

Other cases:
- **Apify errors** ("actor … failed", "still running after 5 minutes", HTTP 402 or 403): with your own token, usually an exhausted Apify balance or plan limit; check your Apify console.
- **TheirStack errors**: with your own key, no credits left or an invalid key. There is no Test button; the key is checked on first use.
- **Hunter**: with your own key, Test shows searches left this month. Find email always tries the free sources first; if Hunter then fails (quota used up, key rejected), you still get the address guessed from the site's pattern when there is one, otherwise Hunter's error is shown.
- **HTTP 429** from any source: rate limited. Pluton already waits and retries twice; try again later.

Settings → Data sources shows each source's calls and failures over 30 days and a **Try it** box to check one directly.

## Searches refused, stopped or failing

- **"The monthly budget is used up until {date}. Raise it in Settings → Budget."** or **"The daily budget is used up for today…"**: the search was refused because your own workspace budget is used up in Stop mode. Raise the monthly budget or daily cap, switch **At the limit** to **Only track**, or wait for the next period or day. A refused scheduled search is retried the next day.
- **"Spend cap reached"**: the search used its hold. Raise **Most one search may spend** on the Budget page.
- **"Time limit reached"**: the research minutes ran out (15 by default per Play).
- **"Sources ran dry before the target"**: widen the audience or add a data source.
- **Interrupted**: run it again; people already found aren't duplicated.
- **"This Play is archived"**: restore it before running it.
- **Plan limits** (credits, a source's cap, too much work at once): see "Plan limits".

Each Play runs one search at a time: pressing Run search while one is queued or running just shows the one in progress. Details are in "Plays" and "Costs and budget".

## "Changed since you opened it" conflicts

Pluton protects you from overwriting someone else's change. Every editable thing (workspace settings, Brain items, Plays, sequences) carries a version number; a save made from an older version is refused. This happens when the same thing was changed in another tab, by the agent, by an AI client over MCP, or by a Brain suggestion you accepted.

Messages:
- "This item changed since you opened it; reload and retry" (Brain)
- "This Play changed since you opened it; reload and retry"
- "This sequence changed since you opened it; reload and retry"
- "Workspace changed since revision N; reload and retry" (Settings → General)

Fix: reload the page (or wait: most screens fetch the latest version right after the refusal), check what changed, and make your edit again. Nothing was lost: the other change was kept and yours was not applied.

Related messages that are not conflicts: "Not found in this workspace" means the link or item belongs to another workspace (switch workspace first); a still-running email lookup or agent reply means one is already in progress.

## LinkedIn problems

- **Account shows Disconnected** (Chrome extension): LinkedIn is signed out in that Chrome ("LinkedIn is signed out in this account's browser: sign back in there"). Sign back in to LinkedIn there; queued steps go on at the next check-in.
- **Nothing happens on an extension account**: Chrome must be open on that computer with the extension loaded; its popup should show two green dots (paired with Pluton, LinkedIn signed in). See the [extension guide](/docs/linkedin).
- **A step came back to you as a task**: the extension couldn't do it (LinkedIn asked for the person's email, or a button wasn't found); the task says why.
- **"LinkedIn asked to slow down"**: LinkedIn rate-limited or reached its invitation limit. The step waits for the time LinkedIn asked, or 6 hours, then continues. Consider lower daily limits.
- **"LinkedIn won't let this account reach this person"**: that person can't be invited or messaged from this account; their sequence ends as failed.
- **Other errors**: a step is retried after an hour, then two hours; after 3 failures on the same step, that person's sequence ends as failed with the error.
- **Nothing is sent**: check the time is inside the send window (weekdays 9:00–18:00 in the workspace timezone by default), the account's daily limits aren't used up, and the 10-minute undo delay after adding people has passed. A manual account sends nothing by itself: its steps wait in the Play's to-do.

More in "LinkedIn sequences and outreach".

## Email digest problems

- **The digest never arrives by email**: in Settings → Notifications, **Also send it by email** must be on with a **Send to** address, and SMTP must be set up (host, user and password in Settings → API keys → Email). The page says "SMTP is set up" when it is.
- **Test on SMTP password fails**: the message is your mail server's. Use an app password (Gmail, Fastmail, iCloud and others require one with two-factor sign-in), port 465 for TLS or 587 for STARTTLS, and the full email address as user.
- **No digest at all**: it is skipped when there's nothing new, never sent on weekends, and sent only once per day after its time (08:30 by default, workspace timezone). Use **Send it now** (or **Put it in the app now**) under "Next digest, as of now" to check.

## FAQ

**Where is my data stored?**
On Pluton's server in Germany, in the European Union. Only calls to the services your work needs leave it (see "What leaves Pluton").

**Can I see an API key I saved?**
No. Only its last four characters are shown. Paste it again to replace it.

**A search has been "Queued" for minutes.**
Check Home → System: the job counts and **Run test job** show whether jobs are being picked up. Each Play runs one search at a time, and your account can only run a few searches at once.

**I closed my laptop during a search. What happened?**
Nothing: the search runs on Pluton's side and carries on. Open the Play again to see its progress or result.

**Pluton says my plan's usage is used up.**
The month's credits are spent. Buy a pack in Settings → Budget, wait for the next period, or save your own key for the source in Settings → API keys.

**Do I need to do anything after adding a key?**
No. Keys take effect within a few seconds.

**I got "This Play changed since you opened it". Did I lose my change?**
Your change wasn't applied, the other one was kept. Reload and make it again.

**My scheduled Plays didn't run today.**
The Play must be Active with a schedule, and both your budget and your plan's credits must allow it. Scheduled Plays run from 07:00 in the workspace timezone.

**How do I delete my data?**
Deleting a workspace (Settings → General → Workspaces) removes its Brain, Plays, leads, sequences and settings for good. For your account, see the privacy policy linked on the sign-in page.

**Can I run Pluton on my own servers?**
Only by arrangement: write to mathis.sportiello@gmail.com.
