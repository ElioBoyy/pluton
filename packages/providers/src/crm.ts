import { getSetting, type CrmProvider } from "@pluton/db";
import { httpJson, ProviderError } from "./runtime.ts";

/**
 * Create-only CRM adapters. Pluton never updates or deletes CRM records: it looks the person up by
 * email, and only creates them (and their company) when they aren't there yet.
 */
export type CrmFieldInfo = { key: string; label: string; type?: string };
export type CrmPerson = {
  /** Mapped CRM properties, already keyed by the CRM's own names. */
  props: Record<string, string>;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
};
export type CrmCompany = { name: string; domain?: string };

export interface CrmAdapter {
  /** Account name the token belongs to; throws when the token doesn't work. */
  check(): Promise<string>;
  /** Writable person properties, for the mapping. */
  personFields(): Promise<CrmFieldInfo[]>;
  findPersonByEmail(email: string): Promise<{ id: string; url?: string } | null>;
  /** Finds the company by domain (or name), else creates it. */
  ensureCompany(company: CrmCompany): Promise<string | null>;
  createPerson(person: CrmPerson, companyId: string | null): Promise<{ id: string; url?: string }>;
}

const key = (setting: string, name: string) => {
  const v = getSetting(setting)?.trim();
  if (!v) throw new ProviderError(name, "not configured: add its token in Settings → Integrations");
  return v;
};

// ── HubSpot ──────────────────────────────────────────────────────────────────

const HS = "https://api.hubapi.com";
let hubspotPortal: { token: string; id: number } | undefined;

