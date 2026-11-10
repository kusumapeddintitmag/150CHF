import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { z } from 'zod';
import { City, Country, State } from 'country-state-city';

dotenv.config();

const app = express();
const port = process.env.PORT === '4000' ? 4001 : process.env.PORT || 4001;
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '150chf',
  max: 5
});
const errorMessage = (error) => error instanceof Error && error.message ? error.message : 'Database request failed.';
const querySchema = z.object({
  code: z.string().trim().max(30).default(''),
  name: z.string().trim().max(191).default(''),
  organization: z.string().trim().max(191).default(''),
  status: z.enum(['Select', 'Active', 'Inactive']).default('Select'),
  page: z.coerce.number().int().min(1).default(1),
  linesPerPage: z.coerce.number().int().min(1).max(10000).default(10)
});
const companySchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(191),
  organization: z.string().trim().min(1).max(191),
  registrationNumber: z.string().trim().max(100).default(''),
  reportingCurrency: z.string().trim().max(10).default(''),
  address: z.string().trim().max(255).default(''),
  country: z.string().trim().max(100).default(''),
  city: z.string().trim().max(100).default(''),
  stateProvince: z.string().trim().max(100).default(''),
  postalCode: z.string().trim().max(20).default(''),
  status: z.enum(['Active', 'Inactive']).default('Active')
});
const query = (text, values = []) => pool.query(text, values);
const duplicateMessage = (error) => error?.code === '23505'
  ? 'Company Code already exists. Enter a unique value.'
  : errorMessage(error);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, message: 'Database connected' });
  } catch (error) {
    res.status(500).json({ ok: false, message: errorMessage(error) });
  }
});

app.get('/api/summary', async (_req, res) => {
  try {
    const { rows } = await query(`SELECT COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE status = 'Active')::integer AS active,
      COUNT(*) FILTER (WHERE status = 'Inactive')::integer AS inactive FROM company`);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.get('/api/currencies', (_req, res) => {
  res.json([
    { code: 'SGD', name: 'SINGAPORE DOLLAR', status: 'Active' },
    { code: 'USD', name: 'US DOLLAR', status: 'Active' },
    { code: 'INR', name: 'INDIAN RUPEE', status: 'Active' },
    { code: 'EUR', name: 'EURO', status: 'Active' }
  ]);
});

app.get('/api/countries', (_req, res) => {
  res.json(Country.getAllCountries().map((country) => ({
    id: country.isoCode,
    code: country.isoCode,
    name: country.name,
    status: 'Active'
  })));
});

app.get('/api/organizations', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, organization_code AS code, organization_name AS name, status
       FROM organization
       WHERE organization_name IS NOT NULL AND BTRIM(organization_name) <> ''
       ORDER BY LOWER(organization_name), id`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.get('/api/states', (req, res) => {
  const countryCode = String(req.query.countryCode || '');
  res.json(State.getStatesOfCountry(countryCode).map((state) => ({
    id: state.isoCode,
    code: state.isoCode,
    name: state.name,
    status: 'Active'
  })));
});

app.get('/api/cities', (req, res) => {
  const countryCode = String(req.query.countryCode || '');
  const stateCode = String(req.query.stateCode || '');
  res.json(City.getCitiesOfState(countryCode, stateCode).map((city) => ({
    id: city.name,
    name: city.name,
    status: 'Active'
  })));
});

app.get('/api/companies', async (req, res) => {
  try {
    const { code, name, organization, status, page, linesPerPage } = querySchema.parse(req.query);
    const values = [];
    const where = [];
    if (code) { values.push(`%${code}%`); where.push(`code ILIKE $${values.length}`); }
    if (name) { values.push(`%${name}%`); where.push(`name ILIKE $${values.length}`); }
    if (organization) { values.push(`%${organization}%`); where.push(`organization ILIKE $${values.length}`); }
    if (status !== 'Select') { values.push(status); where.push(`status = $${values.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*)::integer AS total FROM company ${clause}`, values);
    const total = Number(countResult.rows[0].total);
    const offset = (page - 1) * linesPerPage;
    const rowsResult = await query(
      `SELECT id, code, name, organization, registration_number AS "registrationNumber",
        reporting_currency AS "reportingCurrency", address, country, city, state_province AS "stateProvince",
        postal_code AS "postalCode", status FROM company ${clause}
       ORDER BY LOWER(code), LOWER(name), id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, linesPerPage, offset]
    );
    res.json({ rows: rowsResult.rows, total, page, linesPerPage, totalPages: Math.max(1, Math.ceil(total / linesPerPage)) });
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : 500).json({ message: errorMessage(error) });
  }
});

