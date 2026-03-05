import { useState, useEffect, useCallback } from "react";

// ── API CLIENT ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:3001/api";

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

const api = {
  searchPersons: (q) => apiFetch(`/persons/search?q=${encodeURIComponent(q)}`),
  getFinancials: (personId) => apiFetch(`/financials/person/${personId}?years=10`),
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toLocaleString()}`;
};

// ── SEARCH SCREEN ─────────────────────────────────────────────────────────────
function SearchScreen({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await api.searchPersons(query.trim());
      setResults(data.persons || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0e1a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Mono', 'Courier New', monospace", padding: "2rem",
    }}>
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px)",
        backgroundSize: "40px 40px", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "560px" }}>
        <div style={{ marginBottom: "3rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div style={{ width: "8px", height: "32px", background: "linear-gradient(180deg, #d4af37, #f5e06e)", borderRadius: "2px" }} />
            <span style={{ color: "#d4af37", fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase" }}>
              Belgian Financial Intelligence
            </span>
          </div>
          <h1 style={{
            margin: 0, fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontWeight: 700, color: "#f0ead6", lineHeight: 1.15, letterSpacing: "-0.02em",
          }}>
            Person Financial<br /><span style={{ color: "#d4af37" }}>Lookup</span>
          </h1>
          <p style={{ margin: "0.75rem 0 0", color: "#4a5568", fontSize: "0.8rem", letterSpacing: "0.05em" }}>
            Search by administrator name → view 10-year balance sheet across all mandates
          </p>
        </div>

        <div style={{ display: "flex", marginBottom: "2rem" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Jan De Smedt"
            autoFocus
            style={{
              flex: 1, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(212,175,55,0.25)", borderRight: "none",
              borderRadius: "4px 0 0 4px", color: "#f0ead6",
              padding: "0.85rem 1.1rem", fontSize: "0.9rem",
              fontFamily: "inherit", outline: "none", letterSpacing: "0.02em",
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              background: loading ? "#2d3748" : "linear-gradient(135deg, #d4af37, #f5e06e)",
              border: "none", borderRadius: "0 4px 4px 0",
              padding: "0.85rem 1.4rem", color: loading ? "#6b7280" : "#0a0e1a",
              fontFamily: "inherit", fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "···" : "Search"}
          </button>
        </div>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "6px", padding: "0.85rem 1rem",
            color: "#ef4444", fontSize: "0.75rem", marginBottom: "1rem",
          }}>
            ⚠ {error}
          </div>
        )}

        {results !== null && !error && (
          <div>
            {results.length === 0 ? (
              <p style={{ color: "#4a5568", fontSize: "0.8rem", textAlign: "center" }}>No persons found.</p>
            ) : (
              <>
                <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#d4af37", marginBottom: "0.75rem" }}>
                  {results.length} result{results.length !== 1 ? "s" : ""} — select the correct person
                </div>
                {results.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelect(p)}
                    style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)",
                      borderRadius: "6px", padding: "1rem 1.25rem", marginBottom: "0.5rem",
                      cursor: "pointer", display: "flex", justifyContent: "space-between",
                      alignItems: "center", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(212,175,55,0.08)"; e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(212,175,55,0.15)"; }}
                  >
                    <div>
                      <div style={{ color: "#f0ead6", fontWeight: 600, fontSize: "0.95rem" }}>{p.name}</div>
                      <div style={{ color: "#4a5568", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                        {[p.birthDate, p.city, p.postalCode].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span style={{ color: "#d4af37", fontSize: "0.7rem" }}>→</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD SCREEN ──────────────────────────────────────────────────────────
function DashboardScreen({ person, onBack }) {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getFinancials(person.id)
      .then(setDashData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [person.id]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} onBack={onBack} />;

  const { years, companies, totals, meta } = dashData;

  const allVals = [...totals.assets, ...totals.debt, ...totals.net].filter(v => v !== null && v > 0);
  const maxVal = Math.max(...allVals, 1);
  const getBarHeight = (val) => val !== null && val > 0 ? Math.max(2, (val / maxVal) * 32) : 2;

  const colStyle = (i) => ({
    background: hoverCol === i ? "rgba(212,175,55,0.06)" : "transparent",
    transition: "background 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", fontFamily: "'DM Mono', 'Courier New', monospace", color: "#f0ead6" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* Topbar */}
        <div style={{
          borderBottom: "1px solid rgba(212,175,55,0.12)", padding: "1rem 2rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(10,14,26,0.95)", backdropFilter: "blur(8px)",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <button onClick={onBack} style={{
              background: "none", border: "1px solid rgba(212,175,55,0.2)", borderRadius: "3px",
              color: "#d4af37", cursor: "pointer", fontFamily: "inherit",
              fontSize: "0.65rem", letterSpacing: "0.12em", padding: "0.4rem 0.75rem", textTransform: "uppercase",
            }}>← Back</button>
            <div>
              <div style={{ color: "#d4af37", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>Administrator Profile</div>
              <div style={{ fontSize: "1.05rem", fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{person.name}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#4a5568", fontSize: "0.65rem" }}>{[person.birthDate, person.city].filter(Boolean).join(" · ")}</div>
            <div style={{ color: "#d4af37", fontSize: "0.7rem", marginTop: "0.1rem" }}>
              {meta?.activeMandates ?? companies.length} active · {meta?.totalMandates ?? companies.length} total mandates
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "rgba(212,175,55,0.1)", borderBottom: "1px solid rgba(212,175,55,0.1)" }}>
          {[
            { label: `Total Assets (${years[years.length - 1]})`, value: fmt(totals.assets[totals.assets.length - 1]), sub: "across all companies" },
            { label: `Total Debt (${years[years.length - 1]})`, value: fmt(totals.debt[totals.debt.length - 1]), sub: "financial liabilities" },
            { label: `Net Position (${years[years.length - 1]})`, value: fmt(totals.net[totals.net.length - 1]), sub: "assets minus debt", highlight: true },
          ].map((kpi, i) => (
            <div key={i} style={{ padding: "1.5rem 2rem", background: kpi.highlight ? "rgba(212,175,55,0.05)" : "rgba(10,14,26,0.95)" }}>
              <div style={{ color: "#4a5568", fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.4rem" }}>{kpi.label}</div>
              <div style={{ fontSize: "1.6rem", fontFamily: "'Playfair Display', serif", fontWeight: 700, color: kpi.highlight ? "#d4af37" : "#f0ead6", lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ color: "#4a5568", fontSize: "0.65rem", marginTop: "0.3rem" }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", padding: "2rem" }}>
          {companies.length === 0 ? (
            <div style={{ color: "#4a5568", textAlign: "center", padding: "3rem", fontSize: "0.8rem" }}>
              No mandate data found for this person.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", minWidth: "900px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0 1rem 0.75rem 0", color: "#4a5568", fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500, width: "220px", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
                    Company / Period
                  </th>
                  {years.map((y, i) => (
                    <th key={y}
                      onMouseEnter={() => setHoverCol(i)}
                      onMouseLeave={() => setHoverCol(null)}
                      style={{
                        padding: "0 0.5rem 0.75rem", color: i === years.length - 1 ? "#d4af37" : "#4a5568",
                        fontSize: "0.6rem", letterSpacing: "0.1em", fontWeight: i === years.length - 1 ? 700 : 400,
                        borderBottom: `1px solid ${i === years.length - 1 ? "rgba(212,175,55,0.3)" : "rgba(212,175,55,0.08)"}`,
                        textAlign: "right", cursor: "default", ...colStyle(i),
                      }}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ASSETS */}
                <SectionHeader label="ASSETS" years={years} colStyle={colStyle} setHoverCol={setHoverCol} />
                {companies.map((c) => (
                  <CompanyRow key={c.cbeNumber + "-a"} company={c} field="totalAssets" type="assets" years={years} colStyle={colStyle} hoverCol={hoverCol} setHoverCol={setHoverCol} />
                ))}
                <TotalRow label="Total Assets" values={totals.assets} color="#3b82f6" years={years} colStyle={colStyle} hoverCol={hoverCol} setHoverCol={setHoverCol} />

                <tr><td colSpan={years.length + 1} style={{ height: "1.5rem" }} /></tr>

                {/* DEBT */}
                <SectionHeader label="DEBT" years={years} colStyle={colStyle} setHoverCol={setHoverCol} />
                {companies.map((c) => (
                  <CompanyRow key={c.cbeNumber + "-d"} company={c} field="totalDebt" type="debt" years={years} colStyle={colStyle} hoverCol={hoverCol} setHoverCol={setHoverCol} />
                ))}
                <TotalRow label="Total Debt" values={totals.debt} color="#ef4444" years={years} colStyle={colStyle} hoverCol={hoverCol} setHoverCol={setHoverCol} />

                <tr><td colSpan={years.length + 1} style={{ height: "1.5rem" }} /></tr>

                {/* NET */}
                <SectionHeader label="NET POSITION" years={years} colStyle={colStyle} setHoverCol={setHoverCol} />
                <NetRow values={totals.net} years={years} colStyle={colStyle} hoverCol={hoverCol} setHoverCol={setHoverCol} />
                {/* Trend bars */}
                <tr>
                  <td style={{ paddingBottom: "0.5rem", color: "#4a5568", fontSize: "0.6rem", letterSpacing: "0.1em" }}>trend</td>
                  {totals.net.map((v, i) => (
                    <td key={i} onMouseEnter={() => setHoverCol(i)} onMouseLeave={() => setHoverCol(null)}
                      style={{ textAlign: "right", padding: "0 0.5rem", verticalAlign: "bottom", paddingBottom: "0.5rem", ...colStyle(i) }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
                        <div style={{
                          width: "16px", height: `${getBarHeight(v)}px`,
                          background: v === null ? "rgba(255,255,255,0.05)" : v >= 0 ? `rgba(212,175,55,${0.3 + ((v || 0) / maxVal) * 0.7})` : "rgba(239,68,68,0.5)",
                          borderRadius: "2px 2px 0 0",
                        }} />
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}

          {/* Data source legend */}
          <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid rgba(212,175,55,0.08)", color: "#2d3748", fontSize: "0.62rem", letterSpacing: "0.06em", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <span>Source: NBB CBSO Authentic Data API + CBE/KBO Crossroads Bank</span>
            <span>Values in EUR · Figures from filed annual accounts</span>
            <span>— = no filing or JSON not available (pre-2022 XBRL)</span>
            {meta?.dataNote && <span>ⓘ {meta.dataNote}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label, years, colStyle, setHoverCol }) {
  return (
    <tr>
      <td style={{ padding: "0.6rem 0 0.35rem", color: "#d4af37", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>{label}</td>
      {years.map((_, i) => <td key={i} onMouseEnter={() => setHoverCol(i)} onMouseLeave={() => setHoverCol(null)} style={colStyle(i)} />)}
    </tr>
  );
}

function CompanyRow({ company, field, type, years, colStyle, hoverCol, setHoverCol }) {
  const color = type === "assets" ? "#3b82f6" : "#ef4444";
  return (
    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <td style={{ padding: "0.45rem 1rem 0.45rem 0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: "3px", height: "14px", borderRadius: "2px", background: company.active ? color : "#2d3748", flexShrink: 0 }} />
          <div>
            <div style={{ color: "#c8b96e", fontSize: "0.72rem" }}>{company.name}</div>
            <div style={{ color: "#2d3748", fontSize: "0.6rem" }}>
              {company.cbeFormatted || company.cbeNumber}
              {company.role ? ` · ${company.role}` : ""}
              {!company.active ? " · inactive" : ""}
            </div>
          </div>
        </div>
      </td>
      {years.map((year, i) => {
        const fin = company.financials?.find((f) => f.fiscalYear === year);
        const val = fin?.[field] ?? null;
        const isUnavailable = fin?.dataSource === "json_unavailable" || fin?.dataSource === "no_filing";
        return (
          <td key={i}
            onMouseEnter={() => setHoverCol(i)} onMouseLeave={() => setHoverCol(null)}
            title={isUnavailable ? `No JSON data for ${year}` : undefined}
            style={{
              textAlign: "right", padding: "0.45rem 0.5rem",
              color: hoverCol === i ? "#f0ead6" : val !== null ? "#687280" : "#1f2937",
              fontSize: "0.72rem", fontVariantNumeric: "tabular-nums",
              ...colStyle(i),
            }}>
            {fmt(val)}
          </td>
        );
      })}
    </tr>
  );
}

function TotalRow({ label, values, color, years, colStyle, hoverCol, setHoverCol }) {
  return (
    <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <td style={{ padding: "0.5rem 0 0.5rem 0.75rem", color: "#8a9bb5", fontSize: "0.68rem", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} onMouseEnter={() => setHoverCol(i)} onMouseLeave={() => setHoverCol(null)}
          style={{ textAlign: "right", padding: "0.5rem 0.5rem", color: hoverCol === i ? "#fff" : color, fontSize: "0.75rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", ...colStyle(i) }}>
          {fmt(v)}
        </td>
      ))}
    </tr>
  );
}

function NetRow({ values, years, colStyle, hoverCol, setHoverCol }) {
  return (
    <tr style={{ background: "rgba(212,175,55,0.04)", borderTop: "1px solid rgba(212,175,55,0.15)", borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
      <td style={{ padding: "0.65rem 0 0.65rem 0.75rem", color: "#d4af37", fontSize: "0.7rem", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>NET (Assets − Debt)</td>
      {values.map((v, i) => (
        <td key={i} onMouseEnter={() => setHoverCol(i)} onMouseLeave={() => setHoverCol(null)}
          style={{ textAlign: "right", padding: "0.65rem 0.5rem", color: v === null ? "#1f2937" : v >= 0 ? "#d4af37" : "#ef4444", fontSize: "0.8rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", ...colStyle(i) }}>
          {fmt(v)}
        </td>
      ))}
    </tr>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", color: "#d4af37", fontSize: "0.75rem", letterSpacing: "0.2em" }}>
      <div>
        <div style={{ marginBottom: "0.5rem" }}>FETCHING FINANCIAL DATA</div>
        <div style={{ height: "2px", background: "rgba(212,175,55,0.2)", borderRadius: "2px", overflow: "hidden", width: "200px" }}>
          <div style={{ height: "100%", width: "40%", background: "linear-gradient(90deg, transparent, #d4af37, transparent)", animation: "slide 1.2s ease-in-out infinite" }} />
        </div>
        <style>{`@keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }`}</style>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: "400px" }}>
        <div style={{ color: "#ef4444", fontSize: "0.7rem", letterSpacing: "0.2em", marginBottom: "1rem" }}>ERROR</div>
        <div style={{ color: "#f0ead6", marginBottom: "2rem", fontSize: "0.85rem" }}>{message}</div>
        <button onClick={onBack} style={{ background: "none", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "4px", color: "#d4af37", cursor: "pointer", fontFamily: "inherit", fontSize: "0.75rem", padding: "0.6rem 1.2rem" }}>← Go back</button>
      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700&display=swap";
    document.head.appendChild(link);
  }, []);

  return selectedPerson
    ? <DashboardScreen person={selectedPerson} onBack={() => setSelectedPerson(null)} />
    : <SearchScreen onSelect={setSelectedPerson} />;
}
