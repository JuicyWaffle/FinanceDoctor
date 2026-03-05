/**
 * nbbService.js
 * Wraps the NBB Central Balance Sheet Office (CBSO) REST API.
 *
 * Docs / test portal: https://developer.uat2.cbso.nbb.be
 * Tech guide: https://www.nbb.be/doc/ba/cbso2022/cbso_webservices_technical guide_0.94.pdf
 *
 * Flow for a single company:
 *   1. GET /authentic/legalEntity/{cbe}/references  → list of annual filings
 *   2. GET /authentic/deposit/{ref}/accountingData  → JSON financial data
 *      (Accept: application/json  → structured JSON with item codes)
 *
 * Authentication:
 *   Header  NBB-CBSO-Subscription-Key: <your key>
 *   Header  X-Request-Id: <uuid per request>
 *
 * Balance sheet item codes (Belgian standard accounts):
 *   Assets:
 *     20/28  Fixed assets total
 *       21   Intangible fixed assets
 *       22/27 Tangible fixed assets
 *       28   Financial fixed assets
 *     29/58  Current assets total
 *       3    Inventories
 *       40/41 Trade & other receivables
 *       54/58 Cash & equivalents
 *   20/58  TOTAL ASSETS
 *
 *   Liabilities:
 *     10/15  Equity total
 *     17     Long-term financial debt
 *     42/48  Short-term financial debt
 *     17/49  TOTAL DEBT (all liabilities excl. equity)
 */

const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

const BASE = process.env.NBB_API_BASE || "https://ws.uat2.cbso.nbb.be";
const API_KEY = process.env.NBB_API_KEY;

// ── Shared fetch helper ───────────────────────────────────────────────────────
async function nbbGet(path, accept = "application/json") {
  if (!API_KEY) throw new Error("NBB_API_KEY is not configured");

  const url = `${BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      Accept: accept,
      "NBB-CBSO-Subscription-Key": API_KEY,
      "X-Request-Id": uuidv4(), // must be unique per request
    },
  });

  if (res.status === 404) return null; // company has no filings
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NBB API error ${res.status} on ${path}: ${body}`);
  }

  if (accept === "application/json") return res.json();
  return res.buffer(); // for PDF / XBRL
}

// ── 1. Get all filing references for a company ────────────────────────────────
/**
 * Returns list of annual account filings for a given CBE number.
 * Sorted by fiscal year descending (most recent first).
 *
 * Each reference:
 * {
 *   ReferenceNumber: "2023-00012345",
 *   DepositDate: "2024-01-15",
 *   ExerciseDates: { startDate: "2023-01-01", endDate: "2023-12-31" },
 *   ModelType: "m02-f",   // full model
 *   EnterpriseName: "...",
 *   AccountingDataURL: "https://...",
 *   DataVersion: "Authentic",
 * }
 */
async function getFilingReferences(cbeNumber) {
  const clean = normalizeCbe(cbeNumber);
  const data = await nbbGet(`/authentic/legalEntity/${clean}/references`);
  if (!data) return [];

  const refs = Array.isArray(data) ? data : [data];
  return refs
    .sort((a, b) => {
      const ya = a.ExerciseDates?.endDate ?? a.DepositDate ?? "";
      const yb = b.ExerciseDates?.endDate ?? b.DepositDate ?? "";
      return yb.localeCompare(ya); // newest first
    });
}

// ── 2. Get accounting data (JSON) for a specific filing reference ─────────────
/**
 * Returns structured JSON with all accounting items.
 * The data is an array of { RubriekCode, Value, ... } objects.
 * We pick out the specific item codes we care about.
 */
async function getAccountingData(referenceNumber) {
  const data = await nbbGet(
    `/authentic/deposit/${referenceNumber}/accountingData`,
    "application/json"
  );
  return data;
}

// ── 3. Extract key figures from raw accounting JSON ───────────────────────────
/**
 * Parses the raw NBB JSON response and returns clean financial KPIs.
 *
 * The response contains an array of accounting items, each with:
 *   { RubriekCode: "20/58", Waarde: 1234567, ... }
 * or (newer format):
 *   { itemCode: "20/58", value: 1234567 }
 *
 * We look for the summary codes first, then fall back to computing
 * from sub-items if the summary isn't present (some models omit them).
 */
