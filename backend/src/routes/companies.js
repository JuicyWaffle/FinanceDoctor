/**
 * GET /api/companies/mandates/:personEnterpriseNumber
 *
 * Returns all companies where this natural person holds a mandate (role).
 *
 * Query params:
 *   includeInactive=true|false   (default: true)
 *
 * Response:
 * {
 *   personEnterpriseNumber: "0417.123.456",
 *   mandates: [
 *     {
 *       cbeNumber: "0650.234.567",
 *       companyName: "JDS Consulting BV",
 *       role: "Administrator",
 *       startDate: "2018-01-15",
 *       endDate: null,
 *       active: true,
 *     },
 *     ...
 *   ]
 * }
 *
 * GET /api/companies/:cbeNumber
 *
 * Returns basic info for a single company.
 */

const express = require("express");
const router = express.Router();
const { getMandatesForPerson, getCompanyDetails } = require("../services/cbeService");
const { cached } = require("../services/cache");

// List mandates for a person
router.get("/mandates/:personEnterpriseNumber", async (req, res, next) => {
  try {
    const { personEnterpriseNumber } = req.params;
    const includeInactive = req.query.includeInactive !== "false";

    const cacheKey = `mandates:${personEnterpriseNumber}:${includeInactive}`;
    const mandates = await cached(cacheKey, () =>
      getMandatesForPerson(personEnterpriseNumber, includeInactive)
    );

    res.json({
      personEnterpriseNumber,
      count: mandates.length,
      active: mandates.filter((m) => m.active).length,
      mandates,
    });
  } catch (err) {
    next(err);
  }
});

// Get details for a single company
router.get("/:cbeNumber", async (req, res, next) => {
  try {
    const { cbeNumber } = req.params;
    const cacheKey = `company:${cbeNumber}`;
    const company = await cached(cacheKey, () => getCompanyDetails(cbeNumber));

    if (!company) {
      return res.status(404).json({ error: `Company ${cbeNumber} not found` });
    }

    res.json(company);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
