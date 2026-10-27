// Generated from schema.ts by scripts/pg_schema.py: edit schema.ts, not this file.
import { HOSTED } from "./paths.ts";
import * as pg from "./schema.pg.ts";
import * as sqlite from "./schema.ts";

/**
 * The tables the app queries: Postgres's when hosted, SQLite's otherwise. Both have the same names,
 * columns and shapes, so the app is written once, against the SQLite types.
 */
const active = (HOSTED ? pg : sqlite) as unknown as typeof sqlite;

// schema.ts's types and constants, with the tables below in place of its own.
export * from "./schema.ts";

export const workspaces = active.workspaces;
export const jobs = active.jobs;
export const streamEvents = active.streamEvents;
export const activityEvents = active.activityEvents;
export const brainItems = active.brainItems;
export const onboardingSessions = active.onboardingSessions;
export const onboardingStages = active.onboardingStages;
export const onboardingCards = active.onboardingCards;
export const brainProposals = active.brainProposals;
export const providerCache = active.providerCache;
export const providerCalls = active.providerCalls;
export const plays = active.plays;
export const leadFindingRuns = active.leadFindingRuns;
export const people = active.people;
export const leads = active.leads;
export const leadFeedback = active.leadFeedback;
export const leadEvents = active.leadEvents;
export const senders = active.senders;
export const campaigns = active.campaigns;
export const enrollments = active.enrollments;
export const messageDrafts = active.messageDrafts;
export const outreachActions = active.outreachActions;
export const replies = active.replies;
export const creditEntries = active.creditEntries;
export const creditHolds = active.creditHolds;
export const notifications = active.notifications;
export const integrations = active.integrations;
export const crmExports = active.crmExports;
export const slackPosts = active.slackPosts;
export const mcpClients = active.mcpClients;
export const apiKeys = active.apiKeys;
export const copilotConversations = active.copilotConversations;
export const copilotMessages = active.copilotMessages;
export const copilotActions = active.copilotActions;
export const searchDocuments = active.searchDocuments;
export const workspaceSettings = active.workspaceSettings;
export const users = active.users;
export const creditPacks = active.creditPacks;
export const authSessions = active.authSessions;
export const authTokens = active.authTokens;
