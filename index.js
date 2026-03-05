require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const personRoutes = require("./routes/persons");
const companyRoutes = require("./routes/companies");
const financialRoutes = require("./routes/financials");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/requestLogger");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  methods: ["GET"],
}));
app.use(express.json());
app.use(requestLogger);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/persons", personRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/financials", financialRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NBB_ENV || "uat2",
    timestamp: new Date().toISOString(),
    keys: {
      cbe: process.env.CBE_API_TOKEN ? "configured" : "MISSING",
      nbb: process.env.NBB_CBSO_API_KEY ? "configured" : "MISSING",
    },
  });
});

// ── Serve built frontend (production) ─────────────────────────────────────────
// After running `npm run build` in the frontend folder, Express serves the
// static files directly — no separate frontend server needed.
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");
app.use(express.static(FRONTEND_DIST));

// ── SPA fallback — send index.html for all non-API routes ────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🏦  Belgian Financial Intelligence`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   NBB env : ${process.env.NBB_ENV || "uat2"}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`   CBE key : ${process.env.CBE_API_TOKEN ? "✓" : "✗ MISSING"}`);
  console.log(`   NBB key : ${process.env.NBB_CBSO_API_KEY ? "✓" : "✗ MISSING"}\n`);
});

module.exports = app;
