# 150CHF Organizations

A React and Node.js application for managing organizations in the 150CHF administration platform. The interface follows a compact enterprise application style and provides database-backed organization search, creation, editing, viewing, copying, deletion, status changes, and export.

## Features

- Organization list with server-side filtering and pagination.
- Search by organization code, name, and status.
- Summary panel with selected organization details.
- Create, view, edit, and delete organization records.
- Add, edit, and view use the dedicated organization details screen.
- Confirmation dialog before saving an organization.
- User-friendly validation and API error dialogs.
- Selection-only lookup fields for:
  - Reporting currency
  - Country
  - State or province
  - City
  - Organization type
  - Industry
- Cascading country, state, and city selection.
- Organization logo/image upload stored as a data URL.
- Excel-compatible organization export.
- Database health endpoint for operational checks.
- Responsive layout for smaller screens while preserving the reference design.

## Technology stack

### Frontend

- **React 18** — component-based user interface.
- **Vite** — development server and production bundler.
- **TanStack React Query** — API queries and mutations for organization loading, submission, update, and deletion.
- **Lucide React** — interface icons.
- **Tailwind CSS** — utility CSS support alongside the reference screen styling.
- **PostCSS and Autoprefixer** — CSS processing and browser compatibility.
- **country-state-city** — country, state, and city lookup data.

### Backend

- **Node.js** — JavaScript runtime.
- **Express** — HTTP API server.
- **node-postgres (`pg`)** — PostgreSQL connection pooling and parameterized queries.
- **Zod** — request and organization payload validation.
- **CORS** — cross-origin request support during development.
- **dotenv** — environment variable loading.

### Database

- **PostgreSQL**
- Schema and seed data: [`150CHF.sql`](./150CHF.sql)
- Main tables:
  - `organization`
  - `reporting_currency`

## Project structure

```text
150CHF_screen1/
├── src/
│   ├── App.jsx              # Organizations screen and form workflows
│   ├── index.css            # Application styling
│   ├── main.jsx             # React entry point and QueryClient provider
│   └── hooks/
│       └── useDashboard.js  # Shared dashboard hook
├── server/
│   └── index.js             # Express API and PostgreSQL access
├── scripts/
│   └── dev.js               # Starts API and Vite together
├── 150CHF.sql               # PostgreSQL schema and seed data
├── index.html               # Vite HTML entry point
├── package.json              # Scripts and dependencies
└── .env.example              # Environment variable template
```

## Prerequisites

- Node.js 18 or newer
- npm
- PostgreSQL 14 or newer

## Installation

From the project directory:

```powershell
cd D:\150CHF_screen1
npm install
```

Create a local environment file from the template:

```powershell
Copy-Item .env.example .env
```

Update `.env` with the credentials for the local PostgreSQL database. Do not commit `.env` or production credentials to source control.

Create the database, then import the schema and seed data with `psql`:

```powershell
createdb -U postgres 150CHF
psql -U postgres -d 150CHF -f 150CHF.sql
```

## Running locally

The recommended development command starts both the API and Vite:

```powershell
npm run dev
```

Then open:

```text
http://localhost:5173/
```

The development helper starts the API on port `4000` and the Vite frontend on its default port. The frontend calls the API through `/api` routes.

The services can also be started separately:

```powershell
npm run server
npm run dev
```

Run the commands in separate terminals when using this approach.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the API and Vite development server together. |
| `npm run server` | Starts the Express API server. |
| `npm run build` | Creates the production frontend build in `dist/`. |
| `npm run preview` | Serves the production build locally for verification. |

## Environment variables

The backend reads these variables from `.env`:

| Variable | Description | Default |
| --- | --- | --- |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | Empty |
| `DB_NAME` | PostgreSQL database name | `150CHF` |
| `PORT` | Express API port | `4100` |

The bundled development helper uses port `4000` for its API availability check. Keep the configured API port aligned with the project development setup when running both services.

## API overview

### Organizations

```text
GET    /api/organizations
GET    /api/organizations/:id
POST   /api/organizations
PUT    /api/organizations/:id
DELETE /api/organizations/:id
```

List requests support:

```text
/api/organizations?code=&name=&status=Select&page=1&linesPerPage=10
```

### Supporting endpoints

```text
GET /api/health
GET /api/summary
GET /api/currencies
GET /api/countries
GET /api/states?countryCode=IN
GET /api/cities?countryCode=IN&stateCode=AP
```

Organization create and update requests are validated on the server with Zod and on the client with React form validation. TanStack Query `useMutation` handles create, update, status, and delete submissions, while `useQuery` loads organizations and individual records. Database queries use parameterized values through `pg`.

## Validation and user interaction

- Code and name are required.
- Email and website values are checked when provided.
- Lookup-backed fields cannot be typed into directly; users select values through the search dialogs.
- A confirmation dialog is shown before a valid organization is saved.
- Invalid form values and failed API requests are shown in an error dialog.
- Database and list-loading errors are surfaced in the page rather than silently replaced with sample organization records.

## Production build

Create a production build with:

```powershell
npm run build
```

The build output is written to `dist/`. The build has been verified successfully with the current project configuration.

## Development notes

- Keep database credentials in `.env`, never in committed source files.
- Use the provided SQL schema when setting up a new local database.
- Keep lookup fields selection-only so displayed values remain valid database selections.
- Preserve the existing compact visual language when extending the Organizations screen.
