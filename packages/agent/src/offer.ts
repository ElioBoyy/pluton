/**
 * What changes when the company sells missions (a freelancer, consultant, studio or agency) rather
 * than a product: the "buyer" is whoever would hire them, and the signals are needs for their skills.
 */
export const SERVICES_CONTEXT = `This company sells services: its own time and expertise, as freelance missions or projects. Its "customers" are clients who would hire it for a mission, and its "buyers" are the people who bring in a freelancer or an agency and brief them (often the manager of the team that needs the skill, or the founder in small companies). Read every instruction about buyers, products and fit in that light.`;

export const SERVICES_AUDIENCE = `Define who hires this freelancer or agency: the ideal client profile (the kinds of organizations that bring in outside help for these services, their sizes and geographies: often startups and SMBs without that skill in-house, agencies that subcontract, or larger teams short on capacity) and 3 to 6 personas: the people who decide to hire a freelancer for this kind of mission, with the exact job titles they use on LinkedIn. whyTheyBuy is why they would hire this person rather than recruit or do it themselves (capacity, a specific expertise, speed, a one-off project). Look at the client logos, past missions, case studies and testimonials on the site. Then call save_audience.`;

export const SERVICES_MARKET = `This company sells freelance services, so:
- competitors are the alternatives a client weighs: other freelancers and agencies offering the same services, and the marketplaces clients use to find them (e.g. Malt, Upwork, Comet, Crème de la Crème);
- keywords are what clients post when they look for this help ("recherche freelance <skill>", "mission <skill>", "besoin d'un <role>"), not what the freelancer posts about;
- hiring signals are the job titles matching the services offered: a company recruiting for that role needs the skill now, and a freelancer can fill the gap faster than a hire;
- stack signals are the tools and technologies the freelancer works with (relation "uses"): a company running them needs that expertise.`;

export const SERVICES_LEADS = `This company sells freelance services: find organizations that could hire it for a mission, and the person there who would bring in a freelancer for it.`;

export const SERVICES_JUDGE = `This company sells freelance services. Fit means: would this person plausibly hire it for a mission? Their organization needs these services and doesn't obviously do them in-house at scale, and their role decides or briefs outside help for this kind of work. Other freelancers, agencies or marketplaces offering the same services are competitors, not clients: disqualify them as wrong_company.`;

export const SERVICES_OUTREACH = `This company sells freelance services. Write as the freelancer (or studio) offering help on a concrete mission, peer to peer, never as a vendor demoing a product: name the need you noticed and the help you could bring, and ask whether it is worth a short call or a look at past work.`;

/** A local_business Play: small businesses near the founder whose online presence has a gap they fix. */
export const LOCAL_JUDGE = `This Play looks for small local businesses and independents (sole traders, trades, shops, restaurants, practices) whose online presence has a gap the company's services fill; it overrides the ICP's company sizes and personas. Fit means: the business matches the trades and places asked for, it is small and independent, and its gap (in the signal) is one the company fixes. The person is the owner or the business itself: their title is never a reason to mark them down, and a business name in place of a person's is expected. Chains, franchises, large companies and public bodies are wrong_company; a business outside the places asked for is wrong_geography.`;

export const LOCAL_OUTREACH = `This lead is a small local business owner, found through a gap in its online presence (the signal). Write to them as a local professional, plainly and briefly: no jargon, no agency talk, no marketing terms. Name the gap you noticed concretely (no website, not on Google Maps, few reviews, few photos) and what it costs them (customers searching for their trade nearby don't find them), offer one specific thing you could do, and ask whether it's worth a short call. Never shame them for it.`;
