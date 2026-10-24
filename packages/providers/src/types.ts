/** Normalized records every provider maps into, so pipelines never see vendor shapes. */

export type CompanyRecord = {
  name: string;
  domain?: string;
  /** French SIREN when the company comes from the registry. */
  siren?: string;
  industry?: string;
  industryCode?: string;
  sizeBand?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  createdOn?: string;
  linkedinUrl?: string;
  executives?: Array<{ name: string; role?: string }>;
  source: string;
};

export type JobRecord = {
  title: string;
  url: string;
  company: string;
  companyDomain?: string;
  location?: string;
  department?: string;
  postedAt?: string;
  technologies?: string[];
  source: string;
};

export type PersonRecord = {
  name: string;
  headline?: string;
  linkedinUrl?: string;
  /** What surfaced this person, e.g. "Reacted (LIKE) to a post by X". */
  signal?: string;
  source: string;
};

export type PostRecord = {
  url: string;
  text: string;
  postedAt?: string;
  author: { name: string; linkedinUrl?: string };
  likes?: number;
  comments?: number;
  source: string;
};

export type TechnologyRecord = { name: string; category: string; evidence: string };
