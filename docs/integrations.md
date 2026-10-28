# Integrations: Slack, HubSpot, Attio and Pipedrive

## Overview of the Integrations page

**Settings → Integrations** ("Send new leads to Slack and approved leads to your CRM.") lists four integrations, each with a status on the right:

- **Slack**: "New leads in a channel, with Approve and Reject buttons."
- **HubSpot**: "Approved leads become contacts (and companies)."
- **Attio**: "Approved leads become People records (and Companies)."
- **Pipedrive**: "Approved leads become Persons (and Organizations)."

Statuses: **Not connected**, **Connected**, **Connected · off** (connected but switched off), and **Needs attention** (the last check or an export/post failed because of the token). A footnote points to **Connect your AI** for working with Pluton from Claude or Codex (see the MCP documentation).

Click an integration to open its page. Every page has the same first section, **1. Access**:

- Short setup steps for that service, with an **Open** link to the right page of that service.
- One row per token to paste. Tokens are stored encrypted and take effect within seconds.
- A connection row with **Connect** (enabled once every token is pasted). Pluton checks the token with the service; on success the row shows the account it belongs to and the status becomes Connected. Once connected, the button becomes **Check again**, and **Disconnect** appears.
- An **On** switch, once connected. Off means Pluton does nothing with this integration on its own, and exports are refused (see "Errors").

**Disconnect** asks "Disconnect {name} and forget its tokens?". It deletes the tokens and marks the integration not connected; the export history stays. Connecting and disconnecting are logged in Activity ("You connected HubSpot").

There are no outgoing webhooks in Pluton: Slack and the CRMs are the only places it sends leads, and Pluton doesn't read LinkedIn conversations (see the sequences documentation).

When you create a new workspace by copying an existing one, the integrations' settings are copied too.

## Slack: setting up the app

Slack needs a small Slack app you create in your own Slack workspace. It uses **Socket Mode**: Pluton opens the connection to Slack itself, so you don't configure any request URL in Slack.

Steps (shown on the Slack page):

1. At api.slack.com/apps, create an app **from scratch** in your workspace.
2. **Socket Mode**: turn it on and create an **app-level token** with the scope connections:write. It starts with "xapp-".
3. **Interactivity & Shortcuts**: turn it on (no URL needed with Socket Mode).
4. **OAuth & Permissions**: add the bot scopes chat:write, channels:read, channels:join and groups:read, install the app to your workspace and copy the **bot token** (starts with "xoxb-").

In Pluton, paste the **Slack bot token** and the **Slack app-level token**, then click **Connect**. Pluton checks the bot token with Slack; the account shows as "{team} (as @{bot})". If Slack refuses: "Slack refused the token (401). Check it, and its scopes."

The Approve and Reject buttons reach Pluton over that Socket Mode connection, which needs the app-level token. Pluton opens the connection within about 15 seconds of both tokens being saved, and reconnects on its own when Slack refreshes the connection or it drops.

## Slack: channel, format and test

Once connected, section **2. Where and how** appears:

- **Channel**: a menu of your public and private channels ("Loading channels…", then "Pick a channel"; private ones have a lock). When you save, Pluton joins a public channel by itself. A private channel needs you to invite the app first: "Private channel: invite the app there first (/invite @your-app)."
- **Each search posts**:
  - **One message** (default): "The new leads in one message (best 10), each with Approve and Reject."
  - **One message per lead**: "With why they fit. Busier, easier to discuss in threads." Up to 25 messages per search.
- **Only leads with a fit of at least**: a number from 0 to 100, default 0 (every lead).

Click **Save**. Then **Send a test message** (available once a channel is saved and nothing is unsaved) posts "Pluton is connected. New leads will show up here with Approve and Reject buttons." and shows "Sent to #{channel}". If the app isn't in the channel: "the Pluton app isn't in this channel: invite it with /invite @YourApp". Without a channel: "Pick a channel first".

## Slack: what gets posted and when

**When**: each time a search (a run of a Play, scheduled or started by you, the agent or an AI client) finishes and found at least one new lead, if Slack is connected, switched **On**, and a channel is saved. Each search is posted once.

**What**: the leads that search found which are still **New** or **To review** and have at least the minimum fit, best fit first. Already-reviewed leads are left out.

- **One message**: the title "{count} new leads for {play}", then up to 10 leads. Below them: "{count} more" when there were more, and a **Review in Pluton** link to the Play's leads to review.
- **One message per lead**: titled "New lead for {play}", one message per lead, including the "why they fit" text.

Each lead line shows the name (linked to their LinkedIn profile when known), "{title} at {company}", "fit {fit}", and the signal in italics. Under it, two buttons: **Approve** and **Reject**.

The **Review in Pluton** link opens the Play's leads to review in Pluton (app.plut0n.com).

