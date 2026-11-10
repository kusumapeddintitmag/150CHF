import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, ChevronLeft, ChevronRight, ClipboardList, MapPin, Power, Search, X } from 'lucide-react';
import {
  emptyCompany,
  createCompany,
  saveCompany,
  getCompany,
  getCountries,
  getOrganizations,
  getStates,
  getCities,
  useCompanyValidation
} from './companyService';
import { CompanyDialog, TopNavigation } from './CompanyShared';

function CompanyForm({ onCancel, onCreated, layout, companyId, initialCompany, readOnly = false }) {
  const [form, setForm] = useState({ ...emptyCompany, ...initialCompany });
  const [originalForm, setOriginalForm] = useState({ ...emptyCompany, ...initialCompany });
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');
  const [locationLookup, setLocationLookup] = useState(null);
  const [locationCodeSearch, setLocationCodeSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationStatus, setLocationStatus] = useState('Select');
  const [locationPage, setLocationPage] = useState(1);
  const [locationLinesPerPage, setLocationLinesPerPage] = useState(5);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [locationError, setLocationError] = useState('');
  const validation = useCompanyValidation(form);
  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId),
    enabled: Boolean(companyId),
    refetchOnWindowFocus: false
  });
  const companyMutation = useMutation({
    mutationFn: ({ id, company }) => id ? saveCompany(id, company) : createCompany(company),
    onSuccess: onCreated,
    onError: (requestError) => {
      setError(requestError.message);
      setDialog({ type: 'error', message: requestError.message });
    }
  });

  useEffect(() => {
    if (companyQuery.data) {
      const loadedCompany = { ...emptyCompany, ...companyQuery.data };
      setForm(loadedCompany);
      setOriginalForm(loadedCompany);
    }
    if (companyQuery.error) {
      setError(companyQuery.error.message);
      setDialog({ type: 'error', message: companyQuery.error.message });
    }
  }, [companyQuery.data, companyQuery.error]);

  useEffect(() => {
    getCountries().then(setCountries).catch((requestError) => setLocationError(requestError.message));
    getOrganizations().then(setOrganizations).catch((requestError) => setLocationError(requestError.message));
  }, []);

  useEffect(() => {
    const country = countries.find((item) => item.name === form.country);
    setStates([]);
    setCities([]);
    if (country) getStates(country.code).then(setStates).catch((requestError) => setLocationError(requestError.message));
  }, [countries, form.country]);

  useEffect(() => {
    const country = countries.find((item) => item.name === form.country);
    const state = states.find((item) => item.name === form.stateProvince);
    setCities([]);
    if (country && state) getCities(country.code, state.code).then(setCities).catch((requestError) => setLocationError(requestError.message));
  }, [countries, states, form.country, form.stateProvince]);

  const update = (field) => (event) => setForm((value) => ({ ...value, [field]: event.target.value }));
  const locationOptions = locationLookup === 'organization' ? organizations : locationLookup === 'country' ? countries : locationLookup === 'state' ? states : cities;
  const filteredLocationOptions = locationOptions
    .filter((item) =>
      (item.code || '').toLowerCase().includes(locationCodeSearch.toLowerCase()) &&
      item.name.toLowerCase().includes(locationSearch.toLowerCase()) &&
      (locationStatus === 'Select' || (item.status || 'Active') === locationStatus)
    );
  const locationTotalPages = Math.max(1, Math.ceil(filteredLocationOptions.length / locationLinesPerPage));
  const pagedLocationOptions = filteredLocationOptions.slice(
    (locationPage - 1) * locationLinesPerPage,
    locationPage * locationLinesPerPage
  );
  const openLocationLookup = (type) => {
    setLocationLookup(type);
    setLocationCodeSearch('');
    setLocationSearch('');
    setLocationStatus('Select');
    setLocationPage(1);
  };
  const chooseLocation = (item) => {
    setForm((value) => ({
      ...value,
      ...(locationLookup === 'organization'
        ? { organization: item.name }
        : locationLookup === 'country'
        ? { country: item.name, stateProvince: '', city: '' }
        : locationLookup === 'state'
          ? { stateProvince: item.name, city: '' }
          : { city: item.name })
    }));
    setLocationLookup(null);
  };
  const field = (label, key, required = false) => (
    <label>
      <span className="field-label">{label}{required && <span className="required"> *</span>}</span>
      <input readOnly={readOnly} required={required} value={form[key] || ''} onChange={update(key)} />
      {validation.errors[key] && <small className="field-error">{validation.errors[key]}</small>}
    </label>
  );
  const locationField = (label, key, type, required = false) => (
    <label className="lookup-field">
      <span className="field-label">{label}{required && <span className="required"> *</span>}</span>
      <div>
        <input readOnly required={required} value={form[key] || ''} placeholder="Search or select" />
        <button disabled={readOnly} type="button" aria-label={`Search ${label}`} onClick={() => openLocationLookup(type)}><Search size={12} /></button>
      </div>
      {validation.errors[key] && <small className="field-error">{validation.errors[key]}</small>}
    </label>
  );
  const submit = (event) => {
    event?.preventDefault();
    setError('');
    if (validation.validate()) setDialog({ type: 'confirm' });
  };
  const requestCancel = () => {
    if (readOnly || JSON.stringify(form) === JSON.stringify(originalForm)) return onCancel();
    setDialog({ type: 'discard' });
  };
  const confirmSave = () => {
    setDialog(null);
    companyMutation.mutate({ id: companyId, company: form });
  };

  return (
    <div className={`legacy-screen ${layout === 'four-4' ? 'detailed-create-screen' : ''} ${companyQuery.isLoading ? 'form-loading' : ''}`}>
      <TopNavigation />
      <header className="brand-bar"><strong>150CHF</strong><span>Company - {readOnly ? 'View' : companyId ? 'Edit' : 'Add'}</span><div className="user-meta">User: <b>APPADMIN</b>&nbsp;&nbsp; Party: <b>APPADMIN</b>&nbsp;&nbsp; Role: <b>APPADMIN</b></div></header>
      <div className="action-bar form-toolbar"><button aria-label="Back" onClick={requestCancel}>↶</button>{!readOnly && <button aria-label="Save" onClick={submit}>✓</button>}<button aria-label="Cancel" onClick={requestCancel}><X size={13} /></button><button className="toolbar-power" aria-label="Power" type="button"><Power size={13} /></button></div>
      <main className="company-form-page">
        <section className="summary-box"><div className="section-title"><ClipboardList size={13} /> Summary</div><div className="summary-grid"><span>Code</span><span>Name</span><span>Status</span></div><div className="summary-values"><b>{form.code || '—'}</b><b>{form.name || '—'}</b><b>{form.status}</b></div></section>
        <div className="details-tab">Main Details</div>
        <form className="company-form reference-company-form" onSubmit={submit}>
          <div className="reference-panels">
            <section className="reference-panel">
              <h2><Building2 size={13} /> Company Details</h2>
              {field('Code', 'code', true)}
              {field('Name', 'name', true)}
              {locationField('Organization', 'organization', 'organization', true)}
              {field('Registration Number', 'registrationNumber')}
              {field('Reporting Currency', 'reportingCurrency')}
              <label className="status-field"><span>Status <span className="required">*</span></span><select disabled={readOnly} value={form.status} onChange={update('status')}><option>Active</option><option>Inactive</option></select>{validation.errors.status && <small className="field-error">{validation.errors.status}</small>}</label>
            </section>
            <section className="reference-panel">
              <h2><MapPin size={13} /> Address Details</h2>
              {field('Address', 'address')}
              {locationField('Country', 'country', 'country')}
              {locationField('City', 'city', 'city')}
              {locationField('State/Province', 'stateProvince', 'state')}
              {field('Postal Code', 'postalCode')}
            </section>
          </div>
          {error && <div className="form-error">{error}</div>}
        </form>
      </main>
      {locationLookup && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLocationLookup(null); }}>
          <section className="currency-modal location-modal" role="dialog" aria-modal="true" aria-labelledby="location-dialog-title">
            <header><span id="location-dialog-title">Select {locationLookup === 'organization' ? 'Organization' : locationLookup === 'country' ? 'Country' : locationLookup === 'state' ? 'State/Province' : 'City'}</span><button type="button" aria-label="Close location lookup" onClick={() => setLocationLookup(null)}><X size={14} /></button></header>
            <div className="currency-search location-search">
              <div className="currency-search-fields">
                <label>Code<input value={locationCodeSearch} onChange={(event) => { setLocationCodeSearch(event.target.value); setLocationPage(1); }} /></label>
                <label>Name<input autoFocus value={locationSearch} onChange={(event) => { setLocationSearch(event.target.value); setLocationPage(1); }} /></label>
                <label>Status<select value={locationStatus} onChange={(event) => { setLocationStatus(event.target.value); setLocationPage(1); }}><option>Select</option><option>Active</option><option>Inactive</option></select></label>
              </div>
            </div>
            <table><thead><tr><th>Code</th><th>{locationLookup === 'organization' ? 'Organization' : locationLookup === 'country' ? 'Country' : locationLookup === 'state' ? 'State/Province' : 'City'}</th><th>Status</th></tr></thead>
              <tbody>
                {pagedLocationOptions.map((item) => <tr key={item.id} onClick={() => chooseLocation(item)}><td>{item.code || '—'}</td><td>{item.name}</td><td>{item.status || 'Active'}</td></tr>)}
                {!filteredLocationOptions.length && <tr><td className="empty" colSpan="3">No matching locations found</td></tr>}
              </tbody>
            </table>
            <footer>
              <em>Click a row to select</em>
              <div className="currency-pager">
                <button type="button" onClick={() => setLocationPage(1)} disabled={locationPage === 1}>|‹</button>
                <button type="button" onClick={() => setLocationPage((value) => Math.max(1, value - 1))} disabled={locationPage === 1}><ChevronLeft size={12} /></button>
                <b>{locationPage}</b><span>/ {locationTotalPages}</span>
                <button type="button" onClick={() => setLocationPage((value) => Math.min(locationTotalPages, value + 1))} disabled={locationPage === locationTotalPages}><ChevronRight size={12} /></button>
                <label>Lines per Page <select value={locationLinesPerPage} onChange={(event) => { setLocationLinesPerPage(Number(event.target.value)); setLocationPage(1); }}><option value="5">5</option><option value="7">7</option><option value="10">10</option></select></label>
              </div>
            </footer>
          </section>
        </div>
      )}
      {locationError && <div className="form-error">{locationError}</div>}
      {dialog && <CompanyDialog type={dialog.type} message={dialog.message} onCancel={() => setDialog(null)} onConfirm={confirmSave} onDiscard={() => { setForm(originalForm); setDialog(null); onCancel(); }} />}
    </div>
  );
}

export { CompanyForm };