app.get('/api/companies/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, code, name, organization, registration_number AS "registrationNumber",
        reporting_currency AS "reportingCurrency", address, country, city, state_province AS "stateProvince",
        postal_code AS "postalCode", status FROM company WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Company not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.post('/api/companies', async (req, res) => {
  try {
    const company = companySchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO company (code, name, organization, registration_number, reporting_currency,
        address, country, city, state_province, postal_code, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [company.code, company.name, company.organization, company.registrationNumber, company.reportingCurrency,
        company.address, company.country, company.city, company.stateProvince, company.postalCode, company.status]
    );
    res.status(201).json({ id: rows[0].id, message: 'Company created' });
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : error?.code === '23505' ? 409 : 500).json({ message: duplicateMessage(error) });
  }
});

app.put('/api/companies/:id', async (req, res) => {
  try {
    const company = companySchema.parse(req.body);
    const result = await query(
      `UPDATE company SET code=$1, name=$2, organization=$3, registration_number=$4,
        reporting_currency=$5, address=$6, country=$7, city=$8, state_province=$9, postal_code=$10, status=$11
       WHERE id=$12`,
      [company.code, company.name, company.organization, company.registrationNumber, company.reportingCurrency,
        company.address, company.country, company.city, company.stateProvince, company.postalCode, company.status, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Company not found' });
    res.json({ message: 'Company updated' });
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : error?.code === '23505' ? 409 : 500).json({ message: duplicateMessage(error) });
  }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM company WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Company not found' });
    res.json({ message: 'Company deleted' });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

const ensureCompanyTable = async () => {
  await query(`CREATE TABLE IF NOT EXISTS company (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(191) NOT NULL,
    organization VARCHAR(191) NOT NULL,
    registration_number VARCHAR(100),
    reporting_currency VARCHAR(10),
    address VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await query('ALTER TABLE company ADD COLUMN IF NOT EXISTS country VARCHAR(100)');
};

const seedCompanies = async () => {
  await query(
    `INSERT INTO company
      (code, name, organization, registration_number, reporting_currency, address, country, city, state_province, postal_code, status)
     VALUES
      ('CHF-001', 'Helvetia Finance AG', '150CHF Holdings', 'CHE-101.234.567', 'CHF', 'Bahnhofstrasse 12', 'Switzerland', 'Zurich', 'Zurich', '8001', 'Active'),
      ('CHF-002', 'Alpine Risk Partners', '150CHF Holdings', 'CHE-202.345.678', 'EUR', 'Rue du Rhone 18', 'Switzerland', 'Geneva', 'Geneva', '1204', 'Active'),
      ('CHF-003', 'Summit Advisory GmbH', '150CHF Holdings', 'CHE-303.456.789', 'USD', 'Hauptstrasse 44', 'Switzerland', 'Basel', 'Basel-Stadt', '4051', 'Active'),
      ('CHF-004', 'Lakeside Capital SA', '150CHF Holdings', 'CHE-404.567.890', 'CHF', 'Avenue de la Gare 9', 'Switzerland', 'Lausanne', 'Vaud', '1003', 'Active'),
      ('CHF-005', 'Edelweiss Consulting AG', '150CHF Holdings', 'CHE-505.678.901', 'EUR', 'Marktgasse 21', 'Switzerland', 'Bern', 'Bern', '3011', 'Active'),
      ('CHF-006', 'Rhine Technology GmbH', '150CHF Holdings', 'CHE-606.789.012', 'USD', 'Rheinuferstrasse 7', 'Switzerland', 'Winterthur', 'Zurich', '8400', 'Active'),
      ('CHF-007', 'Central Alps Trading AG', '150CHF Holdings', 'CHE-707.890.123', 'GBP', 'Via Nassa 15', 'Switzerland', 'Lugano', 'Ticino', '6900', 'Active'),
      ('CHF-008', 'Swiss Horizon Services SA', '150CHF Holdings', 'CHE-808.901.234', 'CHF', 'Route de Meyrin 38', 'Switzerland', 'Meyrin', 'Geneva', '1217', 'Active')
     ON CONFLICT (code) DO NOTHING`
  );
};

const startServer = async () => {
  try {
    await ensureCompanyTable();
    await seedCompanies();
    const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
    server.on('error', (error) => {
      console.error(`Unable to start API server: ${errorMessage(error)}`);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(`Unable to initialize company database: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
};

startServer();