function hubspot(): CrmAdapter {
  const token = key("hubspot_token", "hubspot");
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const get = <T>(path: string) => httpJson<T>("hubspot", `${HS}${path}`, { headers });
  const post = <T>(path: string, body: unknown) => httpJson<T>("hubspot", `${HS}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const portal = async () => {
    if (hubspotPortal?.token !== token) {
      const info = await get<{ portalId: number }>("/account-info/v3/details");
      hubspotPortal = { token, id: info.portalId };
    }
    return hubspotPortal.id;
  };
  const url = async (id: string) => `https://app.hubspot.com/contacts/${await portal()}/record/0-1/${id}`;
  const search = (object: string, property: string, value: string) =>
    post<{ results: Array<{ id: string }> }>(`/crm/v3/objects/${object}/search`, {
      filterGroups: [{ filters: [{ propertyName: property, operator: "EQ", value }] }],
      limit: 1,
    });
  return {
    async check() {
      const info = await get<{ portalId: number; uiDomain?: string }>("/account-info/v3/details");
      return `HubSpot portal ${info.portalId}`;
    },
    async personFields() {
      const r = await get<{ results: Array<{ name: string; label: string; type: string; hidden?: boolean; modificationMetadata?: { readOnlyValue?: boolean } }> }>(
        "/crm/v3/properties/contacts",
      );
      return r.results
        .filter((p) => !p.hidden && !p.modificationMetadata?.readOnlyValue)
        .map((p) => ({ key: p.name, label: p.label, type: p.type }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    async findPersonByEmail(email) {
      const hit = (await search("contacts", "email", email)).results[0];
      return hit ? { id: hit.id, url: await url(hit.id) } : null;
    },
    async ensureCompany({ name, domain }) {
      const hit = (await search("companies", domain ? "domain" : "name", domain ?? name)).results[0];
      if (hit) return hit.id;
      const created = await post<{ id: string }>("/crm/v3/objects/companies", { properties: { name, ...(domain ? { domain } : {}) } });
      return created.id;
    },
    async createPerson(person, companyId) {
      const created = await post<{ id: string }>("/crm/v3/objects/contacts", {
        properties: person.props,
        // 279: HubSpot's default contact → company association.
        associations: companyId ? [{ to: { id: companyId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 }] }] : [],
      });
      return { id: created.id, url: await url(created.id) };
    },
  };
}

// ── Attio ────────────────────────────────────────────────────────────────────

const AT = "https://api.attio.com/v2";

function attio(): CrmAdapter {
  const token = key("attio_api_key", "attio");
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const get = <T>(path: string) => httpJson<T>("attio", `${AT}${path}`, { headers });
  const post = <T>(path: string, body: unknown) => httpJson<T>("attio", `${AT}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  type Rec = { id: { record_id: string }; web_url?: string };
  return {
    async check() {
      const me = await get<{ active: boolean; workspace_name?: string }>("/self");
      if (!me.active) throw new ProviderError("attio", "this key is no longer active");
      return me.workspace_name ? `Attio workspace ${me.workspace_name}` : "Attio";
    },
    async personFields() {
      const r = await get<{ data: Array<{ api_slug: string; title: string; type: string; is_writable: boolean; is_archived?: boolean }> }>("/objects/people/attributes");
      return r.data
        .filter((a) => a.is_writable && !a.is_archived)
        .map((a) => ({ key: a.api_slug, label: a.title, type: a.type }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    async findPersonByEmail(email) {
      const r = await post<{ data: Rec[] }>("/objects/people/records/query", { filter: { email_addresses: email }, limit: 1 });
      const hit = r.data[0];
      return hit ? { id: hit.id.record_id, url: hit.web_url } : null;
    },
    async ensureCompany({ name, domain }) {
      const r = await post<{ data: Rec[] }>("/objects/companies/records/query", { filter: domain ? { domains: domain } : { name }, limit: 1 });
      if (r.data[0]) return r.data[0].id.record_id;
      const created = await post<{ data: Rec }>("/objects/companies/records", { data: { values: { name, ...(domain ? { domains: [domain] } : {}) } } });
      return created.data.id.record_id;
    },
    async createPerson(person, companyId) {
      const values: Record<string, unknown> = {};
      for (const [slug, value] of Object.entries(person.props)) {
        // Attio's typed attributes: a personal name and a list of emails.
        if (slug === "name") values.name = [{ first_name: person.firstName ?? "", last_name: person.lastName ?? "", full_name: person.fullName }];
        else if (slug === "email_addresses") values.email_addresses = [value];
        else values[slug] = value;
      }
      if (companyId) values.company = [{ target_object: "companies", target_record_id: companyId }];
      const created = await post<{ data: Rec }>("/objects/people/records", { data: { values } });
      return { id: created.data.id.record_id, url: created.data.web_url };
    },
  };
}

// ── Pipedrive ────────────────────────────────────────────────────────────────

const PD = "https://api.pipedrive.com/v1";
let pipedriveDomain: { token: string; domain: string } | undefined;

function pipedrive(): CrmAdapter {
  const token = key("pipedrive_api_token", "pipedrive");
  const q = (path: string) => `${PD}${path}${path.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(token)}`;
  const get = <T>(path: string) => httpJson<{ success: boolean; data: T }>("pipedrive", q(path)).then((r) => r.data);
  const post = <T>(path: string, body: unknown) =>
    httpJson<{ success: boolean; data: T }>("pipedrive", q(path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.data);
  const domain = async () => {
    if (pipedriveDomain?.token !== token) {
      const me = await get<{ company_domain: string }>("/users/me");
      pipedriveDomain = { token, domain: me.company_domain };
    }
    return pipedriveDomain.domain;
  };
  const url = async (id: string) => `https://${await domain()}.pipedrive.com/person/${id}`;
  return {
    async check() {
      const me = await get<{ name: string; company_name: string }>("/users/me");
      return `Pipedrive ${me.company_name} (${me.name})`;
    },
    async personFields() {
      const fields = await get<Array<{ key: string; name: string; field_type: string; edit_flag?: boolean; bulk_edit_allowed?: boolean }>>("/personFields");
      // org_id and owner are set by Pluton itself, not through the mapping.
      return fields
        .filter((f) => (f.edit_flag || f.bulk_edit_allowed) && !["org_id", "owner_id", "label"].includes(f.key))
        .map((f) => ({ key: f.key, label: f.name, type: f.field_type }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    async findPersonByEmail(email) {
      const r = await get<{ items: Array<{ item: { id: number } }> }>(`/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&limit=1`);
      const hit = r.items[0];
      return hit ? { id: String(hit.item.id), url: await url(String(hit.item.id)) } : null;
    },
    async ensureCompany({ name }) {
      const r = await get<{ items: Array<{ item: { id: number } }> }>(`/organizations/search?term=${encodeURIComponent(name)}&fields=name&exact_match=true&limit=1`);
      if (r.items[0]) return String(r.items[0].item.id);
      const created = await post<{ id: number }>("/organizations", { name });
      return String(created.id);
    },
    async createPerson(person, companyId) {
      const body: Record<string, unknown> = { name: person.fullName };
      for (const [k, v] of Object.entries(person.props)) {
        if (k === "email") body.email = [{ value: v, primary: true, label: "work" }];
        else body[k] = v;
      }
      if (companyId) body.org_id = Number(companyId);
      const created = await post<{ id: number }>("/persons", body);
      return { id: String(created.id), url: await url(String(created.id)) };
    },
  };
}

export function crmAdapter(provider: CrmProvider): CrmAdapter {
  return provider === "hubspot" ? hubspot() : provider === "attio" ? attio() : pipedrive();
}
