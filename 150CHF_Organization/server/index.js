import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { z } from 'zod';
import { City, Country, State } from 'country-state-city';

dotenv.config();

const app = express();
const port = process.env.PORT || 4100;
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '150chf',
  max: 5
});
const errorMessage = (error) => {
  if (error instanceof Error && error.message) return error.message;
  const message = String(error || '').trim();
  return message || 'Database request failed.';
};
const organizationDuplicateMessage = (error) => error?.code === '23505'
  ? 'Organization Code already exists. Enter a unique value.'
  : errorMessage(error);
const databaseSaveMessage = (error) => {
  if (error?.code === '22001') {
    const column = error.column ? ` for "${error.column}"` : '';
    return `A value is too long${column}. Image data is stored as TEXT; restart the API so the database migration can run.`;
  }
  return organizationDuplicateMessage(error);
};
const query = (text, values = []) => {
  let parameterIndex = 0;
  const sql = text.replace(/\?/g, () => `$${++parameterIndex}`);
  return pool.query(sql, values);
};
const querySchema = z.object({
  code: z.string().trim().max(30).default(''),
  name: z.string().trim().max(191).default(''),
  status: z.enum(['Select', 'Active', 'Inactive']).default('Select'),
  page: z.coerce.number().int().min(1).default(1),
  linesPerPage: z.coerce.number().int().min(1).max(10000).default(10)
});

const optionalText = (max) => z.preprocess(
  (value) => value == null ? '' : value,
  z.string().trim().max(max).default('')
);
const optionalImage = z.preprocess(
  (value) => value == null ? undefined : value,
  z.string().max(5_000_000).optional()
);
const optionalEmail = optionalText(191).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address.');
const optionalPhone = optionalText(50).refine((value) => !value || /^[+\d][\d\s().-]{6,24}$/.test(value), 'Enter a valid phone number.');

const organizationSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(191),
  licenseOrganization: z.boolean().default(false),
  reportingCurrency: optionalText(10),
  orgType: optionalText(100),
  industry: optionalText(100),
  registrationNumber: optionalText(100),
  dateOfIncorporation: optionalText(10),
  taxId: optionalText(100),
  registeredAddress: optionalText(255),
  country: optionalText(100),
  state: optionalText(100),
  city: optionalText(100),
  pincode: optionalText(20),
  phone: optionalPhone,
  email: optionalEmail,
  website: optionalText(191),
  imageDataUrl: optionalImage,
  status: z.enum(['Active', 'Inactive']).default('Active')
});

async function findOrganizationDuplicate(organization, organizationId = null) {
  const fields = [
    ['organization_code', organization.code, 'Organization Code'],
    ['organization_name', organization.name, 'Organization Name'],
    ['registration_number', organization.registrationNumber, 'Registration Number'],
    ['phone', organization.phone, 'Phone number'],
    ['email', organization.email, 'Email']
  ];
  for (const [column, value, label] of fields) {
    if (!value) continue;
    const values = [value];
    let exclude = '';
    if (organizationId) {
      values.push(organizationId);
      exclude = ' AND id <> ?';
    }
    const { rows } = await query(
      `SELECT id FROM organization WHERE LOWER(TRIM(${column})) = LOWER(TRIM(?))${exclude} LIMIT 1`,
      values
    );
    if (rows.length) return `${label} already exists. Enter a unique value.`;
  }
  return null;
}

