# Activity and notifications

## Overview

Pluton keeps you informed in four places, all per workspace:

- **The Activity feed**: one chronological journal of what you and Pluton did (searches, verdicts, sequences, Brain, spend, integrations, agent actions). Full page in Settings → Activity (/workspace/activity); the 8 latest events on Home; each Play's own events on its Overview.
- **The notification bell**: at the top of the sidebar, next to the workspace name. Only events that need your attention become notifications: new leads, failed or refused searches, replies, disconnected LinkedIn accounts, Brain suggestions, budget alerts, CRM export failures and the digest.
- **The morning digest**: a summary of what waits for you and what happened, every weekday at 08:30 by default, in the bell and optionally by email through your own SMTP server. Settings → Notifications (/workspace/notifications).
- **What's new**: release notes of Pluton in Settings → What's new (/workspace/whats-new).

The activity feed records everything regardless of notification settings; turning a notification category off only stops new bell entries of that kind.

Every line is worded when you read it, so the feed, the bell and the digest follow your current app language, past entries included.

## The Activity feed

Open it from Settings → **Activity**, from **All activity** on Home, or from **See all activity** at the bottom of the bell. It reads "Everything that happened in the workspace, by you and by Pluton."

How it looks:

- Events are grouped by day (with headers such as Today, Yesterday or a date), newest first.
- Each line has a coloured icon for its area (blue people for leads, green dollar for spend, indigo paper plane for sequences, pink brain for the Brain, purple Slack logo, orange cloud for CRM, indigo sparkle for the agent and onboarding, grey for MCP and system), one sentence, and the time.
- Lines that concern something you can open end with a chevron: clicking opens the Play (often on the right tab: Leads, Sequence), the Brain, Usage, Budget, the integration page, the LinkedIn accounts page or the agent conversation.
- The page shows 40 events at a time; **Show older** loads more. It refreshes every 20 seconds.
- Empty: "Nothing here yet."

Sentences say who did it: "You approved 3 leads in Main", "Pluton found 12 leads for CFO search". Actions you approved for the agent, or did from Slack or an AI client, count as yours. A Play deleted since is named "a deleted Play".

Other places showing activity:

- **Home → Recent activity**: the 8 latest events, compact, refreshed every 20 seconds.
- **A Play's Overview**: the 30 latest events about that Play.
- **The agent** and AI clients can read the feed (activity_since) to tell you what happened since last time.

## Activity filters

At the top of the Activity page, a **Show** control filters the feed:

| Filter | Shows |
|---|---|
| All | Everything, including agent, MCP, Slack, CRM and system events. |
| Leads | Plays created, searches started/finished/failed/stopped, lead verdicts, emails found. |
| Sequences | Sequences paused or resumed, people added, LinkedIn accounts added or disconnected, replies received. |
| Brain | Brain suggestions accepted, rejected or answered, and Brain review results. |
| Spend | Search costs and refunds, searches refused for budget, budget changes and alerts, manual expenses. |

Events about Slack, CRM exports, integrations, the agent, MCP clients and the digest appear only under **All**.

The filter isn't kept when you leave the page.

## Activity events: searches, leads and the Brain

Every sentence the feed can show, with what triggers it:

**Plays and searches**
- "You created the Play (name)": a Play was created (by you, the planner, the agent on your approval, or onboarding for the Main Play).
- "A scheduled search started for (Play)": the schedule started a run.
- "You started a search for (Play)": a search started from the app (a run button, "Create and run search", or the first search at the end of onboarding).
- "You started a search for (Play) from your AI client": started by the in-app agent on your approval, or by an AI client over MCP.
- "Pluton found N leads for (Play)" / "A search for (Play) found no new leads": a search finished.
- "A search for (Play) stopped on an error".
- "You stopped a search for (Play)".

**Leads**
- "You approved N leads in (Play)" / "You rejected N leads in (Play)", with "from Slack" or "from your AI client" when done there.
- "Pluton found N work emails for M leads" (or "for 1 lead").
- "Pluton posted N leads from (Play) to Slack".