Activity records "Pluton posted {count} leads from {play} to Slack". If posting fails because of the token (revoked, invalid), the integration goes to **Needs attention**; a failed post is retried once.

## Slack: Approve and Reject buttons

Clicking **Approve** or **Reject** in Slack gives exactly the same verdict as the thumbs up / thumbs down in the app:

- The lead becomes **Approved** or **Rejected**, with the comment "From Slack ({user})" naming who clicked.
- The verdict teaches later searches like any other (people you reject never come back; rejections count toward the automatic Brain review).
- An approval can trigger the CRM export on approval, if you switched it on.
- Activity says "You approved {count} lead in {play} from Slack".

Slack rejections carry no reason; to give one (wrong role, seniority, industry…), reject from the app instead.

After a click, Pluton updates the Slack message: each lead whose verdict is known shows "✅ Approved", "❌ Rejected", "In campaign" or "Contacted" instead of buttons. A button only acts when the lead is still New or To review; if you already reviewed it in the app, clicking just refreshes the message to show the current status. Verdicts given in the app don't update old Slack messages until someone clicks a button in them.

If a workspace has several Pluton workspaces sharing one Slack app, each click applies to the lead's own workspace.

## CRMs: what the export does

HubSpot, Attio and Pipedrive work the same way: Pluton **creates** people in your CRM, never updates or deletes anything. "Create-only: Pluton looks each person up by email and only creates the ones that aren't there. It never edits or deletes CRM records."

For each lead:

