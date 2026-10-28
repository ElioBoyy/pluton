import access from "./access.ts";
import account from "./account.ts";
import activity from "./activity.ts";
import agent from "./agent.ts";
import brain from "./brain.ts";
import common from "./common.ts";
import docs from "./docs.ts";
import home from "./home.ts";
import integrations from "./integrations.ts";
import leads from "./leads.ts";
import onboarding from "./onboarding.ts";
import plays from "./plays.ts";
import sequence from "./sequence.ts";
import settings from "./settings.ts";
import shell from "./shell.ts";
import tour from "./tour.ts";
import usage from "./usage.ts";
import workspaces from "./workspaces.ts";

/** One namespace per area of the app; a component asks for its own with useT("leads"). */
export const catalogs = { access, account, activity, agent, brain, common, docs, home, integrations, leads, onboarding, plays, sequence, settings, shell, tour, usage, workspaces };