**Brain**
- "You accepted a Brain suggestion" / "You rejected a Brain suggestion" / "You answered a question from the Brain review".
- "The Brain review left N suggestions" / "The Brain review found nothing to change" / "The Brain review stopped on an error".

## Activity events: sequences, spend, integrations and system

**Sequences and LinkedIn**
- "You paused the sequence of (Play)" / "You resumed the sequence of (Play)".
- "You added N people to the sequence of (Play)" (or "to the sequence" when several Plays are involved).
- "You added the LinkedIn account (name)".
- "The LinkedIn account (name) disconnected; sending paused".
- "(Name) replied (interested / needs your answer / not interested / to classify)".

**Spend**
- "The search for (Play) cost $X; $Y of its hold went back to the budget": a search settled its budget hold.
- "A search for (Play) was not started: the monthly budget is used up" (or "the daily budget").
- "You set the monthly budget to $X" / "You removed the monthly spend limit".
- "80% of the monthly budget is spent ($X of $Y)" / "The monthly budget is used up".
- "You added an expense of $X" (with your note when you wrote one).

**Integrations, agent and system**
- "You exported N leads to HubSpot" (or Attio, Pipedrive), or "Pluton exported…" for automatic exports on approval, with details such as "(1 already there, 2 failed)".
- "You connected (provider)" / "You disconnected (provider)".
- "You approved for the agent: (summary)": an agent approval card ran successfully.
- "(Client) connected to Pluton over MCP".
- "Pluton sent your digest by email" / "Your digest is ready".

## The notification bell

The bell sits at the top of the sidebar, right of the workspace name (and in the top header on phones). A red badge shows the number of unread notifications ("99+" above 99). The count refreshes every 15 seconds.

Click it to open the panel:

- Title **Notifications**, with **Mark all read** (only when something is unread) and a **Settings** link to Settings → Notifications.
- The 30 most recent notifications, newest first. Each has an icon by tone (green check for good news such as new leads, orange warning for problems, blue info otherwise), a title in bold while unread, an optional short text, how long ago, and a blue dot while unread.
- Click a notification to mark it read and open what it is about (for example the Play's leads to review, the sequence, the Brain, Budget or LinkedIn accounts). Notifications without a link are just marked read.
- **See all activity** at the bottom opens the Activity page.
- Empty: "Nothing yet. New leads, replies and budget alerts show up here."

Close the panel with Escape or by clicking elsewhere.

Notifications are per workspace: switching workspace shows that workspace's bell. Pluton doesn't send operating-system notifications; the bell, the digest and its optional email are the channels.

## What creates a notification

| Notification | When | Category | Opens |
|---|---|---|---|
| "N new leads for (Play)": "X qualified, Y to double-check." | A search finished with at least one lead. Once per search. | New leads | The Play's leads, To review tab |
| "The search for (Play) stopped" + the error | A search failed. Once per search. | Searches that fail | The Play |
| "Search for (Play) not started": "The monthly budget is used up until (date). Raise it in Settings → Budget." or "The daily budget is used up for today…" | A scheduled or manual search was refused for budget. At most once per Play per day. | Searches that fail | Budget |
| "N leads not exported to (CRM)": "See the export log for the error." | A CRM export had failures. | Searches that fail | The integration page |
| "(Name) replied": "Interested." / "They asked something only you can answer." / "Not interested: the sequence stopped." | A LinkedIn reply arrived. | Replies | The Play's sequence |
| "(Account) disconnected": "Sending from this account is paused until you reconnect it." | A LinkedIn account disconnected. | LinkedIn accounts | LinkedIn accounts |
| "The Brain has N suggestions": "Accept or reject them on the Brain page." | A Brain review left at least one suggestion. | Brain suggestions | Brain |
| "80% of the monthly budget spent": "$X of $Y spent this period." | Spend reached 80% of the monthly budget. Once per budget period. | Budget | Budget |
| "Monthly budget used up": "New searches won't start until the next period or until you raise the budget." (or "Tracking only: searches keep running.") | Spend reached 100%. Once per period. | Budget | Budget |
| Hosted plans: "80% of your monthly credits used", then "90% of your monthly credits used": "They renew on {date}. To keep going until then without a pause, add credits in Billing." | The plan's credits (this month's plus packs left) reached 80%, then 90%. Each once per billing month. | Budget | Billing |
| Hosted plans: "Your monthly credits are used up": "Searches pause until {date}. Add credits in Billing to pick up now." | The plan's credits reached 100%. Once per billing month. | Budget | Billing |
| "Your morning digest" / "Your digest" + what waits for you | The digest was sent. | Morning digest | Home |

