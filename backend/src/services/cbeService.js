/**
 * cbeService.js
 * Wraps the Crossroads Bank for Enterprises (CBE/KBO) REST API.
 *
 * Docs: https://crossroadsbankenterprises.com/documentation/v2
 * Base: https://api.kbodata.app/v2
 *
 * Key endpoints used:
 *   GET /denominations?name=...          → search companies/persons by name
 *   GET /enterprise/{cbe}/roles          → all mandates at a company
 *   GET /enterprise/{cbe}                → company details
 *   GET /roles?personName=...            → all mandates held by a natural person
 */

const fetch = require("node-fetch");

const BASE = process.env.CBE_API_BASE || "https://api.kbodata.app/v2";
const API_KEY = process.env.CBE_API_KEY;

// ── Shared fetch helper ───────────────────────────────────────────────────────
async function cbeGet(path, params = {}) {
  if (!API_KEY) throw new Error("CBE_API_KEY is not configured");

  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CBE API error ${res.status}: ${body}`);
  }

  return res.json();
}

// ── 1. Search persons by name ─────────────────────────────────────────────────
/**
 * Returns a list of natural persons matching the given name.
 * The CBE /denominations endpoint searches both company names and person names.
 * We filter to type "natural_person" entries only.
 *
 * Response shape per person:
 * {
 *   enterpriseNumber: "0417.123.456",  ← this is the person's CBE id
 *   name: "De Smedt Jan",
 *   type: "natural_person" | "legal_entity",
 *   active: true,
 *   ...
 * }
 */
async function searchPersonsByName(name, limit = 20) {
  const data = await cbeGet("/denominations", { name, limit });

  const items = data?.Denominations ?? data?.results ?? [];

  // Filter to natural persons only, map to clean shape
  return items
    .filter((d) => {
      const type = d?.Enterprise?.type ?? d?.type ?? "";
      return type === "natural_person" || type === "NaturalPerson";
    })
    .map(normalizePersonFromDenomination);
}

function normalizePersonFromDenomination(d) {
  const ent = d?.Enterprise ?? d;
  return {
    enterpriseNumber: ent?.enterpriseNumber ?? d?.enterpriseNumber,
    name: d?.denomination ?? d?.name ?? ent?.name ?? "",
    type: "natural_person",
    active: ent?.active ?? true,
    juridicalForm: ent?.JuridicalForm?.description?.en ?? null,
    city: ent?.Address?.city ?? null,
    startDate: ent?.dateStart ?? null,
  };
}

// ── 2. Get all mandates (roles) held by a natural person ──────────────────────
/**
 * Fetches all companies where a natural person holds a mandate.
 * Uses the /roles endpoint with pagination.
 *
 * Returns array of:
 * {
 *   cbeNumber: "0650.234.567",
 *   companyName: "JDS Consulting BV",
 *   role: "Administrator",
 *   startDate: "2018-01-15",
 *   endDate: null,       ← null = still active
 *   active: true,
 * }
 */
async function getMandatesForPerson(personEnterpriseNumber, includeInactive = true) {
  // The CBE API uses the person's enterprise number to query their roles
  const data = await cbeGet(`/enterprise/${personEnterpriseNumber}/roles`);

  const roles = data?.Roles ?? data?.roles ?? [];

  return roles
    .filter((r) => includeInactive || !r.dateEnd)
    .map((r) => ({
      cbeNumber: r?.EnterpriseNumber ?? r?.enterpriseNumber ?? r?.enterprise?.enterpriseNumber,
      companyName: r?.Denomination ?? r?.denomination ?? r?.enterprise?.name ?? "",
      roleCode: r?.RoleCode ?? r?.roleCode,
      role: r?.Function?.description?.en ?? r?.role ?? r?.function ?? "Administrator",
      startDate: r?.dateStart ?? null,
      endDate: r?.dateEnd ?? null,
      active: !r?.dateEnd,
    }))
    .filter((r) => r.cbeNumber); // drop entries without a company number
}

// ── 3. Get company details ────────────────────────────────────────────────────
/**
 * Returns basic company info for a CBE number.
 */
async function getCompanyDetails(cbeNumber) {
  const clean = cbeNumber.replace(/\./g, "").replace(/^0*/, "0"); // normalise
  const data = await cbeGet(`/enterprise/${clean}`);

  const ent = data?.Enterprise ?? data;
  return {
    cbeNumber: ent?.enterpriseNumber ?? cbeNumber,
    name: ent?.Denominations?.[0]?.denomination ?? ent?.name ?? "",
    active: ent?.active ?? true,
    legalForm: ent?.JuridicalForm?.description?.en ?? null,
    startDate: ent?.dateStart ?? null,
    endDate: ent?.dateEnd ?? null,
    vatNumber: ent?.vatNumber ?? null,
    address: ent?.Address
      ? {
          street: ent.Address.street,
          number: ent.Address.number,
          zip: ent.Address.zipCode,
          city: ent.Address.city,
          country: ent.Address.countryCode ?? "BE",
        }
      : null,
  };
}

module.exports = {
  searchPersonsByName,
  getMandatesForPerson,
  getCompanyDetails,
};
