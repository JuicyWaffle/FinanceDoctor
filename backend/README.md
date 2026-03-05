# Belgian Financial Intelligence — Backend API

Node.js/Express backend connecting the CBE/KBO and NBB CBSO APIs.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + API key status |
| GET | `/api/persons/search?name=Jan+De+Smedt` | Search natural persons by name |
| GET | `/api/companies/mandates/:personCBE` | All company mandates for a person |
| GET | `/api/companies/:cbeNumber` | Details for a single company |
| GET | `/api/financials/:cbeNumber` | 10-year financials for a company |
| GET | `/api/dashboard/:personCBE` | **Main**: full aggregated 10yr dashboard |

See full docs in individual route files.