Budget alerts only exist when a monthly budget is set (Settings → Budget).

## Notification settings (in the app)

Settings → **Notifications** ("What reaches the bell in the sidebar, and the morning digest."). The **In the app** section has one switch per category, all **on** by default:

- **New leads**: A search found leads for you to review.
- **Searches that fail**: A search stopped on an error or was refused for budget. (CRM export failures also use this category.)
- **Replies**: Someone answered your LinkedIn sequence.
- **LinkedIn accounts**: An account disconnected and sending paused.
- **Brain suggestions**: The Brain review left suggestions to accept or reject.
- **Budget**: Spend reached 80% and 100% of the monthly budget; on a hosted plan, its credits reached 80%, 90% and 100%.

Change the switches, then click **Save** at the bottom of the page (enabled once something changed; "Saved" appears after). The same Save button saves the digest settings.

What muting does: while a category is off, no bell notification of that kind is created; turning it back on doesn't bring back the ones skipped. The activity feed still records the events, the digest still counts what waits for you, and integrations such as Slack are unaffected.

These settings are per workspace. A new workspace created with "Copy from…" starts with the same notification settings.

## The morning digest: what it contains

The digest is a short summary in up to three parts:

**Waiting for you**
- "N leads to review in (Play)": one line per Play with leads to review (most first). Opens that Play's To review tab.
- "N replies waiting for your answer (names)": up to 3 names. Opens the sequence.
- "N LinkedIn steps to do by hand": manual-mode steps due or waiting. Opens LinkedIn accounts.
- "N Brain suggestions to accept or reject": opens the Brain.

**Since the last digest**
- "N searches finished, M new leads": opens Leads.
- "N searches stopped on an error": opens Activity.

**Spend**
- "$X of $Y spent this period, $Z left" or "$X spent this period (no limit set)": opens Usage.
- "Claude through your subscription: $X at API prices, not charged", when relevant.

The window "since the last digest" starts at the previous digest (scheduled or sent by hand). For the very first digest it covers the previous day (the previous week for a weekly digest), from local midnight.

A scheduled digest is **skipped when there's nothing new**: if nothing waits for you and nothing happened, nothing is sent (spend alone doesn't count). A digest you send by hand is always created, even when empty ("Nothing waiting for you.").

In the bell the digest is titled "Your morning digest" (scheduled) or "Your digest" (sent by hand), with the "waiting" lines as its text, and links to Home. The activity feed records "Your digest is ready" or "Pluton sent your digest by email".

## Digest schedule and timing

In Settings → Notifications → **Morning digest** ("What waits for you (leads to review, replies, LinkedIn steps, Brain suggestions) and what you spent. Skipped when there's nothing new."):

- **Frequency**: **Every weekday** (default), **Mondays**, or **Off**.
- **At**: the time, default **08:30**, in your workspace timezone (set in Settings → General). Disabled when Frequency is Off.

How the schedule works:

