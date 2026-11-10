import { useMemo, useState } from 'react';

const emptySearch = { code: '', name: '', organization: '', status: 'Select' };
const emptyCompany = {
  code: '',
  name: '',
  organization: '',
  registrationNumber: '',
  reportingCurrency: '',
  address: '',
  city: '',
  stateProvince: '',
  country: '',
  postalCode: '',
  status: 'Active'
};

async function readApiResponse(response, fallbackMessage) {
  const body = await response.text();
  let result = null;
  if (body) {
    try {
      result = JSON.parse(body);
    } catch {
      throw new Error(`${fallbackMessage} (HTTP ${response.status})`);
    }
  }
  if (!response.ok) throw new Error(result?.message || `${fallbackMessage} (HTTP ${response.status})`);
  if (result === null) throw new Error(`${fallbackMessage}: the API returned an empty response.`);
  return result;
}

async function getCompanies({ queryKey }) {
  const [, filters, page, linesPerPage] = queryKey;
  const params = new URLSearchParams({
    code: filters.code,
    name: filters.name,
    organization: filters.organization,
    status: filters.status,
    page: String(page),
    linesPerPage: String(linesPerPage)
  });
  const response = await fetch(`/api/companies?${params}`);
  return readApiResponse(response, 'Unable to load companies');
}

async function createCompany(company) {
  const response = await fetch('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(company)
  });
  return readApiResponse(response, 'Unable to create company');
}

async function saveCompany(id, company) {
  const response = await fetch(`/api/companies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(company)
  });
  return readApiResponse(response, 'Unable to update company');
}

async function getCompany(id) {
  const response = await fetch(`/api/companies/${id}`);
  return readApiResponse(response, 'Unable to load company');
}

async function deleteCompany(id) {
  const response = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
  return readApiResponse(response, 'Unable to delete company');
}

async function getCountries() {
  const response = await fetch('/api/countries');
  return readApiResponse(response, 'Unable to load countries');
}

async function getOrganizations() {
  const response = await fetch('/api/organizations');
  return readApiResponse(response, 'Unable to load organizations');
}

async function getStates(countryCode) {
  const response = await fetch(`/api/states?countryCode=${encodeURIComponent(countryCode)}`);
  return readApiResponse(response, 'Unable to load states');
}

async function getCities(countryCode, stateCode) {
  const response = await fetch(`/api/cities?countryCode=${encodeURIComponent(countryCode)}&stateCode=${encodeURIComponent(stateCode)}`);
  return readApiResponse(response, 'Unable to load cities');
}

function useCompanyValidation(form) {
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => {
    const nextErrors = {};
    if (!String(form.code || '').trim()) nextErrors.code = 'Code is required.';
    if (!String(form.name || '').trim()) nextErrors.name = 'Name is required.';
    if (!String(form.organization || '').trim()) nextErrors.organization = 'Organization is required.';
    if (!String(form.status || '').trim()) nextErrors.status = 'Status is required.';
    return nextErrors;
  }, [form.code, form.name, form.organization, form.status]);
  const validate = () => {
    setSubmitted(true);
    return Object.keys(errors).length === 0;
  };
  return { errors: submitted ? errors : {}, validate };
}

export {
  emptySearch,
  emptyCompany,
  readApiResponse,
  getCompanies,
  createCompany,
  saveCompany,
  getCompany,
  deleteCompany,
  getCountries,
  getOrganizations,
  getStates,
  getCities,
  useCompanyValidation
};