1. If the lead was already exported to this CRM (created there, or found there before), it is skipped. Each lead goes to each CRM at most once; a failed export can be retried.
2. If the lead has an email, Pluton searches the CRM for a person with that email. If found, nothing is written and the export is logged as **Already there**, with a link to the existing record.
3. Otherwise Pluton creates the person with the mapped fields. If **Also create their company and link them to it** is on (default on) and the lead has a company, Pluton finds the company in the CRM (HubSpot and Attio by website domain, or by name when there's no domain; Pipedrive by exact name) or creates it, then links the person to it. A company is looked up once per export batch.
4. The result is logged as **Created** (with an **Open in CRM** link), **Already there** or **Failed** (with the error).

Leads without an email can't be matched, so they are always created; exporting the same person twice from two different Plays (two different leads) can create a duplicate in that case.

If the CRM refuses the token mid-export (401 or 403), Pluton logs that lead as failed, stops the batch (the remaining leads aren't attempted and can be exported again later) and marks the integration **Needs attention**. Any failure also sends a notification "{count} leads not exported to {crm}" ("See the export log for the error."), which opens the integration's page.

## CRMs: connecting each one

**HubSpot**: in HubSpot, Settings → Integrations → Private apps → Create. Scopes: crm.objects.contacts.read/write, crm.objects.companies.read/write, crm.schemas.contacts.read. Copy the access token (starts with "pat-") and paste it as **HubSpot private app token**. The account appears as "HubSpot portal {id}".

**Attio**: Workspace settings → Developers → New access token, with scopes Record read-write and Object configuration read. Paste it as **Attio API key**. The account appears as "Attio workspace {name}". An inactive key gives "this key is no longer active".

**Pipedrive**: Personal preferences → API → copy your personal API token, paste it as **Pipedrive API token**. The account appears as "Pipedrive {company} ({your name})".

Then click **Connect**. Once connected, two more sections appear: **2. What gets sent** and **Field mapping**, plus the **Export log** (shown on the page whenever there are exports).

**2. What gets sent** has two switches:

- **Export automatically when you approve a lead** (off by default). "Otherwise, use 'To {crm}' in the Leads table."
- **Also create their company and link them to it** (on by default).

Click **Save** to keep changes.

## CRMs: field mapping

**Field mapping** is a table: on the left the Pluton fields, on the right a menu of your CRM's writable person properties (shown as "Label (key)"), or **Don't send**. Pluton fields:

- **First name**, **Last name**, **Full name**
- **Work email**
- **Job title**
- **Company**, **Company domain**
- **LinkedIn URL**
- **Location**
- **Fit score** (0–100)
- **Why they fit**
- **Signal**
- **Play** (the Play's name)

Default mapping, using only standard properties:

- **HubSpot**: First name → firstname, Last name → lastname, Work email → email, Job title → jobtitle, Company → company, Company domain → website, Location → city.
- **Attio**: Full name → name, Work email → email_addresses, Job title → job_title, LinkedIn URL → linkedin.
- **Pipedrive**: Full name → name, Work email → email.

"LinkedIn URL, fit and 'why they fit' need a custom property in your CRM; create one there, then pick it here." Same for Signal and Play. Empty values are never sent. **Reset mapping** goes back to the defaults; **Save** stores your mapping.

Notes: in Pipedrive, the person's name is always set from the full name and the organisation link is handled by Pluton (not through the mapping). In Attio, the name is sent as a structured name (first, last, full). If the CRM's property list can't load, the error shows above the table (usually a token or scope problem).

## CRMs: exporting leads

Three ways to export:

1. **From the Leads table**: select leads, then click **To {crm}** (one button per connected CRM, for up to 500 leads). Its tooltip: "Create these {count} people in {crm} (people already there are left alone)". While it runs the button says **Exporting…**, then a toast summarises: "HubSpot: 3 created, 1 already there, 1 failed". Leads previously exported count as "already there".
2. **From the lead drawer**: the **CRM** section shows where this lead was exported (**created**, **already there** or **failed** with the error, plus a link to open the record) and a **To {crm}** button for each connected CRM it isn't in yet.
3. **Automatically on approval**: with **Export automatically when you approve a lead** on, every approval (in the app, from Slack, by the in-app agent or by an AI client) queues an export of those leads to that CRM. Approving in bulk exports them together.

The in-app agent and connected AI clients can also export, but only after your explicit yes for those people.

Exports run in the background; Activity records "You exported {count} leads to {crm}" or "Pluton exported…" (automatic), with how many were already there or failed.

## CRMs: the export log

The integration's page shows an **Export log** of the last 100 exports to that CRM, refreshed every 10 seconds. Each row: the person and company, a status pill (**Created**, **Already there**, **Failed** with the error underneath), how it was triggered (**by you**, **on approval**, or **from AI client**), how long ago, and an **Open in CRM** link when there's a record.

Exports requested through an AI client or the in-app agent use the same path as your own button, so they currently appear as **by you**.

A failed row can be retried: export the lead again and the new result replaces the old one.

## Errors and fixes

- **"{name} refused the token ({status}). Check it, and its scopes."**: the token is wrong, revoked or missing a scope. Create a new one with the listed scopes, paste it, click **Connect** or **Check again**.
- **"Connect {name} first"**: you tried to export to a CRM that isn't connected.
- **"{name} is not connected"** during an export: the CRM is disconnected, has no token, or its **On** switch is off. The "To {crm}" button still shows when the CRM is connected but switched off, and the export then fails with this message. Turn it **On**.
- **"not configured: add its token in Settings → Integrations"**: a token is missing.
- **"not configured: add the bot token in Settings → Integrations → Slack"**: Slack bot token missing.
- **"the Pluton app isn't in this channel: invite it with /invite @YourApp"**: private channel; invite the app.
- **"Pick a channel first"**: save a channel before sending a test.
- **Needs attention** on Slack: the token was revoked or the app uninstalled; reinstall the app, paste the new bot token, **Check again**.
- **Approve/Reject in Slack does nothing**: the app-level token is missing or wrong, or Socket Mode or Interactivity is off in your Slack app. Check the app-level token (xapp-…, with connections:write) and that both are on.
- **Nothing posted after a search**: Slack is off, no channel is saved, the search found no new lead, or every lead was below the minimum fit.
- **Notification "{count} leads not exported to {crm}"**: open the export log, read the error on the failed rows, fix (token, scopes, a required custom property in your CRM), then export them again.

## FAQ

**Q: Will Pluton overwrite contacts that already exist in my CRM?**
A: No. Exports are create-only. A person found by email is left exactly as they are and logged as "Already there". Pluton never edits or deletes CRM records.

**Q: Do I need to set a request URL in Slack for the buttons?**
A: No. With Socket Mode, Pluton opens the connection to Slack itself; the app-level token is all it needs.

**Q: Can Slack post only my best leads?**
A: Yes. Set **Only leads with a fit of at least** on the Slack page (0 to 100). In "One message" mode the post also shows only the best 10, with a count of the rest.

**Q: Does rejecting a lead in Slack teach Pluton like rejecting in the app?**
A: Yes, it's the same verdict, but without a reason. Reject from the app when you want to say why.

**Q: How do I send approved leads to HubSpot automatically?**
A: Connect HubSpot, then switch on **Export automatically when you approve a lead** under "2. What gets sent" and click **Save**. Every approval, wherever it's made, is then exported.

**Q: Why aren't the LinkedIn URL and fit score showing in my CRM?**
A: They aren't standard CRM properties. Create custom properties in your CRM, then pick them for **LinkedIn URL** and **Fit score** in **Field mapping** and save.

**Q: Can I export the same lead twice?**
A: A lead goes to each CRM once. Exporting it again is skipped and counted as "already there", unless the previous attempt failed, in which case it's retried.

**Q: What happens to my export history if I disconnect a CRM?**
A: The tokens are forgotten, but the export log stays.

**Q: Does Pluton send leads anywhere through webhooks?**
A: No. Slack and the three CRMs are the only integrations, and nothing is sent anywhere else.

**Q: Can I use more than one CRM at once?**
A: Yes. Each connected CRM gets its own "To {crm}" button and its own settings, mapping and log.