function extractFinancials(rawData) {
  if (!rawData) return null;

  // Normalise items array — the API returns different shapes depending on
  // whether the filing is XBRL-based (JSON) or PDF_ENCODED
  const items = extractItemsArray(rawData);
  if (!items || items.length === 0) return null;

  // Build a lookup map: itemCode → numeric value
  const byCode = {};
  items.forEach((item) => {
    const code = item.RubriekCode ?? item.itemCode ?? item.code ?? "";
    const raw = item.Waarde ?? item.value ?? item.bedrag ?? null;
    const num = raw !== null && raw !== "" ? parseFloat(raw) : null;
    if (code && num !== null && !isNaN(num)) {
      byCode[code] = num;
    }
  });

  // Helper: first matching code in priority order
  const pick = (...codes) => {
    for (const c of codes) {
      if (byCode[c] !== undefined) return byCode[c];
    }
    return null;
  };

  // ── Assets ────────────────────────────────────────────────────────────────
  const fixedAssets      = pick("20/28", "20_28");
  const intangibleAssets = pick("21");
  const tangibleAssets   = pick("22/27", "22_27");
  const financialAssets  = pick("28");
  const currentAssets    = pick("29/58", "29_58");
  const inventories      = pick("3", "30/36", "30_36");
  const receivables      = pick("40/41", "40_41");
  const cash             = pick("54/58", "54_58", "50/58", "50_58");

  // Total assets — code 20/58 on full model, computed as fallback
  let totalAssets = pick("20/58", "20_58", "ACTIVA");
  if (totalAssets === null && fixedAssets !== null && currentAssets !== null) {
    totalAssets = fixedAssets + currentAssets;
  }

  // ── Liabilities & equity ──────────────────────────────────────────────────
  const equity         = pick("10/15", "10_15");
  const ltDebt         = pick("17");        // long-term financial debt
  const stDebt         = pick("42/48", "42_48", "43");  // short-term financial debt
  const provisions     = pick("16");        // provisions & deferred taxes

  // Total debt — code 17/49 covers all non-equity liabilities
  let totalDebt = pick("17/49", "17_49", "PASSIVA_VREEMD");
  if (totalDebt === null) {
    // Compute: total assets minus equity (balance sheet identity)
    if (totalAssets !== null && equity !== null) {
      totalDebt = totalAssets - equity;
    } else if (ltDebt !== null || stDebt !== null) {
      totalDebt = (ltDebt ?? 0) + (stDebt ?? 0) + (provisions ?? 0);
    }
  }

  return {
    // Summaries
    totalAssets,
    totalDebt,
    equity,
    net: totalAssets !== null && totalDebt !== null ? totalAssets - totalDebt : null,

    // Asset breakdown
    fixedAssets,
    intangibleAssets,
    tangibleAssets,
    financialAssets,
    currentAssets,
    inventories,
    receivables,
    cash,

    // Debt breakdown
    ltDebt,
    stDebt,
    provisions,
  };
}

// ── 4. Get financials for a company across multiple years ─────────────────────
/**
 * Main function: fetches all filings for a company, extracts financials per year.
 * Returns a map keyed by fiscal year (YYYY):
 * {
 *   "2023": { totalAssets: 1200000, totalDebt: 700000, ... },
 *   "2022": { ... },
 *   ...
 * }
 *
 * @param {string} cbeNumber  - the company's CBE enterprise number
 * @param {number[]} years    - array of years to fetch (e.g. [2015..2024])
 * @param {boolean} preferImproved - try improved/corrected data first (requires paid subscription)
 */
async function getCompanyFinancialsByYear(cbeNumber, years, preferImproved = false) {
  const result = {};

  // Get all available filing references
  let refs;
  try {
    refs = await getFilingReferences(cbeNumber);
  } catch (err) {
    console.warn(`[NBB] Could not fetch references for ${cbeNumber}: ${err.message}`);
    return result;
  }

  if (!refs || refs.length === 0) return result;

  // Build a map: fiscal year → reference
  // A company may have multiple filings per year (amended, consolidated, etc.)
  // We prefer DataVersion "Authentic" and the most recent DepositDate
  const refByYear = {};
  for (const ref of refs) {
    const endDate = ref.ExerciseDates?.endDate;
    if (!endDate) continue;

    const year = parseInt(endDate.substring(0, 4));
    if (!years.includes(year)) continue;

    // Keep: prefer Authentic, break ties by deposit date (newest)
    if (!refByYear[year]) {
      refByYear[year] = ref;
    } else {
      const existing = refByYear[year];
      if (ref.DepositDate > existing.DepositDate) {
        refByYear[year] = ref;
      }
    }
  }

  // Fetch accounting data concurrently (max 5 at a time to be polite)
  const CONCURRENCY = 5;
  const yearEntries = Object.entries(refByYear);

  for (let i = 0; i < yearEntries.length; i += CONCURRENCY) {
    const batch = yearEntries.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async ([year, ref]) => {
        try {
          let rawData = null;

          // Optionally try improved/corrected data first
          if (preferImproved) {
            try {
              rawData = await nbbGet(
                `/improved/deposit/${ref.ReferenceNumber}/accountingData/improved/corrected`,
                "application/json"
              );
            } catch {
              // Fall back to authentic
            }
          }

          // Fetch authentic data
          if (!rawData) {
            rawData = await getAccountingData(ref.ReferenceNumber);
          }

          const financials = extractFinancials(rawData);
          if (financials) {
            result[year] = {
              ...financials,
              referenceNumber: ref.ReferenceNumber,
              depositDate: ref.DepositDate,
              modelType: ref.ModelType,
              dataVersion: rawData?._improvedVersion ? "Improved" : ref.DataVersion,
              fiscalYearEnd: ref.ExerciseDates?.endDate,
            };
          }
        } catch (err) {
          console.warn(`[NBB] Could not fetch data for ${cbeNumber} year ${year}: ${err.message}`);
        }
      })
    );
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeCbe(cbeNumber) {
  // Accept "0417.123.456" or "0417123456" or "417123456" → "0417123456"
  return cbeNumber.replace(/\./g, "").replace(/\s/g, "").padStart(10, "0");
}

function extractItemsArray(rawData) {
  // The JSON response can have different structures depending on model / version
  if (Array.isArray(rawData)) return rawData;
  if (rawData?.AnnualAccounts?.AccountingData) return rawData.AnnualAccounts.AccountingData;
  if (rawData?.accountingData) return rawData.accountingData;
  if (rawData?.items) return rawData.items;
  if (rawData?.Rubrieken) return rawData.Rubrieken;
  if (rawData?.data) return extractItemsArray(rawData.data);
  return null;
}

module.exports = {
  getFilingReferences,
  getAccountingData,
  extractFinancials,
  getCompanyFinancialsByYear,
};
