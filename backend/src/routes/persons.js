/**
 * GET /api/persons/search?name=Jan+De+Smedt
 *
 * Searches the CBE/KBO for natural persons matching the given name.
 * Returns a list of candidates so the user can pick the right one.
 *
 * Response:
 * [
 *   {
 *     enterpriseNumber: "0417.123.456",
 *     name: "De Smedt Jan",
 *     birthDate: "1968-03-15",
 *     city: "Antwerp",
 *     active: true,
 *     mandateCount: 3,       ← quick count, not yet detailed
 *   },
 *   ...
 * ]
 */

const express = require("express");
const router = express.Router();
const { searchPersonsByName } = require("../services/cbeService");
const { cached } = require("../services/cache");

router.get("/search", async (req, res, next) => {
  try {
    const { name } = req.query;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        error: "Query parameter 'name' is required (minimum 2 characters)",
      });
    }

    const cacheKey = `persons:search:${name.toLowerCase().trim()}`;
    const persons = await cached(cacheKey, () =>
      searchPersonsByName(name.trim(), 30)
    );

    res.json({
      query: name,
      count: persons.length,
      results: persons,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