- Every weekday means Monday to Friday; there is never a scheduled digest on Saturday or Sunday. Mondays means once a week, on Monday.
- Pluton's background worker checks every minute. Once the local time has passed the chosen time on a digest day, it sends the digest, at most once per day.
- The worker must be running. If Pluton is off at 08:30 and you start it at 10:00 the same day, the digest is sent then. If Pluton stays off all day, that day's digest is not sent later.
- Off stops scheduled digests. You can still send one by hand from the preview.
- Each workspace has its own digest, on its own timezone and settings.

Click **Save** to apply changes. A wrong time format is refused ("Digest time must be HH:MM").

## Getting the digest by email (SMTP)

The digest is always in the app (bell and Home). To also get it by email, Pluton sends it from **your own mail server**, so you need SMTP settings.

1. Go to Settings → **API keys** → **Email** group ("Sends the morning digest from your own mailbox. Optional: the digest is always in the app.") and fill in:
   - **SMTP host**: for example smtp.gmail.com or smtp.fastmail.com.
   - **SMTP port**: 465 (TLS, the default) or 587 (STARTTLS).
   - **SMTP user**: usually your email address.
   - **SMTP password**: an app password from your mail provider, not your main password. Stored encrypted.
   - **From address** (optional): the sender; defaults to the SMTP user.
   SMTP counts as set up once host, user and password are filled.
2. Go to Settings → **Notifications** → Morning digest:
   - **Also send it by email**: shows "SMTP is set up" with a green check, or "Needs your SMTP server in API keys → Email" with a link. Turn on the **Email the digest** switch.
   - **Send to**: the recipient address (required while email is on; must be a valid address). Placeholder "you@company.com".
3. Click **Save**.

The email has the subject "Pluton: (headline)", where the headline is the first thing waiting for you (or the number of new leads, or "Nothing waiting"), the heading "Your Pluton digest", the same sections as a simple list, and the footer "Change or turn off this digest in Settings → Notifications." Its links point to Pluton at http://localhost:5173, so they open only on the computer running Pluton.

If sending fails, the digest is still put in the bell and the error reads "Digest saved in the app, but the email failed: (error)". Common causes: wrong host or port, a regular password instead of an app password, or a provider blocking SMTP.

## Previewing and sending the digest now

At the bottom of Settings → Notifications, **Next digest, as of now** shows exactly what the digest would say right now, with the same sections and links.

The button on its right depends on your setup:

- **Send it now**: when email is on, a recipient is set and SMTP is configured. It emails the digest and puts it in the bell. Result: "Sent to your inbox and to the bell."
- **Put it in the app now**: otherwise. It puts the digest in the bell only. Result: "Sent to the bell."

If emailing fails, the error appears in orange in place of the result.

A digest sent by hand:

- is always created, even when nothing is new;
- is titled "Your digest" in the bell;
- resets the "since the last digest" window, so the next scheduled digest covers only what happens after it;
- doesn't prevent the scheduled digest of the same day.

The button is disabled while a send is in progress. Use it to test your SMTP settings.

## Digest on the Home page

Home shows the live version of the digest, so you don't have to wait for the morning:

- **Waiting for you** and **Since the last digest** appear at the top of Home with the same lines and links as the digest, refreshed every 30 seconds. When nothing waits and nothing happened: "Nothing waits for you. New leads, replies and Brain suggestions will show up here."
- The **Spend** part is shown in its own **Spend this period** card on the right instead of as a digest section.

"Since the last digest" on Home uses the same window as the next digest: everything since the last digest was sent (scheduled or by hand).

## What's new page

Settings → **What's new** (/workspace/whats-new): "What changed in Pluton, newest first." Each release is a heading with a list; the newest is marked **Latest**. Most lines link to where the feature lives. Current content, newest first:

