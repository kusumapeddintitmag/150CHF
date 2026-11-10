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
  organizationCode: z.string().trim().max(30).default(''),
  name: z.string().trim().max(191).default(''),
  companyCode: z.string().trim().max(30).default(''),
  branchCode: z.string().trim().max(30).default(''),
  department: z.string().trim().max(191).default(''),
  status: z.enum(['Select', 'Active', 'Inactive']).default('Select'),
  page: z.coerce.number().int().min(1).default(1),
  linesPerPage: z.coerce.number().int().min(1).max(10000).default(10)
});
const companySchema = z.object({
  organizationCode: z.string().trim().min(1).max(30),
  companyCode: z.string().trim().min(1).max(30),
  branchCode: z.string().trim().max(30).default(''),
  department: z.string().trim().max(191).default(''),
  name: z.string().trim().min(1).max(191),
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

const lookup = (path, table, codeColumn, nameColumn) => app.get(path, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, ${codeColumn} AS code, ${nameColumn} AS name, status
       FROM ${table}
       WHERE ${codeColumn} IS NOT NULL AND BTRIM(${codeColumn}) <> ''
       ORDER BY LOWER(${codeColumn}), id`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

lookup('/api/company-codes', 'company', 'code', 'name');
lookup('/api/branches', 'branch', 'branch_code', 'branch_name');
lookup('/api/departments', 'department', 'department_code', 'department_name');

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
    const { organizationCode, name, companyCode, branchCode, department, status, page, linesPerPage } = querySchema.parse(req.query);
    const values = [];
    const where = [];
    if (organizationCode) { values.push(`%${organizationCode}%`); where.push(`organization_code ILIKE $${values.length}`); }
    if (name) { values.push(`%${name}%`); where.push(`name ILIKE $${values.length}`); }
    if (companyCode) { values.push(`%${companyCode}%`); where.push(`code ILIKE $${values.length}`); }
    if (branchCode) { values.push(`%${branchCode}%`); where.push(`branch_code ILIKE $${values.length}`); }
    if (department) { values.push(`%${department}%`); where.push(`department ILIKE $${values.length}`); }
    if (status !== 'Select') { values.push(status); where.push(`status = $${values.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*)::integer AS total FROM company ${clause}`, values);
    const total = Number(countResult.rows[0].total);
    const offset = (page - 1) * linesPerPage;
    const rowsResult = await query(
      `SELECT id, organization_code AS "organizationCode", name, code AS "companyCode",
        branch_code AS "branchCode", department,
        organization, code,
        status FROM company ${clause}
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
      `SELECT id, organization_code AS "organizationCode", name, code AS "companyCode",
        branch_code AS "branchCode", department, organization, code,
        status FROM company WHERE id = $1`,
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
      `INSERT INTO company (code, name, organization, organization_code, branch_code, department, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [company.companyCode, company.name, company.organizationCode, company.organizationCode, company.branchCode, company.department, company.status]
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
      `UPDATE company SET code=$1, name=$2, organization=$3, organization_code=$4,
        branch_code=$5, department=$6, status=$7 WHERE id=$8`,
      [company.companyCode, company.name, company.organizationCode, company.organizationCode, company.branchCode, company.department, company.status, req.params.id]
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
  await query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_type') THEN
        CREATE TYPE status_type AS ENUM ('Active', 'Inactive');
      END IF;
    END
  $$`);
  await query(`CREATE TABLE IF NOT EXISTS organization (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    organization_code VARCHAR(30) NOT NULL,
    organization_name VARCHAR(191) NOT NULL,
    status status_type NOT NULL DEFAULT 'Active'
  )`);
  await query(`CREATE TABLE IF NOT EXISTS branch (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    branch_code VARCHAR(30) NOT NULL,
    branch_name VARCHAR(191) NOT NULL,
    status status_type NOT NULL DEFAULT 'Active'
  )`);
  await query(`CREATE TABLE IF NOT EXISTS department (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    department_code VARCHAR(30) NOT NULL,
    department_name VARCHAR(191) NOT NULL,
    organization_id BIGINT,
    company_id BIGINT,
    branch_id BIGINT,
    status status_type NOT NULL DEFAULT 'Active'
  )`);
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
    organization_code VARCHAR(30) NOT NULL DEFAULT '',
    branch_code VARCHAR(30) NOT NULL DEFAULT '',
    department VARCHAR(191) NOT NULL DEFAULT '',
    status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await query('ALTER TABLE company ADD COLUMN IF NOT EXISTS country VARCHAR(100)');
  await query('ALTER TABLE company ADD COLUMN IF NOT EXISTS organization_code VARCHAR(30) NOT NULL DEFAULT \'\'');
  await query('ALTER TABLE company ADD COLUMN IF NOT EXISTS branch_code VARCHAR(30) NOT NULL DEFAULT \'\'');
  await query('ALTER TABLE company ADD COLUMN IF NOT EXISTS department VARCHAR(191) NOT NULL DEFAULT \'\'');
  await query('ALTER TABLE department ADD COLUMN IF NOT EXISTS organization_id BIGINT');
  await query('ALTER TABLE department ADD COLUMN IF NOT EXISTS company_id BIGINT');
  await query('ALTER TABLE department ADD COLUMN IF NOT EXISTS branch_id BIGINT');
  await query('ALTER TABLE branch ADD COLUMN IF NOT EXISTS organization_id BIGINT');
  await query('ALTER TABLE branch ADD COLUMN IF NOT EXISTS company_id BIGINT');
  await query(`CREATE TABLE IF NOT EXISTS section_master (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    section_name VARCHAR(191) NOT NULL,
    organization_id BIGINT NOT NULL,
    company_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    status status_type NOT NULL DEFAULT 'Active',
    created_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_section_organization FOREIGN KEY (organization_id) REFERENCES organization (id),
    CONSTRAINT fk_section_company FOREIGN KEY (company_id) REFERENCES company (id),
    CONSTRAINT fk_section_branch FOREIGN KEY (branch_id) REFERENCES branch (id),
    CONSTRAINT fk_section_dept FOREIGN KEY (department_id) REFERENCES department (id)
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_section_master_department ON section_master (department_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_section_master_organization ON section_master (organization_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_section_master_company ON section_master (company_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_section_master_branch ON section_master (branch_id)');
  await query(`CREATE OR REPLACE FUNCTION set_section_master_updated_date()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_date = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$`);
  await query(`DROP TRIGGER IF EXISTS trg_section_master_updated_date ON section_master`);
  await query(`CREATE TRIGGER trg_section_master_updated_date
    BEFORE UPDATE ON section_master
    FOR EACH ROW EXECUTE FUNCTION set_section_master_updated_date()`);
};

const seedCompanies = async () => {
  await query(
    `INSERT INTO company
      (code, name, organization, organization_code, branch_code, department, registration_number, reporting_currency, address, country, city, state_province, postal_code, status)
     VALUES
      ('CHF-001', 'Helvetia Finance AG', '150CHF Holdings', 'ORG-001', 'BR-001', 'Finance', 'CHE-101.234.567', 'CHF', 'Bahnhofstrasse 12', 'Switzerland', 'Zurich', 'Zurich', '8001', 'Active'),
      ('CHF-002', 'Alpine Risk Partners', '150CHF Holdings', 'ORG-002', 'BR-002', 'Risk', 'CHE-202.345.678', 'EUR', 'Rue du Rhone 18', 'Switzerland', 'Geneva', 'Geneva', '1204', 'Active'),
      ('CHF-003', 'Summit Advisory GmbH', '150CHF Holdings', 'ORG-003', 'BR-003', 'Advisory', 'CHE-303.456.789', 'USD', 'Hauptstrasse 44', 'Switzerland', 'Basel', 'Basel-Stadt', '4051', 'Inactive'),
      ('CHF-004', 'Lakeside Capital SA', '150CHF Holdings', 'ORG-004', 'BR-004', 'Capital', 'CHE-404.567.890', 'CHF', 'Avenue de la Gare 9', 'Switzerland', 'Lausanne', 'Vaud', '1003', 'Active'),
      ('CHF-005', 'Edelweiss Consulting AG', '150CHF Holdings', 'ORG-005', 'BR-005', 'Consulting', 'CHE-505.678.901', 'EUR', 'Marktgasse 21', 'Switzerland', 'Bern', 'Bern', '3011', 'Active'),
      ('CHF-006', 'Rhine Technology GmbH', '150CHF Holdings', 'ORG-006', 'BR-006', 'Technology', 'CHE-606.789.012', 'USD', 'Rheinuferstrasse 7', 'Switzerland', 'Winterthur', 'Zurich', '8400', 'Inactive')
     ON CONFLICT (code) DO NOTHING`
  );
  await query(
    `UPDATE company
      SET organization_code = CASE code
        WHEN 'CHF-001' THEN COALESCE(NULLIF(organization_code, ''), 'ORG-001')
        WHEN 'CHF-002' THEN COALESCE(NULLIF(organization_code, ''), 'ORG-002')
        WHEN 'CHF-003' THEN COALESCE(NULLIF(organization_code, ''), 'ORG-003')
        WHEN 'CHF-004' THEN COALESCE(NULLIF(organization_code, ''), 'ORG-004')
        WHEN 'CHF-005' THEN COALESCE(NULLIF(organization_code, ''), 'ORG-005')
        WHEN 'CHF-006' THEN COALESCE(NULLIF(organization_code, ''), 'ORG-006')
        ELSE organization_code
      END,
      branch_code = CASE code
        WHEN 'CHF-001' THEN COALESCE(NULLIF(branch_code, ''), 'BR-001')
        WHEN 'CHF-002' THEN COALESCE(NULLIF(branch_code, ''), 'BR-002')
        WHEN 'CHF-003' THEN COALESCE(NULLIF(branch_code, ''), 'BR-003')
        WHEN 'CHF-004' THEN COALESCE(NULLIF(branch_code, ''), 'BR-004')
        WHEN 'CHF-005' THEN COALESCE(NULLIF(branch_code, ''), 'BR-005')
        WHEN 'CHF-006' THEN COALESCE(NULLIF(branch_code, ''), 'BR-006')
        ELSE branch_code
      END,
      department = CASE code
        WHEN 'CHF-001' THEN COALESCE(NULLIF(department, ''), 'Finance')
        WHEN 'CHF-002' THEN COALESCE(NULLIF(department, ''), 'Risk')
        WHEN 'CHF-003' THEN COALESCE(NULLIF(department, ''), 'Advisory')
        WHEN 'CHF-004' THEN COALESCE(NULLIF(department, ''), 'Capital')
        WHEN 'CHF-005' THEN COALESCE(NULLIF(department, ''), 'Consulting')
        WHEN 'CHF-006' THEN COALESCE(NULLIF(department, ''), 'Technology')
        ELSE department
      END
      WHERE code IN ('CHF-001', 'CHF-002', 'CHF-003', 'CHF-004', 'CHF-005', 'CHF-006')`
  );
};

const seedLookups = async () => {
  await query(
    `INSERT INTO organization (organization_code, organization_name, status)
     SELECT seed.code, seed.name, seed.status::status_type
     FROM (VALUES
       ('ORG-001', 'Helvetia Finance AG', 'Active'),
       ('ORG-002', 'Alpine Risk Partners', 'Active'),
       ('ORG-003', 'Summit Advisory GmbH', 'Inactive'),
       ('ORG-004', 'Lakeside Capital SA', 'Active'),
       ('ORG-005', 'Edelweiss Consulting AG', 'Active'),
       ('ORG-006', 'Rhine Technology GmbH', 'Inactive')
     ) AS seed(code, name, status)
     WHERE NOT EXISTS (SELECT 1 FROM organization existing WHERE existing.organization_code = seed.code)`
  );
  await query(
    `INSERT INTO branch (branch_code, branch_name, organization_id, company_id, status)
     SELECT seed.code, seed.name, organization_row.id, company_row.id, seed.status::status_type
     FROM (VALUES
       ('BR-001', 'Zurich Branch', 'Active'),
       ('BR-002', 'Geneva Branch', 'Active'),
       ('BR-003', 'Basel Branch', 'Inactive'),
       ('BR-004', 'Lausanne Branch', 'Active'),
       ('BR-005', 'Bern Branch', 'Active'),
       ('BR-006', 'Winterthur Branch', 'Inactive')
     ) AS seed(code, name, status)
     CROSS JOIN LATERAL (SELECT id FROM organization WHERE organization_code = REPLACE(seed.code, 'BR-', 'ORG-') ORDER BY id LIMIT 1) organization_row
     CROSS JOIN LATERAL (SELECT id FROM company WHERE code = CONCAT('CHF-', RIGHT(seed.code, 3)) ORDER BY id LIMIT 1) company_row
     WHERE NOT EXISTS (SELECT 1 FROM branch existing WHERE existing.branch_code = seed.code)`
  );
  await query(
    `INSERT INTO department (department_code, department_name, organization_id, company_id, status)
     SELECT seed.code, seed.name, organization_row.id, company_row.id, seed.status::status_type
     FROM (VALUES
       ('DEP-001', 'Finance', 'Active'),
       ('DEP-002', 'Risk', 'Active'),
       ('DEP-003', 'Advisory', 'Inactive'),
       ('DEP-004', 'Capital', 'Active'),
       ('DEP-005', 'Consulting', 'Active'),
       ('DEP-006', 'Technology', 'Inactive')
     ) AS seed(code, name, status)
     CROSS JOIN LATERAL (SELECT id FROM organization WHERE organization_code = CONCAT('ORG-', RIGHT(seed.code, 3)) ORDER BY id LIMIT 1) organization_row
     CROSS JOIN LATERAL (SELECT id FROM company WHERE code = CONCAT('CHF-', RIGHT(seed.code, 3)) ORDER BY id LIMIT 1) company_row
     WHERE NOT EXISTS (SELECT 1 FROM department existing WHERE existing.department_code = seed.code)`
  );
};

const startServer = async () => {
  try {
    await ensureCompanyTable();
    await seedCompanies();
    await seedLookups();
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
