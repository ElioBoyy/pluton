# Leads

## What a lead is

A lead is a real person a Play found, checked and scored as a possible buyer, waiting for your verdict. Each lead combines:

- **The person**: name, job title, company, company website, location, LinkedIn profile, work email (once found). Pluton keeps one record per real person in your workspace, shared by every Play that finds them.
- **The Play** that found them, and the **search** (run) that did.
- **Fit** (0 to 100): how well they match your ideal customer, scored by the judge.
- **The judge's verdict** ("stage"): **Strong match** (fit 70+) or **Worth a look** (45 to 69). People below 45 are **Set aside** and never become visible leads.
- **Warmness** (0 to 100): how much timing intent the signal that surfaced them carries.
- **Why they fit**: a one-sentence reason from the judge, naming the concrete match.
- **Signal**: why this person surfaced ("Hiring a data engineer (posted 3 days ago)", "Commented on a post by …"), and a short signal label ("Their company is hiring").
- **Evidence**: up to four sources (label and link) backing the signal.
- **Status**: where they are in your review: To review, Approved, In campaign, Contacted or Rejected (and "New" while unopened).
- **Timeline**: everything that happened to them, plus your notes.

Where leads live:

- **/leads** (the **Leads** entry in the sidebar): every lead from every Play. It opens on the **To review** tab.
- A Play's **Leads** tab: the same view limited to that Play. It opens on **All**.

The page's description sums it up: "Everyone your Plays found and qualified, with why they fit. Approve the right ones; reject the rest with a reason so the next search is better."

How Plays search is documented in the Plays documentation; this page covers what happens from the moment a candidate is found.

## How a candidate becomes a lead

