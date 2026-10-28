# LinkedIn sequences and outreach

## What a sequence is

Every Play has exactly one LinkedIn sequence (also called its campaign). It is the series of LinkedIn actions that the Play's leads go through once you add them. You find it on the Play page, in the **Sequence** tab ("The LinkedIn outreach this Play's leads go through."). The first time you open that tab, Pluton creates the sequence with the default steps. Deleting a Play deletes its sequence too.

The default sequence has seven steps, in this order:

1. **Visit their profile**
2. **Follow them**, 1 hour later
3. **Like a recent post**, 2 hours later
4. **Send a connection request**, 2 hours later, with no note, given up after 7 days
5. **Message 1**, 6 hours after they accept the invitation
6. **Message 2**, 3 days (72 hours) later, if no reply
7. **Message 3**, 3 days (72 hours) later, if no reply

All three messages are written by AI by default, each with its own guidelines: the opener (one specific reason you reached out to this person, drawn from their activity, and one light question, with no pitch and no link), a short follow-up (one useful thing tied to their work, then a yes/no question), and a last friendly nudge that makes it easy to say no.

Key rules that apply to every sequence:

- **Nothing is sent before they're connected.** Messages wait for the connection to be accepted. People who are already first-degree connections skip the request and go straight to the messages.
- **A reply stops the sequence** at any point. The reply is then classified and either answered automatically (once) or put in front of you.
- **Nothing runs for 10 minutes** after you add someone, so you can undo.
- **Actions only happen inside the send window** (Monday to Friday, 9:00 to 18:00 in your workspace timezone by default), within each LinkedIn account's daily limits, and spaced out with random gaps.
- **One person is in one live sequence at a time**, whichever Play found them.

Every step can be switched off or re-timed, and every message can be AI-written or a fixed template. The sequence sends from the LinkedIn accounts you set up in **Settings → LinkedIn accounts**, either through the Pluton LinkedIn extension in your own Chrome (visits and invitations done for you) or by hand through a to-do list (manual accounts). See the sections below for each part.

## The Sequence tab, at a glance

The top of the Sequence tab shows the title **Sequence**, a status pill and three buttons:

- **Status pill**: **Active** (green), **Paused** (grey), or **Waiting for LinkedIn** (orange) when no connected LinkedIn account can be used by this sequence.
- **Pause** / **Resume**: pausing stops every step of this sequence for everyone. Replies are still read while it's paused, so a reply still stops a lead's sequence. Pausing and resuming are logged in Activity ("You paused the sequence of …").
- **Configure**: opens the sequence settings panel (objective, tone of voice, language, send window, accounts).
- **Enrolled leads**: opens the list of everyone in this sequence.

Below are five counters:

- **Enrolled**: everyone ever added to this sequence.
- **Invited**: connection requests actually sent.
- **Accepted**: people known to be connected (accepted, or already connected).
- **Replies**: people who replied, followed by the reply rate (replies divided by the number of people who received at least one message), when at least one message was sent.
- **Won**: people whose reply was classified as positive.

While setup isn't finished, a card **Get your campaign running** ("Three steps and Pluton takes it from there.") lists: **Connect your LinkedIn** (link **Connect LinkedIn →**), **Set your objective** (**Set objective →**) and **Add your first leads** (**Pick from your leads →**, which opens the Play's Leads tab filtered on Approved). Each item is struck through when done. The card disappears once a LinkedIn account is connected, leads are enrolled and the objective is either set with a link or left on "Just start conversations".

The main area shows the sequence as a vertical flow from **Campaign start** to **End · a reply stops the sequence at any point**. Each step is a card; the label between cards shows its timing ("right away", "1 hour later", "Accepted · wait 6 h", "3 days later, if no reply"). Just before the connection request there is an **Already connected?** box: "Already connected leads skip the request and go straight to the messages." A small number on a step card is how many people are at that step right now. Steps that are switched off are faded and marked **Off**. AI message steps carry a ✦ sparkle.

