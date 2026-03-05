/**
 * GET /api/dashboard/:personEnterpriseNumber
 *
 * The main endpoint for the frontend dashboard.
 * Given a person's CBE number, returns everything needed to render the
 * 10-year financial table across all their mandates.
 *
 * Query params:
 *   years       comma-separated (default: last 10)
 *   improved    true|false — use NBB improved/corrected data where available
 *
 * Response:
 * {
 *   person: {
 *     enterpriseNumber: "0417.123.456",
 *     name: "De Smedt Jan",
 *     city: "Antwerp",
 *   },
 *   years: [2015, 2016, ..., 2024],
 *   companies: [
 *     {
 *       cbeNumber: "0650.234.567",
 *       name: "JDS Consulting BV",
 *       role: "Administrator",
 *       active: true,
 *       byYear: {
 *         "2023": { totalAssets: 1200000, totalDebt: 700000, ... },
 *         ...
 *       }
 *     },
 *     ...
 *   ],
 *   totals: {
 *     byYear: {
 *       "2023": { totalAssets: 3200000, totalDebt: 1900000, net: 1300000 },
 *       ...
 *     }
 *   }
 * }
 */

const express = require("express");
const router = express.Router();
const { getMandatesForPerson, getCompanyDetails } = require("../services/cbeService");
const { getCompanyFinancialsByYear } = require("../services/nbbService");
const { cached } = require("../services/cache");

const DEFAULT_YEARS = () => {
  const current = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => current - 9 + i);
};

router.get("/:personEnterpriseNumber", async (req, res, next) => {
  try {
    const { personEnterpriseNumber } = req.params;
    const years = req.query.years
      ? req.query.years.split(",").map(Number).filter(Boolean)
      : DEFAULT_YEARS();
    const preferImproved = req.query.improved === "true";

    console.log(`[Dashboard] Building dashboard for person ${personEnterpriseNumber}`);

    // ── Step 1: Get person details ──────────────────────────────────────────
    const personDetails = await cached(`company:${personEnterpriseNumber}`, () =>
      getCompanyDetails(personEnterpriseNumber)
    );

    // ── Step 2: Get all mandates ────────────────────────────────────────────
    const mandates = await cached(
      `mandates:${personEnterpriseNumber}:true`,
      () => getMandatesForPerson(personEnterpriseNumber, true)
    );

    console.log(`[Dashboard] Found ${mandates.length} mandates`);

    if (mandates.length === 0) {
      return res.json({
        person: personDetails,
        years,
        companies: [],
        totals: { byYear: {} },
      });
    }

    // ── Step 3: Fetch financials for all companies concurrently ─────────────
    // Limit to reasonable concurrency to avoid rate-limiting
    const CONCURRENCY = 4;
    const companies = [];

    for (let i = 0; i < mandates.length; i += CONCURRENCY) {
      const batch = mandates.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.all(
        batch.map(async (mandate) => {
          try {
            // Fetch company details + financials in parallel
            const [details, byYear] = await Promise.all([
              cached(`company:${mandate.cbeNumber}`, () =>
                getCompanyDetails(mandate.cbeNumber)
              ).catch(() => null),

              cached(
                `financials:${mandate.cbeNumber}:${years.join(",")}:${preferImproved}`,
                () => getCompanyFinancialsByYear(mandate.cbeNumber, years, preferImproved)
              ).catch((err) => {
                console.warn(`[Dashboard] Financials failed for ${mandate.cbeNumber}: ${err.message}`);
                return {};
              }),
            ]);

            return {
              cbeNumber: mandate.cbeNumber,
              name: details?.name ?? mandate.companyName,
              legalForm: details?.legalForm ?? null,
              active: mandate.active,
              role: mandate.role,
              mandateStart: mandate.startDate,
              mandateEnd: mandate.endDate,
              byYear,
            };
          } catch (err) {
            console.warn(`[Dashboard] Error for mandate ${mandate.cbeNumber}: ${err.message}`);
            return {
              cbeNumber: mandate.cbeNumber,
              name: mandate.companyName,
              active: mandate.active,
              role: mandate.role,
              byYear: {},
              error: err.message,
            };
          }
        })
      );

      companies.push(...batchResults);
    }

    // ── Step 4: Compute cross-company totals per year ───────────────────────
    const totals = { byYear: {} };

    for (const year of years) {
      const yearStr = String(year);
      let sumAssets = null;
      let sumDebt = null;

      for (const co of companies) {
        const yd = co.byYear[yearStr];
        if (!yd) continue;
        if (yd.totalAssets !== null && yd.totalAssets !== undefined) {
          sumAssets = (sumAssets ?? 0) + yd.totalAssets;
        }
        if (yd.totalDebt !== null && yd.totalDebt !== undefined) {
          sumDebt = (sumDebt ?? 0) + yd.totalDebt;
        }
      }

      if (sumAssets !== null || sumDebt !== null) {
        totals.byYear[yearStr] = {
          totalAssets: sumAssets,
          totalDebt: sumDebt,
          net: sumAssets !== null && sumDebt !== null ? sumAssets - sumDebt : null,
        };
      }
    }

    console.log(`[Dashboard] Done — ${companies.length} companies, ${Object.keys(totals.byYear).length} years with data`);

    res.json({
      person: personDetails,
      years,
      companies,
      totals,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