app.use(cors());
app.use(express.json({ limit: '6mb' }));

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
    const { rows } = await query(
      `SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE status = 'Active')::integer AS active,
        COUNT(*) FILTER (WHERE status = 'Inactive')::integer AS inactive
       FROM organization`
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.get('/api/currencies', async (_req, res) => {
  try {
    await query(
      `INSERT INTO reporting_currency
        (currency_code, currency_name, currency_symbol, exchange_rate, is_base_currency, status)
       VALUES
        ('SGD', 'Singapore Dollar', 'S$', 1.000000, TRUE, 'Active'),
        ('USD', 'US Dollar', '$', 1.350000, FALSE, 'Active'),
        ('INR', 'Indian Rupee', '₹', 0.016000, FALSE, 'Active'),
        ('THB', 'Thai Baht', 'u0E3F', 0.037000, FALSE, 'Active'),
        ('IDR', 'Indonesian Rupiah', 'Rp', 0.000085, FALSE, 'Active'),
        ('VND', 'Vietnamese Dong', 'u20AB', 0.000053, FALSE, 'Active'),
        ('CNY', 'Chinese Yuan', 'u00A5', 0.187000, FALSE, 'Active'),
        ('LAK', 'Lao Kip', 'u20AD', 0.000062, FALSE, 'Active'),
        ('GBR', 'British Pound', NULL, 1.210000, FALSE, 'Active')
       ON CONFLICT (currency_code) DO NOTHING`
    );
    const { rows } = await query(
      `SELECT id, currency_code AS code, UPPER(currency_name) AS name, status
       FROM reporting_currency ORDER BY currency_code`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.get('/api/countries', async (_req, res) => {
  try {
    res.json(Country.getAllCountries().map((country) => ({
      id: country.isoCode,
      code: country.isoCode,
      name: country.name,
      status: 'Active'
    })));
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.get('/api/states', async (req, res) => {
  try {
    const countryCode = String(req.query.countryCode || req.query.countryId || '');
    res.json(State.getStatesOfCountry(countryCode).map((state) => ({
      id: `${countryCode}-${state.isoCode}`,
      name: state.name,
      code: state.isoCode,
      status: 'Active'
    })));
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.get('/api/cities', async (req, res) => {
  try {
    const countryCode = String(req.query.countryCode || '');
    const stateCode = String(req.query.stateCode || '');
    res.json(City.getCitiesOfState(countryCode, stateCode).map((city) => ({
      id: `${countryCode}-${stateCode}-${city.name}`,
      name: city.name,
      status: 'Active'
    })));
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.get('/api/organizations', async (req, res) => {
  try {
    const { code, name, status, page, linesPerPage } = querySchema.parse(req.query);
    const where = [];
    const values = [];
    if (code) {
      where.push('organization_code ILIKE ?');
      values.push(`%${code}%`);
    }
    if (name) {
      where.push('organization_name ILIKE ?');
      values.push(`%${name}%`);
    }
    if (status !== 'Select') {
      where.push('status = ?');
      values.push(status);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM organization ${clause}`, values
    );
    const [{ total }] = countRows;
    const offset = (page - 1) * linesPerPage;
    const { rows } = await query(
      `SELECT id, organization_code AS code, organization_name AS name,
        COALESCE((SELECT currency_code FROM reporting_currency
          WHERE reporting_currency.id = organization.reporting_currency_id), '') AS currency,
        status, logo_url AS "imageDataUrl"
       FROM organization ${clause}
       ORDER BY LOWER(organization_code), LOWER(organization_name), id LIMIT ? OFFSET ?`,
      [...values, linesPerPage, offset]
    );
    res.json({
      rows,
      total: Number(total),
      page,
      linesPerPage,
      totalPages: Math.max(1, Math.ceil(Number(total) / linesPerPage))
    });
  } catch (error) {
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    res.status(statusCode).json({ message: errorMessage(error) });
  }
});

app.get('/api/organizations/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, organization_code AS code, organization_name AS name,
        license_organization AS "licenseOrganization",
        COALESCE((SELECT currency_code FROM reporting_currency
          WHERE reporting_currency.id = organization.reporting_currency_id), '') AS "reportingCurrency",
        registration_number AS "registrationNumber",
        TO_CHAR(date_of_incorporation, 'YYYY-MM-DD') AS "dateOfIncorporation",
        tax_id AS "taxId", registered_address AS "registeredAddress", pincode, phone, email, website,
        logo_url AS "imageDataUrl", status, organization_metadata AS metadata
       FROM organization WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Organization not found' });
    const organization = rows[0];
    let metadata = {};
    try { metadata = organization.metadata ? JSON.parse(organization.metadata) : {}; } catch { /* legacy row */ }
    res.json({ ...organization, ...metadata, licenseOrganization: Boolean(organization.licenseOrganization) });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.put('/api/organizations/:id', async (req, res) => {
  try {
    const organization = organizationSchema.parse(req.body);
    const duplicateMessage = await findOrganizationDuplicate(organization, req.params.id);
    if (duplicateMessage) return res.status(409).json({ message: duplicateMessage });
    const currencyResult = organization.reportingCurrency
      ? await query('SELECT id FROM reporting_currency WHERE currency_code = ? LIMIT 1', [organization.reportingCurrency])
      : { rows: [] };
    const [currency] = currencyResult.rows;
    const result = await query(
      `UPDATE organization SET organization_code = ?, organization_name = ?, license_organization = ?,
        reporting_currency_id = ?, registration_number = ?, date_of_incorporation = ?, tax_id = ?,
        registered_address = ?, pincode = ?, phone = ?, email = ?, website = ?, logo_url = ?,
        organization_metadata = ?, status = ? WHERE id = ?`,
      [
        organization.code, organization.name, organization.licenseOrganization,
        currency?.id || null, organization.registrationNumber || null,
        organization.dateOfIncorporation || null, organization.taxId || null,
        organization.registeredAddress || null, organization.pincode || null,
        organization.phone || null, organization.email || null, organization.website || null,
        organization.imageDataUrl || null,
        JSON.stringify({ orgType: organization.orgType, industry: organization.industry, country: organization.country, state: organization.state, city: organization.city }),
        organization.status, req.params.id
      ]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Organization not found' });
    res.json({ message: 'Organization updated' });
  } catch (error) {
    const statusCode = error instanceof z.ZodError ? 400 : error?.code === '23505' ? 409 : 500;
    res.status(statusCode).json({ message: databaseSaveMessage(error) });
  }
});

app.delete('/api/organizations/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM organization WHERE id = ?', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Organization not found' });
    res.json({ message: 'Organization deleted' });
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

app.post('/api/organizations', async (req, res) => {
  try {
    const organization = organizationSchema.parse(req.body);
    const duplicateMessage = await findOrganizationDuplicate(organization);
    if (duplicateMessage) return res.status(409).json({ message: duplicateMessage });
    const currencyResult = organization.reportingCurrency
      ? await query(
        'SELECT id FROM reporting_currency WHERE currency_code = ? LIMIT 1',
        [organization.reportingCurrency]
      )
      : { rows: [] };
    const [currency] = currencyResult.rows;
    const result = await query(
      `INSERT INTO organization
        (organization_code, organization_name, license_organization, reporting_currency_id,
         org_type_id, industry_id, registration_number, date_of_incorporation, tax_id,
         registered_address, country_id, state_id, city_id, pincode, phone, email, website,
         logo_url, organization_metadata, status)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        organization.code, organization.name, organization.licenseOrganization,
        currency?.id || null, organization.registrationNumber || null,
        organization.dateOfIncorporation || null, organization.taxId || null,
        organization.registeredAddress || null, organization.pincode || null,
        organization.phone || null, organization.email || null, organization.website || null,
        organization.imageDataUrl || null,
        JSON.stringify({
          orgType: organization.orgType,
          industry: organization.industry,
          country: organization.country,
          state: organization.state,
          city: organization.city
        }),
        organization.status
      ]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Organization created' });
  } catch (error) {
    const statusCode = error instanceof z.ZodError ? 400 : error?.code === '23505' ? 409 : 500;
    res.status(statusCode).json({ message: databaseSaveMessage(error) });
  }
});

try {
  await query('ALTER TABLE organization ALTER COLUMN logo_url TYPE TEXT');
  await query('ALTER TABLE organization ALTER COLUMN registered_address TYPE TEXT');
  await query('ALTER TABLE organization ALTER COLUMN website TYPE TEXT');
} catch (error) {
  console.error(`Unable to prepare organization text storage: ${errorMessage(error)}`);
}

const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`API server is already running on port ${port}. Reuse the existing server or stop it before running npm run server.`);
    process.exitCode = 1;
    return;
  }
  console.error(`Unable to start API server: ${errorMessage(error)}`);
  process.exitCode = 1;
});
