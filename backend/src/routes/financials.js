/**
 * GET /api/financials/:cbeNumber
 *
 * Returns 10-year financial data for a single Belgian company.
 *
 * Query params:
 *   years     comma-separated list, e.g. "2015,2016,...,2024"
 *             defaults to last 10 years
 *   improved  true|false — try NBB improved/corrected data first (default: false)
 *
 * Response:
 * {
 *   cbeNumber: "0417.123.456",
 *   byYear: {
 *     "2023": {
 *       totalAssets: 1200000,
 *       totalDebt: 700000,
 *       equity: 500000,
 *       net: 500000,
 *       fixedAssets: 800000,
 *       currentAssets: 400000,
 *       ltDebt: 400000,
 *       stDebt: 300000,
 *       referenceNumber: "2024-00012345",
 *       depositDate: "2024-01-15",
 *       fiscalYearEnd: "2023-12-31",
 *       dataVersion: "Authentic",
 *     },
 *     ...
 *   }
 * }
 *
 * GET /api/financials/:cbeNumber/references
 *
 * Returns the raw list of filing references (useful for debugging).
 */

const express = require("express");
const router = express.Router();
const {
  getCompanyFinancialsByYear,
  getFilingReferences,
} = require("../services/nbbService");
const { cached } = require("../services/cache");

const DEFAULT_YEARS = () => {
  const current = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => current - 9 + i);
};

// 10-year financial data for a company
router.get("/:cbeNumber", async (req, res, next) => {
  try {
    const { cbeNumber } = req.params;
    const years = req.query.years
      ? req.query.years.split(",").map(Number).filter(Boolean)
      : DEFAULT_YEARS();
    const preferImproved = req.query.improved === "true";

    const cacheKey = `financials:${cbeNumber}:${years.join(",")}:${preferImproved}`;
    const byYear = await cached(cacheKey, () =>
      getCompanyFinancialsByYear(cbeNumber, years, preferImproved)
    );

    res.json({ cbeNumber, years, byYear });
  } catch (err) {
    next(err);
  }
});

// Raw filing references for a company (debug/inspection)
router.get("/:cbeNumber/references", async (req, res, next) => {
  try {
    const { cbeNumber } = req.params;
    const cacheKey = `refs:${cbeNumber}`;
    const refs = await cached(cacheKey, () => getFilingReferences(cbeNumber));
    res.json({ cbeNumber, count: refs.length, references: refs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