Each search of a Play collects candidates (from Claude's web research, the French company registry, company careers boards, website tech detection, or LinkedIn through Apify), then puts every candidate through the same steps:

1. **Code checks** (no AI). Candidates are dropped if they have no job title, or neither a company nor a LinkedIn profile; if they work at your company or a competitor (names from the Play's Brain snapshot); if their company or name matches one of the Play's exclusions; or if you already rejected them in any Play.
2. **Deduplication**. The person is matched with the people already in your workspace. If they are already a lead of this Play (or appeared twice in the same search), they are skipped.
3. **LinkedIn lookup**. People without a LinkedIn URL get one looked up.
4. **Scoring**. The judge scores each person against your company, ICP and buyer personas and your recent verdicts, in batches of 10.
5. **Saving**. Strong matches and worth-a-look people become leads with status **To review** and a "Qualified as a lead" timeline entry. Set-aside people are recorded only in the Play's Sourcing report.

People dropped at steps 1 and 4 are counted with examples under "Set aside in the latest completed run" on the Play's Sourcing tab, by reason: Missing title or company, Your company or a competitor, You rejected them before, Matched an exclusion, Wrong role, Wrong seniority, Organization outside the ICP, Wrong geography, Not scored, Other.

During a search, the Play's Overview shows each scored person live, with their fit.

## Deduplication: one person, many Plays

Pluton keeps one record per real person in a workspace. To recognise the same person across searches and Plays it uses:

- their **LinkedIn profile id** when known (the part after linkedin.com/in/, case-insensitive);
- otherwise their **name and company**, compared without accents, capitals or extra spaces.

When a person is found again, Pluton keeps what it already knew and fills only the gaps (title, company, website, LinkedIn, location). A later search never wipes data found earlier.

Rules that follow:

- **Within one Play**, a person is a lead at most once. Later searches of the same Play skip them (counted as duplicates, not as new leads). This also applies to people the judge set aside in that Play: they are not re-scored there.
- **Across Plays**, the same person can be a lead of several Plays, each with its own fit, reason, status and timeline. The lead drawer lists the others under **Also found by**, with each one's status.
- **Rejected anywhere means rejected everywhere**: once you reject a person in any Play, no Play brings them back (see "Rejected people never come back").
- Email and LinkedIn found for a person belong to the person, so they show on every lead of that person.

Limits of matching: if one search knew a person only by name and company and another found their LinkedIn profile first, the two may be stored as two people until a LinkedIn URL links them. Different spellings of the company name can have the same effect.

## LinkedIn profile lookup

A LinkedIn profile URL is needed for LinkedIn outreach, so every search looks one up for each kept person who doesn't have one.

How it works:

- Claude searches the web for each person with their organization and title, in batches of 8 people (up to 2 searches per person, 12 per batch).
- A LinkedIn profile URL (linkedin.com/in/…) counts, and so does a LinkedIn post URL by that person (search engines index posts more than profiles): Pluton turns the post's author id into the profile URL.
- A URL is accepted only if the profile id contains part of the person's name (a name part of at least 3 letters). Claude is told to leave a person out rather than guess.
- Results are cached per person (name and company): a profile found is remembered for **30 days**, a miss for **3 days**, so later searches don't pay twice.

It uses your Claude access (your subscription by default, so not billed). Each search's funnel shows how many were found under **LinkedIn found**, and the narration says "Looking up LinkedIn profiles for {count} people…".

People from the LinkedIn pipelines (Engagement on tracked profiles, People posting about keywords) already come with their profile URL, so they skip this step.

**From the lead drawer**: when a lead has no LinkedIn URL, the **LinkedIn** row shows a **Find LinkedIn** button that runs the same lookup for that one person. If found, it shows **Profile** with a link, and the timeline adds "LinkedIn profile found". If not, a message says "No LinkedIn profile found for {name}" and the timeline adds "Looked for a LinkedIn profile, none found". Because misses are remembered for 3 days, pressing the button again within 3 days gives the same answer.

When a LinkedIn URL is known, a small LinkedIn icon appears next to the lead's name in the table (opens the profile).

## Fit scoring: the judge

The judge is a Claude agent (no web access) that scores every kept candidate. It reads:

- your company, ICP and buyer personas, from the Play's Brain snapshot;
- the Play's audience (titles, industries, sizes, geographies, keywords, hiring roles, technologies, exclusions);
- your **recent verdicts on leads** (see "How your verdicts train later searches"), which override the ICP where they disagree;
- for each candidate: name, title, company, location and signal.

It is told to be strict and specific. For each candidate it returns:

- **Fit 0–100**: does the organization match the ICP (industry, size, geography) and does the role match a buyer persona (title, seniority)?
- **Stage**:
  - **Strong match** ("qualified"): fit 70 or more, organization and role both match.
  - **Worth a look** ("needs review"): fit 45 to 69, or one side uncertain.
  - **Set aside** ("disqualified"): fit below 45, with a reason: wrong role, wrong seniority, wrong company (shown as "Organization outside the ICP"), wrong geography, or other.
- **Reason**: one sentence you read in the lead list, naming the concrete match, in your app language (job titles and organization names kept as written).

Candidates the judge didn't return a verdict for are counted as **Not scored** and not saved.

Where you see the result:

- The **Fit** column and the drawer's Fit meter (for example 82/100, green bar).
- The drawer's grey pill: **Strong match** or **Worth a look**.
- The Play's funnel: **Qualified** (strong) and **To review** (worth a look).
- The CSV's "Judge verdict" column: qualified or needs_review.

A strong match counts as one toward a search's target, a worth-a-look lead as half of one. Both kinds wait for your verdict in **To review**: the judge's stage says how sure it is, you decide.

## Warmness

Warmness (0 to 100) says how much **timing intent** the signal carries: someone who engaged with a post this week is warmer than someone who merely holds the right title. It depends only on the signal that surfaced the lead:

| Signal | Signal label | Warmness |
|---|---|---|
| Engagement on tracked profiles | Engaged with a post you track | 85 |
| People posting about keywords | Posted about your topics | 70 |
| Companies hiring | Their company is hiring | 60 |
| Recently funded | Their company just raised | 55 |
| Tech stack | Their company uses your target stack | 40 |
| Web evidence | Matches your criteria | 35 |
| Lookalikes of your customers | Looks like your best customers | 25 |
| Role match | Matches your ideal customer | 20 |

For Main Play leads, the warmness is that of the stage that found them.

**Fit vs warmness**: fit is *who* they are (do they match your ideal customer); warmness is *when* (is there a reason to reach out now). A high-fit, high-warmth lead is the best one to contact first.

Use **Sort → Warmest first** to put warm leads on top, and the **Warmness** column (hidden by default; turn it on in **Columns**) to see the number. The drawer shows it as an orange meter.

## Why they fit, signal and evidence

Every lead explains itself in three layers:

- **Signal label**: a short, fixed phrase per signal type ("Their company is hiring", "Engaged with a post you track", …). It is the first line of the **Why they fit** column and the bold title of the drawer's **Why they fit** section.
- **Reason**: the judge's one-sentence explanation ("Head of Data at a 120-person logistics company in Lyon; hiring two data engineers"). Second line of the Why they fit column, and the body of the drawer section.
- **Signal**: the raw reason the person surfaced, written by the research (or by Pluton for LinkedIn pipelines: "Commented on a post by {author}", "Reacted to a post by {author}", "Posted about “{keyword}”"). Shown in the drawer as "Signal · …".

**Evidence**: up to four sources found by the research, each with a label and usually a link: the job post, the funding article, the LinkedIn post ("Post by {author}"), the customer page. In the drawer's **Evidence** section, linked items open in a new tab. Evidence is also exported in the CSV (links separated by " | ").

Hover the Why they fit cell in the table to read the full reason and signal in a tooltip.

## Seniority from the job title

Pluton reads a seniority level from each lead's job title, in English and French, and labels it as read from the title, for example "C-level (from title)". Levels, checked in this order (the first match wins):

- **Founder**: founder, co-founder, fondateur, fondatrice, cofondateur…
- **C-level**: CEO, CTO, CFO, COO, CMO, CIO, chief…, PDG, president/présidente, directeur général / directrice générale, DG, délégué général, secrétaire général, managing director.
- **VP**: VP, vice president, vice-présidente.
- **Director**: director, directeur, directrice, head of, direction.
- **Manager**: manager, responsable, lead, chef, team lead.
- **Intern**: intern, stagiaire, alternant(e), apprenti(e).
- **Individual contributor**: chargé(e), specialist, analyst, analyste, consultant(e), officer, assistant(e), coordinator, engineer, ingénieur(e), developer, développeur.

If nothing matches, the drawer shows "—".

Where it appears: the drawer's **Seniority** row and the CSV's "Seniority (from title)" column. It is informational only: the judge reads the title itself when scoring seniority.

## Lead statuses

A lead's status says where it is in your review and outreach:

- **New** (blue): a To review lead you haven't opened yet. Opening it in the drawer (or approving or rejecting it) removes the New mark. In the table, a blue dot also sits on its initials.
- **To review** (yellow): waiting for your verdict. Every new lead starts here, strong match or worth a look.
- **Approved** (green): you marked it a good lead.
- **In campaign** (purple): added to the Play's LinkedIn sequence. The pill adds the sequence step, for example "In campaign · Preparing messages" or "In campaign · Invitation sent".
- **Contacted** (pink): the first invitation or message went out. The pill also adds the sequence step, for example "Contacted · Replied".
- **Rejected** (grey): you marked it not a fit.

How statuses change:

- Approve → **Approved**, except for leads already In campaign or Contacted, which keep their status (your verdict is still recorded).
- Reject → **Rejected**, whatever the status before.
- Undo a verdict → back to the status it had before the verdict, unless it moved on since (for example it joined a campaign).
- Adding to the sequence → **In campaign** (a Contacted lead stays Contacted).
- Removing from the sequence → an In campaign lead goes back to **Approved**.
- First invitation or message sent → **Contacted**.

Rejecting a lead changes its status; it does not by itself stop a sequence already running for that person (remove them from the sequence in the drawer's Campaign section; see the sequences documentation).

## The Leads page and a Play's Leads tab

Both show the same lead view; the only differences are the scope (all Plays vs one Play), the default tab (**To review** on /leads, **All** in a Play) and the Play column (shown by default on /leads only).

From top to bottom:

1. **Status tabs** with counts: All, New, To review, Approved, In campaign, Contacted, Rejected.
2. **Review progress** on the right: a green bar and "{reviewed} of {total} reviewed" (hover: "Leads with your verdict, or already in a campaign").
3. **Toolbar**: search box, Signal filter, Sort, then **Columns** and **Export** in one capsule.
4. **Selection bar** when leads are ticked (bulk actions).
5. **The table**, 50 leads at a time, with **Show more ({count} left)** at the bottom.
6. **The lead drawer**, sliding in from the right when you click a lead.

The tab and the open lead are part of the address, so you can bookmark or share them: on /leads, ?tab=approved&lead=<id>; in a Play, ?tab=leads&status=approved&lead=<id>.

Empty states: "No leads yet. Run a search from a Play." (All tab, nothing found yet), "No leads here." (an empty tab), "No lead matches these filters." (search or Signal filter active).

Judge-set-aside people never appear here: only strong matches and worth-a-look leads are leads. Leads of archived Plays still appear.

## Status tabs and review progress

The tabs filter the table by status. Each shows its count for the current scope, search and Signal filter:

- **All**: every lead.
- **New**: To review leads you haven't opened yet.
- **To review**: every lead waiting for a verdict, opened or not (New leads are included here too).
- **Approved**, **In campaign**, **Contacted**, **Rejected**: by status.

Counts are computed with the search box and Signal filter applied, so filtering by "Their company is hiring" shows how many hiring-signal leads wait in each tab.

**Review progress**: "{reviewed} of {total} reviewed", where total is all leads in scope and reviewed is everything not To review (approved, rejected, in a campaign or contacted). It reaches 100% when nothing waits for you.

The sidebar mirrors this: the **Leads** entry shows the number To review across all Plays, and each Play in the sidebar shows its own To review count.

The tab strip scrolls sideways on narrow windows instead of wrapping.

## Search, Signal filter and Sort

**Search** ("Search name, title, company, location"): matches any part of the person's name, job title, company or location. It applies a quarter of a second after you stop typing, across all leads in scope (not just the 50 shown).

**Signal** ("Every signal" by default): shows only leads surfaced by one kind of signal: Role match, Companies hiring, Tech stack, Web evidence, Lookalikes of your customers, Recently funded, Engagement on tracked profiles, People posting about keywords. Main Play leads are filtered by the stage that found them (there is no "Main Play" entry).

**Sort**:
- **Newest first** (default): most recently found first, then best fit.
- **Best fit first**: highest fit first, then newest.
- **Warmest first**: highest warmness first, then best fit.

Changing the search, the Signal filter or the tab resets the page to the first 50 leads and clears your selection. Search, filter and sort are not saved: they reset when you leave the page.

## Columns

Click **Columns** in the toolbar to choose which columns the table shows. A tick marks each visible column. Available columns, in their fixed order:

- **Position**: job title. When hidden, the title appears in small type under the name.
- **Company**: with a small arrow linking to the company website when known.
- **Location**.
- **Status**: the coloured status pill (with the sequence step for leads in a campaign).
- **Why they fit**: signal label, then the judge's reason (hover for the full text).
- **Fit**: 0 to 100.
- **Warmness**: 0 to 100.
- **Email**: the address if found (shown in yellow when it is an unverified guess, hover: "Guessed, unverified"); "None found" if a lookup found nothing; "Open to find" if nobody looked yet.
- **Play**: the Play that found the lead.
- **Found**: the date it was found.

Defaults: Position, Company, Location, Status, Why they fit, Fit, plus Play on the Leads page. Your choice is remembered on this device (the same choice applies to the Leads page and every Play's Leads tab).

The **Lead** column (avatar with initials, name, LinkedIn icon) and the selection checkbox are always shown.

## The table and row actions

Each row is one lead. Click anywhere on it to open the lead drawer; the open lead's row is highlighted. Ticked rows get a lighter highlight.

**Row actions** appear in a small capsule at the right of the row when you hover it (on touch screens they sit in their own column):

- **Good lead** (thumbs up): approves it at once, with an Undo message. Stays green when the lead is approved.
- **Not a fit** (thumbs down): opens the reject popover with reasons. Stays filled when the lead is rejected.
- **Add to campaign** (paper plane): opens the "add to your campaign" window for this lead. Hidden when the lead is rejected or already in a sequence.
- **Add a note** (speech bubble): opens the drawer with the note field focused.

Other clickable bits: the LinkedIn icon next to the name opens the profile; the arrow next to the company opens its website. Neither opens the drawer.

Right-click a row for the full lead menu (see "The lead menu").

**Show more ({count} left)** loads 50 more rows. Moving past the last loaded lead with ↓ in the drawer also loads more.

## Selecting leads and bulk actions

Tick the checkbox on a row to select it; the header checkbox ("Select all on this page") selects every loaded row. When all loaded rows are selected and more leads match, **Select all {count}** selects every lead matching the current tab, search and Signal filter (up to 5,000).

A floating selection bar appears with "{count} selected" and:

- **Approve {count}**: approves them all.
- **Reject {count}**: opens the reject popover ("Reject {count} leads"); the reasons and comment apply to all.
- **Add {count} to campaign**: opens the message review before they join their Play's sequence. Disabled above 500 leads.
- **Find emails**: looks up work emails for the selection as a background task (see "Finding emails in bulk"). Disabled above 200 leads.
- **Delete**: deletes them after confirmation.
- **To {CRM}**: creates them in a connected CRM (only when a CRM is connected; see integrations).
- **Export {count}**: downloads them as CSV.
- **×** ("Clear selection").

After approving, rejecting or adding to a campaign, the selection clears. Approvals and rejections show a message with **Undo** for the whole batch, for example "Approved 12 leads".

Changing tab, search or filter clears the selection.

## The lead drawer: header and verdict

Click a lead to open its drawer on the right (full width on a phone).

**Top bar**:
- **Previous lead (↑)** and **Next lead (↓)** buttons (only from a list), and the reminder "↑↓ move · A approve · R reject".
- **More actions** (three dots): the lead menu, starting at Good lead.
- **Close (Esc)**.

**Header**: the person's initials, name, "title @ company", the status pill (Approved, To review, …) and a grey pill with the judge's stage (**Strong match** or **Worth a look**).

**Verdict area**:
- With no verdict yet: **Good lead** and **Not a fit** buttons.
- After approving: "You marked this a good lead", a thumbs-down button to switch to Not a fit, and **Undo**.
- After rejecting: "You marked this not a fit", your reasons underneath, an **Approve instead** button (thumbs up), and **Undo**.

Opening a New lead marks it as seen: it leaves the New tab but stays in To review until you give a verdict.

If the lead was deleted meanwhile, the drawer shows "Lead not found".

## The lead drawer: fields

Under the verdict, a group of fields:

- **Email**: the address (click to write an email), with where it came from and its confidence underneath, for example "Hunter, verified · 94% confidence", "Found on a public page · 85% confidence" or "Guessed from the site's address pattern, unverified · 25% confidence" (in orange). Without an address: a **Find email** button (or **Search again** after a miss), "No email found on {date}" after a miss, and a line saying what a lookup will use and cost (see "Finding a lead's email").
- **Title**: the job title.
- **Seniority**: read from the title, for example "Director (from title)", or "—".
- **LinkedIn**: **Profile** (opens it) or a **Find LinkedIn** button.
- **Company**: the company name and its website link.
- **Location**.
- **Play**: the Play that found the lead; click to open that Play's Leads tab.
- **Fit**: green meter and "N/100".
- **Warmness**: orange meter and "N/100".

Then the sections:

- **Campaign**: the lead's place in the Play's LinkedIn sequence (add, messages, steps, replies, remove). Documented with sequences.
- **CRM**: shown only when a CRM is connected or the lead was exported; export status per CRM. Documented with integrations.
- **Why they fit**, **Evidence**, **Also found by**, **Timeline**: see the next sections.

## The lead drawer: why they fit, evidence, other Plays, timeline

**Why they fit**: the signal label in bold, the judge's reason, then "Signal · " and the raw signal.

**Evidence**: each source on its own line; linked sources open in a new tab. Hidden when there is none.

**Also found by**: other Plays that found the same person, each with that lead's status pill. Click a Play name to open that Play's Leads tab with this person's lead open. Hidden when only one Play found them; Plays where the judge set them aside are not listed.

**Timeline**: a note field at the top ("Add a note…", up to 2,000 characters, press Enter or **Add**), then every event, newest first, with date and time:

- "Qualified as a lead · {Strong match / Worth a look}, fit {N}/100"
- "You marked this a good lead"
- "You marked this not a fit · {reasons} · “{comment}”"
- "You undid your approval" / "You undid your rejection"
- "Email found: {email} ({source})" / "Looked for an email, none found"
- "LinkedIn profile found" / "Looked for a LinkedIn profile, none found"
- "Exported to CSV"
- your notes, in full
- sequence and CRM events (added to or removed from the campaign, exports)

Notes stay in Pluton: they are not exported to CSV or to a CRM (the Agent can read them when you ask it about a lead). They can't be edited or deleted individually; deleting the lead removes them.

## Keyboard shortcuts in the lead drawer

While the drawer is open (and you're not typing in a field):

- **↓** or **J**: next lead in the list (loads more when you reach the end of the loaded rows).
- **↑** or **K**: previous lead.
- **A**: approve (Good lead).
- **R**: open the reject popover (Not a fit).
- **Esc**: close the drawer (or close the reject popover if it is open).

Shortcuts are ignored while the cursor is in an input, text area or menu, and when ⌘, Ctrl or Alt is held, so typing a note never approves a lead.

A fast review routine: open the first lead in **To review**, read the reason and evidence, press **A** or **R** (pick reasons, **Submit**), then **↓** to open the next lead still waiting (the one you just judged has left the To review list).

The right-click menu shows the same letters next to **Good lead** (A) and **Not a fit…** (R) as reminders.

## Approving a lead

Approve a lead when it is someone you'd want to contact. Ways to approve:

- **Good lead** in the drawer, or press **A**.
- The thumbs-up row action.
- **Good lead** in the right-click menu (greyed out if already approved).
- **Approve {count}** in the selection bar.
- **Approve instead** in the drawer of a rejected lead.
- From Slack (the Approve button on posted leads), the Agent, or an AI client through MCP (see integrations and the Agent).

What happens:

- The status becomes **Approved** (leads already In campaign or Contacted keep their status).
- The verdict is recorded with the time; the timeline adds "You marked this a good lead".
- The lead is marked as seen.
- Activity records "You approved {count} leads in {play}" (or "… from Slack", "… from your AI client").
- A message "Approved {name}" (or "Approved {count} leads") offers **Undo**.
- If a CRM is set to export on approval, the lead is sent there (see integrations).

Approving does not contact anyone. To start outreach, add the lead to the Play's sequence (row action, menu, or the **Approved** tab then **Add {count} to campaign**; the Sequence tab's lead picker opens on Approved).

Approved leads also teach the judge: similar people are scored the same way in later searches.

## Rejecting a lead, with reasons

Reject a lead when it isn't a fit. Ways to reject:

- **Not a fit** in the drawer, or press **R**.
- The thumbs-down row action.
- **Not a fit…** in the right-click menu (greyed out if already rejected).
- **Reject {count}** in the selection bar.
- From Slack, the Agent or an AI client.

The **reject popover** appears, titled "Not a fit" (or "Reject {count} leads"), with "Add a reason? (optional) It updates your Brain, so the next search is better." Pick any number of reasons (they turn accent-coloured):

- **Wrong role**
- **Wrong seniority**
- **Wrong industry**
- **Wrong company size**
- **Wrong location**
- **Outdated profile**
- **Competitor or partner**
- **Other**

Optionally write a comment in "Anything else?" (up to 1,000 characters), then press **Submit**. **Cancel**, Esc or a click outside closes it without rejecting. Reasons and comment are optional: Submit with nothing selected still rejects.

What happens:

- The status becomes **Rejected**; the timeline adds "You marked this not a fit · {reasons} · “{comment}”".
- A message "Rejected {name}" offers **Undo**.
- Activity records "You rejected {count} leads in {play}".
- The person is excluded from every future search of every Play.
- The reasons and comment are used by the judge and the Brain review (see the next sections).

Good reasons make a difference: "Wrong company size" with "they're 5,000 people, we sell to SMBs" teaches far more than a bare rejection.

## Undoing or changing a verdict

Every verdict can be undone:

- **Undo** in the message that appears right after approving or rejecting (single lead or bulk).
- **Undo** next to the verdict in the lead drawer, at any time later.

Undoing withdraws the verdict and puts the lead back to the status it had before your verdict (usually To review). If the lead moved on since (for example you approved it and then added it to a campaign), the status is left as it is and only the verdict is withdrawn. The timeline adds "You undid your approval" or "You undid your rejection".

**Changing your mind** doesn't need an undo: approving a rejected lead (**Approve instead**, or A) or rejecting an approved one replaces the previous verdict. Only one verdict per lead is active at a time; if you later undo the new one, the lead returns to where it was before **any** verdict, not to the replaced one.

A withdrawn verdict no longer teaches the judge, no longer counts toward the Brain review threshold, and an un-rejected person can be found again by later searches.

## How your verdicts train later searches

Your verdicts are the strongest signal Pluton has. They feed back in three ways.

**1. The judge scores similar people the same way.** At the start of every search, Pluton reads your 30 most recent active verdicts (approvals and rejections, with reasons and comments) and gives the judge up to 10 rejected and 10 approved examples, written as "name, title @ company (location) — reasons — comment". The judge is told these verdicts override the ICP where they disagree. So rejecting a few "Wrong seniority" interns lowers the scores of similar interns next time, and approving people the ICP missed raises similar ones.

**2. Rejected people never come back** (next section).

**3. Repeated rejections trigger a Brain review.** When **5 rejections** (not withdrawn) have piled up since the last Brain review started, Pluton queues a Brain review focused on them: "The founder just rejected several leads. Read their reasons and fix what in the Brain led the search there." The review can only **propose** changes (personas, company sizes, geographies, …); its proposals wait for you on the Brain page, with a notification "The Brain has {count} suggestions". Nothing changes until you accept. A review already running is not doubled. The daily Brain review (if switched on) also reads your verdicts and the reasons runs set people aside.

Remember that existing Plays keep the Brain snapshot from their creation: accepted Brain changes reach new Plays. Points 1 and 2 apply to every Play immediately.

## Rejected people never come back

Once you reject a person in **any** Play, every later search of **every** Play drops them during the code checks, before the LinkedIn lookup and the judge. They are counted on the Play's Sourcing tab as "You rejected them before".

Details:

- It is per person, not per lead: rejecting "Marie Dupont" in one Play keeps her out of all Plays (as long as Pluton recognises her as the same person; see "Deduplication").
- It is based on the lead's current status. If you **undo** the rejection, or approve the lead instead, the person can be found again.
- **Deleting** a rejected lead also removes the rejection: the person can come back. To keep someone out, reject them and keep the lead.
- Deleting a Play deletes its leads and so its rejections.
- People the judge set aside are not on this list: another Play with a different audience may still find and score them.
- Rejected leads stay visible in the **Rejected** tab, with their reasons, and are included in CSV exports.

Rejecting does not erase what Pluton knows about the person (email, LinkedIn); it only keeps them out of searches.

## Finding a lead's email

Leads don't come with an email. Look one up from the drawer's **Email** row with **Find email** (or **Search again** after a miss). A line under the row says what the lookup will use:

- No Hunter key: "Checks public pages and the company site (free). Add a Hunter key in Settings → API keys for verified emails."
- Hunter key set: "Free sources first, then 1 Hunter search if needed ({left} left this month)".
- Hunter key not working: "Free sources first, then Hunter (unavailable: {error})", for example "key rejected, fix it in Settings → API keys".

The lookup tries, in order, and stops at the first address found:

1. **An address already in the research**: in the lead's signal, reason or evidence, if it matches the person's name. Source "Found on a public page", confidence 80%.
2. **The company's own website**: Pluton reads the home page and, when they exist, /contact, /nous-contacter, /mentions-legales, /equipe, /notre-equipe, /a-propos, /about, /team and /presse, and collects every address on the company's domain. An address matching the person's name is used: "Found on a public page", confidence 85%. Needs the company website. The site scan is cached 30 days.
3. **Hunter** (only with a Hunter key, and a company website or name): Hunter's email finder from first name, last name and domain (or company name when there is no website, less reliable). Source "Hunter, verified", with Hunter's own confidence score.
4. **A pattern guess**: if step 2 found other personal addresses on the site (generic inboxes like contact@ or info@ are ignored), Pluton builds one for this person with the most common pattern (first.last, f.last, first-last or first_last). Source "Guessed from the site's address pattern, unverified", confidence 25% (35% when several addresses follow the pattern). Shown in yellow/orange everywhere.

Results: the address appears in the drawer and the Email column; the timeline adds "Email found: {email} ({source})". If nothing is found: "No email found for {name}", the timeline adds "Looked for an email, none found", the drawer shows "No email found on {date}" and the Email column says "None found". A later miss never erases an address found earlier.

## Email costs, Hunter and confidence

**Free sources** (steps 1, 2 and 4 of the lookup) cost nothing and need no key.

**Hunter**:
- Add a Hunter API key in Settings → API keys. Hunter's free plan includes 50 searches a month.
- Pluton only calls Hunter when the free sources found the person's own address nowhere, and only once per lead lookup.
- Hunter counts a search only when it returns an email. Pluton records what a credit costs on your Hunter plan (about **$0.027** per email found on Starter, less on larger plans) and $0 on the free plan (logged under "Email finding" on Usage); a search that finds nothing costs nothing.
- The remaining searches for the month are shown in the drawer and in the bulk Find emails hint.
- Hunter answers are cached 30 days, so searching again for the same person within a month doesn't spend a search.

**If Hunter fails**: when the key is rejected and the free sources found nothing at all, the lookup stops with "Hunter rejected the API key; fix it in Settings → API keys". If the free sources found a guess, you get the guess instead and no error.

**Reading confidence**:
- 80–85%, "Found on a public page": the address was written publicly next to the person's name.
- Hunter's score, "Hunter, verified": Hunter's own deliverability confidence.
- 25–35%, "Guessed…, unverified": built from the company's pattern, never verified. Check it before sending anything.

The CSV export includes the email, its confidence and its source.

## Finding emails in bulk

Select leads (up to 200), then press **Find emails** in the selection bar. Hover it to see the plan: "Free sources first, then up to {count} Hunter searches ({left} left this month)" or "Free sources only (no Hunter key)".

A confirmation asks "Find emails for {count} leads?" with that same line. Press OK to start.

What happens:

- The lookup runs in the background, one lead at a time, exactly as for a single lead (free sources first, then Hunter, then a guess).
- The selection bar shows "Finding emails {done}/{total}", and the table refreshes as addresses come in. You can keep working, close the drawer, or even reload: the progress picks up again.
- One bulk lookup at a time per workspace. Starting another shows "Already finding emails; wait for it to finish".
- An error on one lead (for example a rejected Hunter key) doesn't stop the others.
- When done, a message says "Found {count} emails for {checked} leads", followed by the first error if any. Activity records "Pluton found {count} work emails for {checked} leads".

With more than 200 selected, the button is disabled; narrow the selection (for example the Approved tab with a Signal filter) and run it in parts.

The Agent and AI clients can also look up emails (up to 50 leads per request), with your approval.

## Exporting leads to CSV

Two ways to export:

- **Export** in the toolbar ("Leads in this tab and filter, as CSV"): every lead matching the current tab, search and Signal filter, not just the 50 shown. Disabled when nothing matches.
- **Export {count}** in the selection bar: only the selected leads (up to 5,000).

The file downloads as **pluton-leads-YYYY-MM-DD.csv**, and a message says "Exported {count} leads". It opens cleanly in Excel, Numbers and Google Sheets (accents included). Rows are sorted by Play name, then best fit. Cells starting with =, +, - or @ are prefixed with an apostrophe so spreadsheets don't run them as formulas.

Columns, in order (headers in your app language):

Name · Title · Seniority (from title) · Company · Company website · Location · LinkedIn · Email · Email confidence · Email source · Play · Status · Judge verdict · Fit · Warmness · Signal · Why they fit · Evidence · Found at

Notes on values:
- **Status**: to_review, approved, in_campaign, contacted or rejected.
- **Judge verdict**: qualified (Strong match) or needs_review (Worth a look).
- **Email source**: hunter, public_text or pattern (pattern = unverified guess).
- **Signal**: the signal label; **Why they fit**: the judge's reason followed by the raw signal.
- **Evidence**: the links (or labels when there is no link), separated by " | ".
- **Found at**: date and time in UTC.

Each exported lead gets "Exported to CSV" in its timeline. Exporting doesn't change any status.

For HubSpot, Attio or Pipedrive, use the CRM export instead (see integrations).

## Deleting leads

Delete is for mistakes and clutter. Ways to delete:

- **Delete…** in the lead's right-click menu or the drawer's More actions menu.
- **Delete** in the selection bar for several leads.

A confirmation asks **Delete {name}?** (or "Delete {count} leads?") with: "Notes, reviews and sequence steps go too. To keep someone out of future searches, mark them Not a fit instead." Press **Delete** to confirm. A message confirms "Deleted {count} leads".

What is removed, for good: the lead, its notes and timeline, your verdict on it, and its enrollment in the Play's sequence.

What stays: the person record (their email and LinkedIn, and their leads in other Plays), Activity entries, and spend already recorded.

**Deleting is not rejecting.** A deleted lead teaches the searches nothing, and the person can be found again by a later search, even in the same Play. To keep someone out for good, reject them. Deleting a whole Play deletes all its leads (see the Plays documentation).

## The lead menu (right-click)

Right-click a lead row to open its menu. The drawer's **More actions** (three dots) opens the same menu without "Open", "Add to campaign…" and "Add a note".

Items, in order:

- **Open**: opens the lead drawer.
- **Good lead** (A): approves. Greyed out when already approved.
- **Not a fit…** (R): opens the reject popover. Greyed out when already rejected.
- **Add to campaign…**: opens the "add to your campaign" window. Only for leads that are not rejected and not already in a sequence.
- **Add a note**: opens the drawer with the note field focused.
- **Copy name**: copies the name ("Name copied").
- **Copy email**: copies the email ("Email copied"). Greyed out without an email.
- **Open LinkedIn profile**: opens it in a new tab. Greyed out without a LinkedIn URL.
- **Delete…**: deletes after confirmation (see "Deleting leads").

## Errors and messages about leads

- **"Lead not found"**: the lead was deleted (or its Play was). Close the drawer.
- **"Already finding emails; wait for it to finish"**: a bulk email lookup is already running; wait for its result.
- **"Hunter rejected the API key; fix it in Settings → API keys"**: the Hunter key is wrong or revoked and no free source found anything. Fix or remove the key.
- **"Free sources first, then Hunter (unavailable: key rejected, fix it in Settings → API keys)"**: shown in the drawer when Pluton can't read your Hunter quota; same fix.
- **"No email found for {name}"** / **"No LinkedIn profile found for {name}"**: nothing reliable was found. For emails, add the company website if missing (it comes from the research), or add a Hunter key. For LinkedIn, a miss is remembered for 3 days.
- **"No lead matches these filters."**: clear the search box or set Signal back to "Every signal".
- **"No leads yet. Run a search from a Play."**: no Play has found anyone yet.
- **Find emails disabled**: more than 200 leads selected. **Add to campaign disabled**: more than 500.
- **"Approved {name}" / "Rejected {name}" with Undo**: confirmations; Undo reverts.
- **"Exported {count} leads"**, **"Deleted {count} leads"**, **"Name copied"**, **"Email copied"**: confirmations.

## FAQ

**What's the difference between "Strong match" and "Worth a look"?**
The judge's confidence. Strong match: fit 70+ with both organization and role matching. Worth a look: fit 45–69 or one side uncertain. Both land in To review; you decide.

**Why don't I see the people the search set aside?**
People the judge scored below 45 are not leads. You can see how many and examples on the Play's Sourcing tab under "Set aside in the latest completed run".

**What's the difference between the New and To review tabs?**
To review is every lead without your verdict. New is the subset you haven't opened yet. Opening a lead removes it from New but keeps it in To review.

**If I reject someone, can another Play still find them?**
No. A rejected person is kept out of every future search of every Play, unless you undo the rejection or delete the lead.

**Should I delete or reject bad leads?**
Reject. Rejecting teaches the judge and keeps the person out for good. Deleting forgets everything, and the person can come back.

**Do I have to pick a reason when rejecting?**
No, reasons and the comment are optional. But they are what the judge and the Brain review learn from, so a reason makes the next search better.

**What happens after I reject five leads?**
Pluton queues a Brain review focused on your rejections. Its suggestions appear on the Brain page for you to accept or reject; nothing changes on its own.

**Does approving a lead contact them?**
No. Approving only records your verdict. Outreach starts when you add the lead to the Play's sequence and its messages are reviewed.

**Why is an email shown in yellow?**
It is a guess built from the company's address pattern, never verified (25–35% confidence). Check it before using it.

**How much does finding an email cost?**
The free sources cost nothing. With a Hunter key, Hunter is used only when the free sources didn't find the person's own address; Hunter's free plan includes 50 searches a month, and Pluton logs about $0.027 per email Hunter finds on its Starter plan, less on larger ones.

**Why does "Find LinkedIn" keep saying none found?**
A miss is remembered for 3 days per person, so retrying within 3 days gives the same answer. The lookup only accepts a profile whose address contains part of the person's name.

**Can I export only approved leads?**
Yes: open the Approved tab and press Export in the toolbar. Search and the Signal filter apply too.

**Why does the same person appear twice in my Leads page?**
They were found by two Plays: each Play has its own lead. The drawer lists the other under "Also found by". Rarely, the same person is stored twice when one search only knew their name and company and another their LinkedIn profile.

**Can I undo a bulk approval?**
Yes, with Undo in the message that appears right after. Later, undo lead by lead from each drawer.

**Can I edit a lead's title, company or email by hand?**
No. Lead details come from the research and lookups. Add a note in the timeline if you need to record a correction.
