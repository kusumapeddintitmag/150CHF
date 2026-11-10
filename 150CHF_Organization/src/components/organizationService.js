import { useMemo, useState } from 'react';
import { City, Country, State } from 'country-state-city';

const emptySearch = { code: '', name: '', status: 'Select' };
const emptyOrganization = {
  code: '', name: '', licenseOrganization: false, reportingCurrency: '', orgType: '',
  industry: '', registrationNumber: '', dateOfIncorporation: '', taxId: '',
  registeredAddress: '', country: '', state: '', city: '', pincode: '',
  phone: '', email: '', website: '', imageDataUrl: '', status: 'Active'
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

async function getOrganizations({ queryKey }) {
  const [, filters, page, linesPerPage] = queryKey;
  const params = new URLSearchParams({
    code: filters.code,
    name: filters.name,
    status: filters.status,
    page: String(page),
    linesPerPage: String(linesPerPage)
  });
  const response = await fetch(`/api/organizations?${params}`);
  return readApiResponse(response, 'Unable to load organizations');
}

async function createOrganization(organization) {
  const response = await fetch('/api/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(organization)
  });
  return readApiResponse(response, 'Unable to create organization');
}

async function saveOrganization(id, organization) {
  const response = await fetch(`/api/organizations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(organization)
  });
  await readApiResponse(response, 'Unable to update organization');
}

async function getOrganization(id) {
  const response = await fetch(`/api/organizations/${id}`);
  return readApiResponse(response, 'Unable to load organization');
}

async function deleteOrganization(id) {
  const response = await fetch(`/api/organizations/${id}`, { method: 'DELETE' });
  return readApiResponse(response, 'Unable to delete organization');
}

function useOrganizationValidation(form) {
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => {
    const nextErrors = {};
    const value = (field) => String(form[field] ?? '').trim();
    if (!value('code')) nextErrors.code = 'Code is required.';
    if (!value('name')) nextErrors.name = 'Name is required.';
    if (!value('registeredAddress')) nextErrors.registeredAddress = 'Registered Address is required.';
    if (!value('country')) nextErrors.country = 'Country is required.';
    if (!value('registrationNumber')) nextErrors.registrationNumber = 'Registration Number is required.';
    if (!value('phone')) nextErrors.phone = 'Phone number is required.';
    if (!value('email')) nextErrors.email = 'Email is required.';
    if (!form.imageDataUrl) nextErrors.imageDataUrl = 'Image Upload is required.';
    if (!form.status) nextErrors.status = 'Status is required.';
    if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) nextErrors.email = 'Enter a valid email address.';
    if (value('phone') && !/^\d{10}$/.test(value('phone'))) nextErrors.phone = 'Phone number must contain exactly 10 digits for the selected country.';
    if (value('website') && !/^https?:\/\/\S+$/i.test(value('website'))) nextErrors.website = 'Enter a valid website URL.';
    return nextErrors;
  }, [form.code, form.email, form.name, form.website, form.registeredAddress, form.country, form.registrationNumber, form.phone, form.imageDataUrl, form.status]);
  const validate = () => {
    setSubmitted(true);
    return Object.keys(errors).length === 0;
  };
  return { errors: submitted ? errors : {}, validate };
}

async function getCountries() {
  return Country.getAllCountries().map((country) => ({
    id: country.isoCode,
    code: country.isoCode,
    name: country.name,
    status: 'Active'
  }));
}

async function getStates(countryId) {
  if (!countryId) return [];
  return State.getStatesOfCountry(countryId).map((state) => ({
    id: `${countryId}-${state.isoCode}`,
    name: state.name,
    code: state.isoCode,
    status: 'Active'
  }));
}

async function getCities(countryCode, stateCode) {
  if (!countryCode || !stateCode) return [];
  return City.getCitiesOfState(countryCode, stateCode).map((city) => ({
    id: `${countryCode}-${stateCode}-${city.name}`,
    name: city.name,
    status: 'Active'
  }));
}

export { emptySearch, emptyOrganization, readApiResponse, getOrganizations, createOrganization, saveOrganization, getOrganization, deleteOrganization, useOrganizationValidation, getCountries, getStates, getCities };