import credits from "../assets/credits.json";

/** The pictures the page shows, with the credit each licence asks for. */
export const PICTURE_CREDITS = (
  credits as { file: string; title: string; creator: string; license: string; licenseUrl: string; page: string }[]
).map(({ title, creator, license, licenseUrl, page }) => ({ title, creator, license, licenseUrl, page }));
