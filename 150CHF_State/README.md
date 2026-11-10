# 150CHF Companies

A React and Node.js application for managing companies in the 150CHF administration platform. The interface provides database-backed company search, creation, editing, viewing, deletion, status changes, and export.

## Features

- Company list with server-side filtering and pagination.
- Search by Company code, name, and status.
- Filter by Organization and select organizations from a database-backed lookup dialog.
- Summary panel with selected Company details.
- Create, view, edit, and delete Company records.
- Delete actions open a confirmation dialog with purple In-Active and Delete buttons.
- Add, edit, and view use the dedicated Company details screen.
- Confirmation dialog before saving a company.
- User-friendly validation and API error dialogs.
- Company fields: Organization Code, Company Code, Branch Code, Department, Name, and Status.
- Excel-compatible Company export.
- Database health endpoint for operational checks.
- Responsive layout for smaller screens while preserving the reference design.

## Technology stack

### Frontend

- **React 18** — component-based user interface.
- **Vite** — development server and production bundler.
- **TanStack React Query** — API queries and mutations for Company loading, submission, update, and deletion.
- **Lucide React** — interface icons.
- **Tailwind CSS** — utility CSS support alongside the reference screen styling.
- **PostCSS and Autoprefixer** — CSS processing and browser compatibility.
- **country-state-city** — country, state, and city lookup data.

### Backend

- **Node.js** — JavaScript runtime.
- **Express** — HTTP API server.
- **node-postgres (`pg`)** — PostgreSQL connection pooling and parameterized queries.
- **Zod** — request and Company payload validation.
- **CORS** — cross-origin request support during development.
- **dotenv** — environment variable loading.

### Database

- **PostgreSQL**
- Schema and seed data: [`company.sql`](./company.sql)
- Main tables:
  - `company`

## Project structure

```text
150CHF_screen1/
├── src/
│   ├── App.jsx              # Companies screen and form workflows
│   ├── index.css            # Application styling
│   ├── main.jsx             # React entry point and QueryClient provider
│   └── hooks/
│       └── useDashboard.js  # Shared dashboard hook
├── server/
│   └── index.js             # Express API and PostgreSQL access
├── scripts/
│   └── dev.js               # Starts API and Vite together
├── company.sql              # PostgreSQL schema and seed data
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
psql -U postgres -d 150CHF -f company.sql
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

The development helper starts the API on port `4001` and the Vite frontend on its default port. The frontend calls the API through `/api` routes.

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
| `PORT` | Express API port | `4001` |

The bundled development helper and Vite proxy use port `4001` for the API.

## API overview

### Companies

```text
GET    /api/companies
GET    /api/companies/:id
POST   /api/companies
PUT    /api/companies/:id
DELETE /api/companies/:id
```

List requests support:

```text
/api/companies?code=&name=&status=Select&page=1&linesPerPage=10
```

### Supporting endpoints

```text
GET /api/health
GET /api/summary
GET /api/currencies
GET /api/organizations
GET /api/company-codes
GET /api/branches
GET /api/departments
GET /api/countries
GET /api/states?countryCode=IN
GET /api/cities?countryCode=IN&stateCode=AP
```

Company create and update requests are validated on the server with Zod and on the client with React form validation. TanStack Query `useMutation` handles create, update, status, and delete submissions, while `useQuery` loads companies and individual records. Database queries use parameterized values through `pg`.

## Validation and user interaction

- Organization Code, Company Code, Department, Name, and Status are required.
- Email and website values are checked when provided.
- Lookup-backed fields cannot be typed into directly; users select values through the database-backed search dialogs.
- A confirmation dialog is shown before a valid Company is saved.
- The delete confirmation dialog lets users mark a Company In-Active or permanently delete it.
- In-Active and Delete actions use the purple primary-action styling, including while a request is pending.
- Invalid form values and failed API requests are shown in an error dialog.
- Database and list-loading errors are surfaced in the page rather than silently replaced with sample Company records.

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
- Organization lookup values come directly from the shared `organization` master table.
- Preserve the existing compact visual language when extending the Companies screen.