1. **The agent**: chat with Pluton about your leads, Plays, Brain and spend; changes, searches, sequences and CRM exports wait on an approval card; type a question in ⌘K to start a conversation from any page; Pluton works on a phone; Get started ticks itself off as you go.
2. **Slack, CRM and MCP**: new leads in Slack with Approve and Reject buttons; export leads to HubSpot, Attio or Pipedrive (create only); connect Claude Code, Claude Desktop or Codex over MCP.
3. **Spend and activity**: every paid call in the ledger, with a monthly budget and a cap per search; activity feed, notifications and a morning digest.
4. **LinkedIn sequences**: visit, follow, like, invite and three messages, written per lead, with a 10-minute undo.
5. **Leads**: review leads with reasons that teach the next searches, find work emails, export CSV.
6. **Plays and the Brain**: describe who to find and Pluton plans the Play and searches free sources first; edit the Brain and accept the agent's suggestions; onboarding deepsearch builds the Brain from your website.

The page is part of the app itself: it changes when you update Pluton, not from the internet.

## Troubleshooting notifications and the digest

- **The bell never shows anything.** Check the categories in Settings → Notifications → In the app are on. Notifications only appear for events listed in "What creates a notification": a search that finds no leads, for example, creates none. Background events require the worker to be running.
- **I didn't get this morning's digest.** Check, in order: Frequency isn't Off; today is a weekday (or Monday for weekly); the time has passed in the workspace timezone (Settings → General); Pluton (the worker) was running that day; and something was new: a scheduled digest is skipped when nothing waits and nothing happened.
- **The digest arrives at the wrong hour.** It uses the workspace timezone, not your computer's. Fix it in Settings → General → Timezone.
- **The email switch is greyed out.** Frequency is Off; pick Every weekday or Mondays.
- **"Needs your SMTP server in API keys → Email".** Fill in SMTP host, user and password in Settings → API keys → Email.
- **"Digest saved in the app, but the email failed: …".** Fix the SMTP settings (port 465 vs 587, app password), then use **Send it now** to test.
- **Links in the email don't open.** They point to http://localhost:5173 and only work on the computer running Pluton.
- **Budget alerts never come.** They need a monthly budget in Settings → Budget, and the Budget category on.
- **A notification is in the wrong language.** Notifications are worded when shown; switch the app language in Settings → General → Language. Emails and background items use the language you last used the app in.
- **The activity feed is missing something.** Check the filter is on All; Slack, CRM, agent, MCP and digest events only appear there.

## FAQ

**What's the difference between activity and notifications?**
Activity records everything that happened, by you and by Pluton. Notifications are the few events that need your attention, delivered to the bell, and can be muted per category.

**Can I turn off notifications for new leads only?**
Yes: Settings → Notifications → In the app → switch off New leads, then Save. Other categories keep working, and new leads still appear in the activity feed, on Home and in the digest.

**When is the morning digest sent?**
Every weekday (Monday to Friday) at 08:30 in the workspace timezone by default. You can pick Mondays only or Off, and any time. It's skipped on days with nothing new.

**Can I get the digest by email without SMTP?**
No. Pluton sends email only through your own mail server (Settings → API keys → Email). Without it, the digest is in the bell and on Home.

**How do I test the email digest?**
Set SMTP, turn on Email the digest with a Send to address, Save, then click Send it now under "Next digest, as of now".

**Does sending the digest by hand cancel today's scheduled one?**
No. The scheduled one still comes if there is something new since the one you sent by hand.

**How do I mark all notifications as read?**
Open the bell and click Mark all read. Clicking a single notification marks it read and opens it.

**How far back does the activity feed go?**
All the way: it keeps every event. Use Show older on the Activity page to page back 40 events at a time.

**Are notifications shared between workspaces?**
No. Each workspace has its own feed, bell, settings and digest.

**Why does a reply notification say "They asked something only you can answer"?**
Pluton classifies each LinkedIn reply as interested, in your hands, or not interested. "In your hands" means the person asked something only you can answer; reply from the sequence page.

**Will the digest email include my spend?**
Yes, the Spend section is in every digest: spent this period, the limit and what's left, and Claude subscription usage at API prices (not charged).

**Can the agent tell me what happened since yesterday?**
Yes. Ask it; it reads the activity feed, Plays and leads to answer.