On the right are **Replies waiting for you** and, when you use a manual account, **Your LinkedIn to-do**. Click any step card to open its settings.

## Editing a step

Clicking a step card opens a side panel. Its small heading says **Campaign message** or **Campaign step**, then the step's name (for example "Send a connection request" or "Message 2"). Two tabs: **Configure** and **Leads**.

**Configure** always has:

- **Step on** ("Off: every lead skips it."). A step that is off is skipped by everyone.
- A delay in hours, labelled **Hours after they accept** for the first message, **Hours after they join** for the visit, and **Hours after the previous step** for the others. Allowed range is 0 to 720 hours (30 days). Pluton adds a random 3 to 20 minutes to each delay so actions never land on round times. In practice the first step starts as soon as the 10-minute undo window is over and the send window is open.

Step-specific settings:

- **Follow them**: "Always a task for you: the Chrome extension doesn't follow people."
- **Send a connection request**: an **Invitation** section with **Note with the invitation** (empty means no note; "Empty sends it without a note, which tends to get accepted more. Variables work here."), limited to 300 characters (LinkedIn's limit), and **Give up after (days)**, from 1 to 30, default 7. Save with **Save invitation settings** (toast "Invitation settings saved"). These two settings apply to the whole sequence.
- **Message steps**: choose **AI** ("I write it for each lead from their activity, following your guidelines.") or **Template** ("Your exact words for everyone, with details like their first name filled in."). See the next two sections.

Click **Save** to save the step (toast "Step saved"). For a message step, when the sequence already has enrolled people, Save first asks **Apply to all future leads?**: "Leads you add from now on get this version. Leads already in the campaign keep their messages." A checkbox lets you **Also rewrite the unsent messages of leads already in (your edits to them are replaced)**. Click **Apply** to confirm. With the checkbox ticked, Pluton rewrites the not-yet-sent messages of everyone whose sequence is still running, in the background; messages already sent are never changed.

**Leads** lists who is at this step right now, with their status and, for message steps, their message text and review state. If nobody is there: "Nobody is at this step right now."

If two windows edit the same sequence, the second save fails with "This sequence changed since you opened it; reload and retry".

## AI messages and guidelines

An AI message step has **Guidelines** ("What this message should achieve. I follow them for every lead."), up to 2,000 characters. Under them: "Written in your campaign's tone of voice." with an **Edit tone** link, and the language used.

**✦ Sharpen** ("Sharpen these guidelines") asks Claude for a tighter, more concrete version of your guidelines, including what to avoid. The suggestion appears in a **Suggested** box with **Dismiss** and **Confirm**. Confirm only replaces the text in the editor; you still need to click **Save**.

How each lead's messages are written (by Claude Sonnet, one call per lead covering all AI message steps):

- **From your Brain**: the company, the voice (tone archetype and guidelines), up to six message pillars, objections to anticipate and buyer personas.
- **From the lead**: name, title, company, location, why they were picked, the signal, the evidence labels, and their three most recent LinkedIn posts when an Apify token is set (otherwise their posts are "unknown").
- **From the sequence**: the objective (a short call, trying the product, or just a conversation) and the language. The objective link is only used if a message's guidelines ask for it.

Built-in writing rules: write like a peer, not a salesperson; 2 to 4 sentences, under 600 characters; follow the step's guidelines exactly; ground the opener in something true and specific about this person and never invent facts ("if you know little, say less"); no flattery, no "I hope this finds you well", no buzzwords, no emojis unless your voice asks for them; messages 2 and 3 assume no reply and don't repeat earlier ones; first names correctly capitalised.

The **tone of voice** lives in your Brain. Changing it from the sequence (Configure → **Tone of voice**, or **Edit tone**) updates the Brain's voice for every sequence. The **language** can be set per sequence (see "Configuring a sequence").

## Template messages and variables

A **Template** step sends your exact words, with details filled in per person. The **Message text** editor ("Sent exactly as you write it, with variables filled in for each lead.") accepts up to 2,000 characters; a counter shows "{count} / 500 characters recommended" and turns orange past 500.

**Insert variable** adds one of: **First name**, **Last name**, **Full name**, **Company**, **Job title**, **Your first name**, **Objective link**. Variables are written in double curly braces, and you can give one a fallback in quotes after a vertical bar: the placeholder example is a greeting that uses the first name and falls back to "there". Inserting First name adds that fallback automatically.

**Default values** ("What I write when a lead is missing a detail.") let you set a **First name** default and a **Company** default, and two switches: **Skip leads with no first name** and **Skip leads with no company**. When a skip applies, that person's sequence stops at this step with the note "Skipped: No first name" (or "No company") and status **Stopped**.

**Preview · Sample person** shows the message filled in for a sample person (Ada Lovelace, Head of Operations at Analytical Engines). If the sample would be skipped, it says "This lead would be skipped. …". Empty template: "Write your message to see a preview".

Details worth knowing:

- Names scraped in lowercase are capitalised ("nathalie" becomes "Nathalie").
- If a variable ends up empty, the stray space before a comma or period is removed ("Hi , …" becomes "Hi, …").
- **Your first name** is the first word of the name of the first LinkedIn account added to the workspace, even when another account sends the message. With several accounts, write your name by hand if they belong to different people.
- The invitation note also accepts variables (filled with the sending account's name).

## Adding people to a sequence

You add leads from the Leads table, never from the Sequence tab itself:

- On a row, the paper-plane action **Add to campaign** (also in the right-click menu as **Add to campaign…**). It is hidden for rejected leads and for leads already in a sequence.
- With several rows selected, **Add {count} to campaign** (up to 500 at once).
- In the lead drawer's **Campaign** section, **Add to campaign** (disabled for rejected leads).

Leads don't have to be approved first, but rejected leads are refused ("Rejected lead"). Each person joins the sequence of the Play that found them, and someone already in a live sequence is refused with "Already in the {play} sequence".

This opens the dialog **Add {name} to your campaign** or **Start contacting {count} people**: "They get these messages one by one as they move through your sequence. Nothing is sent before they're connected, and a reply stops the sequence." The left column lists each person with their state; the right side shows the selected person's messages, numbered, with when each goes out ("Once you're connected", "3 days later, if no reply").

Message states: **Not written**, **Being written…**, **Not reviewed**, **Reviewed**, **Couldn't write**. Buttons:

- **Generate messages** / **Generate messages for {count}**: writes all missing or failed messages ("Writing from their activity and your Brain…"). Template steps are filled in instantly.
- **Rewrite** ("Write this person's messages again"): replaces that person's unsent messages, including your edits.
- **Mark reviewed**.
- Each message is editable in place; your change is saved when you click away (up to 1,500 characters), marked **Edited by you** and counted as reviewed. Sent messages can't be edited.

The footer reads "{count} will join: {reviewed} reviewed, {notReviewed} not reviewed". Reviewing is not required. **Add {count} to campaign** is disabled while messages are being written. If you add people without generating, their messages are written automatically when the first message is due.

After adding, **Here's what happened** lists who joins from which account, anyone not added and why, and "The first step runs after {time} (until then you can undo), inside your sending hours." A toast "{count} added. Nothing is sent for 10 minutes" has **Undo**. People added with no usable account are listed under "No account yet:" and wait until you connect one. Added leads move to the **In campaign** status; after the first invitation or message they become **Contacted**.

## Reviewing, removing and restarting

**Enrolled leads** (button on the Sequence tab) lists everyone in the sequence: name, status pill, sending account ("From {name}" or "No account yet"), **Up next: {step}, {when}** (or "(waiting for you)"), the review state of their messages, and an orange note when something needs explaining (for example "Waiting for a connected LinkedIn account").

Per person:

- **Undo (nothing sent yet)** during the first 10 minutes: they leave as if never added.
- **Remove from campaign** afterwards: the sequence stops where it is (status **Stopped**, note "Removed by you"); what was sent stays sent, and their pending manual tasks are deleted. A lead that was **In campaign** goes back to **Approved**.
- **Restart sequence** for an ended sequence: starts again from the first step, on the same account if it still exists. Messages already sent stay sent, and the same texts are reused, so a restarted person may receive the same messages again; restart only when that's what you want.
- **Log a reply**: paste a reply you saw on LinkedIn ("Paste their reply. It stops the sequence and gets classified."), up to 4,000 characters. Toast: "Reply logged: {label}" or "…, answer with your link prepared".

The **lead drawer** also has a **Campaign** section: the status, "No message confirmed sent yet" or "{count} messages sent, last {when}", **Campaign paused** if relevant, the account, **Up next**, notes, each reply with its label, and a collapsible **Messages and journey** showing every message (sent / not sent yet / not written yet) and every action with its outcome (done, skipped, failed, waiting for you). Links: **Open sequence →**, **Remove from campaign** or **Restart sequence**.

Re-adding a lead whose sequence ended also starts it over from the first step.

## Statuses of a person in a sequence

Each enrolled person shows one status:

- **Preparing messages**: just added, nothing done yet.
- **Profile visited**, **Followed**, **Post liked**: the warm-up steps done.
- **Invitation sent**: connection request sent, waiting for acceptance.
- **Connected**: they accepted (or were already connected); messages can go out.
- **Message sent**: at least one message sent, waiting for the next step or a reply.
- **Replied**: a reply arrived and was classified.
- **Replied · link sent**: positive reply answered automatically with your objective link.
- **Needs you**: a reply waits for your answer, or something can't continue without you (for example a message that couldn't be written).
- **Lost**: they said they're not interested, or the invitation wasn't accepted in time.
- **Failed**: Pluton couldn't continue (no LinkedIn profile, LinkedIn refuses this contact, or three errors in a row on the same step).
- **Stopped**: removed by you, skipped by a template rule, or its LinkedIn account was removed.
- **Sequence done**: every step ran without a reply.

Replied, Replied · link sent, Needs you, Lost, Failed, Stopped and Sequence done are final: nothing more happens until you restart. Reply labels are **Positive**, **In your hands** and **Not interested**.

## Configuring a sequence

**Configure** opens a panel with five sections. Each change applies to that Play's sequence only.

**Objective** ("The link Pluton answers with when a lead replies positively. A reply always stops the sequence."):

- **Book a meeting**: your calendar link (cal.com, Calendly…).
- **Share your app**: a link to try the product.
- **Just start conversations** (default): positive replies wait for you.

With the first two, enter a **Link** (it must start with http:// or https://) and choose **Answer positive replies with this link automatically (once per lead)**, on by default ("Off: every positive reply waits for you."). Save with **Save objective**.

**Tone of voice** ("How every AI message sounds. It comes from your Brain, so a change here updates your Brain."): **Archetype** (up to 80 characters, e.g. "warm, plain-spoken peer") and **Guidelines (one per line)**, up to 8 lines. **Save to Brain** (toast "Tone saved to your Brain"), or **Open in your Brain**.

**Language** ("The language I write every AI message in. Applies to leads you add from now on; leads already in keep their messages."): **Same as your Brain ({language})** by default, or French, English, Spanish, German, Italian, Portuguese or Dutch. Without any language set, messages follow the language of your website.

**When it sends** ("Actions only happen inside this window, in your timezone ({timezone}), spread out with random gaps."): pick **Days** (Mon to Sun) and **Hours** "From X to Y h" (start 0–23, end 1–24, end after start). **Save window**. Default: Monday to Friday, 9 to 18. The timezone is the workspace's (Settings → General → Timezone, default Europe/Paris).

**LinkedIn accounts**: a switch **Send from {name}** per account (shown with "manual" or "Chrome extension" and its status). By default every connected account is used. "New people are shared between these accounts in turn. Each person keeps the same account for the whole sequence. Changes apply to people you add from now on." With no account at all: **Connect a LinkedIn account →**.

## LinkedIn accounts settings page

**Settings → LinkedIn accounts** ("The accounts your sequences send from.") starts with a warning: "Automating LinkedIn is against its terms and can get an account restricted. Keep the daily limits low, use an account you accept to risk, and start with a few leads."

**Chrome extension**: "Visits and invitations go out from your own Chrome, with your LinkedIn session, while it is open. Messages still come to you." **Download the extension** gets a zip already set to talk to this Pluton; **Installation guide** opens [the guide](/docs/linkedin).

1. Install the extension in Chrome in developer mode (chrome://extensions → Developer mode → Load unpacked, on the unzipped folder) and sign in to LinkedIn in that Chrome.
2. Open the extension's popup and copy its token.
3. Back on this page, enter a name and paste the token, then click **Pair** (toast "Extension paired: it takes its first steps within 30 seconds"). A token already paired is refused with "This extension is already paired with a workspace".

**Or send by hand**: enter **Your name** and optionally a **LinkedIn profile URL**, then **Add manual account**. "No service, nothing automated: when a step is due, Pluton puts it in the Play's to-do with the message ready to copy, and the sequence waits until you tick it."

Each account card shows its name, a **profile** link, "Chrome extension · {count} leads in sequences" or "Manual: you do each action · …", its status (**Connected**, **Connecting**, **Disconnected**, **Error**), any error text and a bin icon (**Remove account**, confirm "Remove {name}? Its leads' sequences stop."). Removing stops those people's sequences ("Removed; {count} sequences stopped"); you can restart them later on another account.

## Daily limits and pacing

Each account has three daily limits, set on its card in **Settings → LinkedIn accounts** and saved with **Save limits** (toast "Limits saved"):

| Limit | Default | Maximum | Counts |
|---|---|---|---|
| **Visits, follows, likes per day** | 80 | 150 | profile visits, follows and likes together |
| **Invitations per day** | 20 | 40 | connection requests |
| **Messages per day** | 50 | 150 | sequence messages and automatic answers |

Under each limit, "today {count}" shows what's been used. The day is your workspace's local day, reset at midnight. Tasks handed to you, and actions queued for the extension, count as soon as they're created, even before they're done.

When an account reaches a limit, its people wait until the next day's send window (note: "{name} reached today's … limit"). The defaults are deliberately prudent: LinkedIn restricts accounts that invite too much.

How Pluton paces things:

- The sequence engine runs every 30 seconds and handles up to 25 due people per pass.
- The extension takes one action at a time and waits at least 3 minutes after an action before taking the next.
- Every delay gets a random 3 to 20 extra minutes; the first action after the window opens gets 2 to 35.
- Outside the send window nothing runs; people wait for the next opening.
- Accounts are shared in turn: the account with the fewest people in live sequences takes the next person, and a person who already had an account (from any sequence) keeps it.

## Sending through the Chrome extension

With a paired extension, the account's steps go like this:

- **Visit their profile**: queued for the extension, which opens the profile in a background tab of your Chrome, scrolls a little and closes it (a real visit, which they may see).
- **Send a connection request**: queued for the extension, which opens the profile, presses Connect (or finds it under More), adds your note if you set one, and sends. If an invitation is already pending it counts as sent; if you're already connected, messages start. If LinkedIn asks for the person's email, or a button can't be found, the step comes to you as a task with the reason ("The extension couldn't do it (…): do it yourself").
- **Follow them**, **Like a recent post** and **Messages**: tasks for you, as with a manual account.

The extension checks in with Pluton every 30 seconds while Chrome is open. While Chrome is closed, or LinkedIn is signed out there (the account shows **Disconnected**, "LinkedIn is signed out in this account's browser: sign back in there"), queued steps wait. An action taken by a browser that never answered goes back to the queue after 5 minutes.

Pluton doesn't see when an invitation is accepted, nor read LinkedIn conversations: mark acceptances and log replies yourself, as with a manual account.

## Sending by hand with a manual account

A manual account automates nothing. When a step is due (inside the send window and within the account's limits), Pluton creates a task and the person's sequence waits until you act. Tasks appear on each Play's Sequence tab under **Your LinkedIn to-do · {count}** ("Manual accounts: do it on LinkedIn, then tick it. The sequence waits for you."), oldest first.

Each task shows the action (**Visit their profile**, **Follow them**, **Like a recent post**, **Send a connection request**, **Send the message**, **Answer their positive reply**), the account, the person with **Open profile ↗**, an instruction ("Send a connection request, without a note", "Like their most recent post"…) and, for messages and notes, the text with **Copy**. Buttons:

- For a visit: **Done · not connected** or **Done · already connected**. Saying you're already connected makes the connection request skip and messages start.
- For everything else: **Done**.
- **Skip**: marks it skipped and moves on to the next step without doing it.

After you mark an invitation done, the person appears as **Waiting for {name} to accept** ("Invited {when}. Tell me when they accept.") with **Accepted** (starts the message timer from now) and **Give up** (person becomes **Lost**, "Invitation not accepted"). The give-up delay still applies: after 7 days by default they're marked Lost automatically.

Pluton doesn't read LinkedIn conversations: when someone answers, use **Log a reply** in Enrolled leads so the sequence stops and the reply is classified. Positive replies answered automatically become an **Answer their positive reply** task with the text ready.

The morning digest counts these as "{count} LinkedIn steps to do by hand".

## Replies, classification and automatic answers

When a reply arrives (an email read from your mailbox, or a LinkedIn reply you logged), Pluton:

1. Stops the sequence immediately and deletes any message tasks you hadn't done yet.
2. Classifies it with Claude Haiku: **Positive** (interested, wants to talk, asks for the link or a time), **Not interested** (declines, asks to stop, wrong person with no lead) or **In your hands** (a question, a referral, an out-of-office, anything ambiguous; the default when unsure). It also writes a one-line summary. If classification fails: In your hands, "Couldn't classify; read it yourself".
3. Records it on the lead's timeline, in Activity ("{name} replied (interested)") and as a notification "{name} replied" (category **Replies**).

Then:

- **Positive**, with an objective of Book a meeting or Share your app, a link, and automatic answers on, on the person's first reply: Pluton writes one short answer (one or two sentences, a warm thanks then the link, no pitch, in the sequence's language) and sends it by email when the reply came by email; status **Replied · link sent**. A LinkedIn reply gets it as an **Answer their positive reply** task instead. This happens at most once per person.
- **Not interested**: status **Lost**, nothing waits for you.
- **Everything else** (positive without automatic answer, In your hands, or an automatic answer that failed): status **Needs you**, and the reply appears in **Replies waiting for you** on the Sequence tab with the text, label, summary, **Answer on LinkedIn ↗** (opens their profile) and **Mark handled**. Empty state: "None. Positive replies get your link automatically when the objective allows it."

The digest lists "{count} replies waiting for your answer".

## Errors and how Pluton handles them

Notes shown in orange on a person (Enrolled leads, lead drawer) explain what's happening:

- **"Waiting for a connected LinkedIn account"**: no usable account. Retries every hour. Connect or switch on an account.
- **"{name} is disconnected"** / "is connecting" / "has an error": the assigned account isn't connected. Retries every hour. For an extension, open Chrome and sign in to LinkedIn there.
- **"{step} couldn't be written"**: the message couldn't be generated at send time. Status Needs you. Open the add dialog again or restart after fixing (check Claude access in Settings → API keys).
- **"Writing was interrupted; generate again"**: the worker stopped mid-writing for more than 5 minutes. Click **Generate messages**.
- **"Not connected, and the sequence has no connection request step"**: you switched off the invitation step and the person isn't a connection.

Any other error is retried after 1 hour, then 2 hours; after three failures on the same step the person is **Failed** with the error text. Settings errors include "The window must end after it starts".

## Safety and good practice

Pluton's guardrails around LinkedIn:

- Prudent daily limits per account (80 / 20 / 50 by default), hard maximums of 150 / 40 / 150.
- One action at a time per extension, at least 3 minutes apart, with random gaps, only during working hours.
- No note on invitations by default, and invitations given up after 7 days.
- A 10-minute undo after adding people; nothing goes out before you can review the messages.
- One live sequence per person, and every reply stops everything.
- At most one automatic answer per person, and only for positive replies with a link you chose.
- The in-app agent and connected AI clients can only add people to a sequence after your explicit yes for those people (see the Agent and AI clients documentation).

Good practice: start with a few leads, keep limits low for new or rarely used accounts, review the first messages carefully (edit them in the add dialog), use an account you accept to risk, and check **Replies waiting for you** daily. Automating LinkedIn is against LinkedIn's terms and can get an account restricted.

## FAQ

**Q: I added leads but nothing has happened yet. Why?**
A: Check, in order: the 10-minute undo window; the send window (default Monday–Friday 9:00–18:00 in your workspace timezone); whether the sequence is **Paused**; whether a LinkedIn account is connected (the pill says **Waiting for LinkedIn** otherwise); and the account's daily limits. The note on each person in **Enrolled leads** usually says which one applies.

**Q: Do I have to review every message before adding someone?**
A: No. Reviewing is optional; the dialog just shows how many are reviewed. If you add people without generating messages, they're written automatically when the first message is due.

**Q: Will Pluton message someone who hasn't accepted my invitation?**
A: No. Messages wait for the connection. People who are already first-degree connections skip the invitation and go straight to the messages.

**Q: Why is the Follow step always a task?**
A: It isn't skipped: the extension doesn't follow people, so it always comes to you as a task.

**Q: How do I stop a sequence for one person?**
A: In **Enrolled leads** or the lead drawer, click **Remove from campaign** (or **Undo (nothing sent yet)** in the first 10 minutes). A reply also stops it automatically; for LinkedIn replies, use **Log a reply**.

**Q: I changed a message's guidelines. Do people already in the sequence get the new version?**
A: Not unless you tick "Also rewrite the unsent messages of leads already in" when saving. That rewrites their unsent messages and replaces your edits; sent messages never change.

**Q: Can the same person be contacted by two Plays?**
A: No. A person can be in only one live sequence at a time; adding them elsewhere is refused with "Already in the {play} sequence".

**Q: What happens when someone replies "yes, let's talk"?**
A: The sequence stops, the reply is classified Positive, and if your objective is Book a meeting or Share your app with a link and automatic answers on, Pluton sends one short thank-you with the link. Otherwise it waits in **Replies waiting for you**.

**Q: What does "Lost" mean?**
A: The person said they're not interested, or the invitation wasn't accepted within the give-up delay (7 days by default), or you clicked **Give up** on a manual invitation.

**Q: Can I send without the extension?**
A: Yes. Add a manual account in Settings → LinkedIn accounts. Pluton prepares each step with the text ready to copy in the Play's to-do list, and you tick it when done.

**Q: How do I change the sending hours or days?**
A: Sequence tab → **Configure** → **When it sends**. Each Play's sequence has its own window. The timezone is set in Settings → General.

**Q: Is my LinkedIn account at risk?**
A: Automating LinkedIn breaks its terms and can lead to restrictions. Pluton keeps limits low and paces actions like a person, but use an account you accept to risk and start small.
