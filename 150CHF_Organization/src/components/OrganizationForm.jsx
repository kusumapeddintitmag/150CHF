import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, ClipboardList, MapPin, Phone, Power, Search, X } from 'lucide-react';
import { City, Country, State } from 'country-state-city';
import { emptyOrganization, readApiResponse, createOrganization, saveOrganization, getOrganization, useOrganizationValidation, getCountries, getStates, getCities } from './organizationService';
import { OrganizationDialog, TopNavigation } from './OrganizationShared';
function OrganizationForm({ onCancel, onCreated, layout, organizationId, initialOrganization, formMode, readOnly = false }) {
  const [form, setForm] = useState({ ...emptyOrganization, ...initialOrganization });
  const [originalForm, setOriginalForm] = useState({ ...emptyOrganization, ...initialOrganization });
  const [error, setError] = useState('');
  const [currencyLookup, setCurrencyLookup] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyCodeSearch, setCurrencyCodeSearch] = useState('');
  const [currencyNameSearch, setCurrencyNameSearch] = useState('');
  const [currencyStatus, setCurrencyStatus] = useState('Select');
  const [currencies, setCurrencies] = useState([]);
  const [currencyPage, setCurrencyPage] = useState(1);
  const [currencyPageSize, setCurrencyPageSize] = useState(5);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [locationLookup, setLocationLookup] = useState(null);
  const [locationCodeSearch, setLocationCodeSearch] = useState('');
  const [locationNameSearch, setLocationNameSearch] = useState('');
  const [locationStatus, setLocationStatus] = useState('Select');
  const [locationPage, setLocationPage] = useState(1);
  const [locationPageSize, setLocationPageSize] = useState(5);
  const [locationError, setLocationError] = useState('');
  const [dialog, setDialog] = useState(null);
  const validation = useOrganizationValidation(form);
  const selectedCountry = countries.find((country) => country.name === form.country);
  const selectedState = states.find((state) => state.name === form.state);
  const organizationQuery = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () => getOrganization(organizationId),
    enabled: Boolean(organizationId),
    refetchOnWindowFocus: false
  });
  const organizationMutation = useMutation({
    mutationFn: ({ id, organization }) => id ? saveOrganization(id, organization) : createOrganization(organization),
    onSuccess: onCreated,
    onError: (requestError) => {
      setError(requestError.message);
      setDialog({ type: 'error', message: requestError.message });
    }
  });
  useEffect(() => {
    if (organizationQuery.data) {
      const loadedOrganization = { ...emptyOrganization, ...organizationQuery.data };
      setForm(loadedOrganization);
      setOriginalForm(loadedOrganization);
    }
    if (organizationQuery.error) {
      setError(organizationQuery.error.message);
      setDialog({ type: 'error', message: organizationQuery.error.message });
    }
  }, [organizationQuery.data, organizationQuery.error]);
  useEffect(() => {
    getCountries().then(setCountries).catch((requestError) => setLocationError(requestError.message));
  }, []);
  useEffect(() => {
    if (!selectedCountry?.id) {
      setStates([]);
      return;
    }
    getStates(selectedCountry.code).then(setStates).catch((requestError) => setLocationError(requestError.message));
  }, [selectedCountry?.id]);
  useEffect(() => {
    if (!selectedCountry?.code || !selectedState?.code) {
      setCities([]);
      return;
    }
    getCities(selectedCountry.code, selectedState.code).then(setCities).catch((requestError) => setLocationError(requestError.message));
  }, [selectedCountry?.code, selectedState?.code]);
  const update = (field) => (event) => setForm((value) => ({
    ...value,
    [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
  }));
  const updatePhone = (event) => setForm((value) => ({
    ...value,
    phone: event.target.value.replace(/\D/g, '').slice(0, 10)
  }));
  const updateCountry = (event) => setForm((value) => ({ ...value, country: event.target.value, state: '', city: '' }));
  const updateState = (event) => setForm((value) => ({ ...value, state: event.target.value, city: '' }));
  const openLocationLookup = (type) => {
    setLocationLookup(type);
    setLocationCodeSearch('');
    setLocationNameSearch('');
    setLocationStatus('Select');
    setLocationPage(1);
    setLocationPageSize(5);
  };
  const chooseLocation = (item) => {
    if (locationLookup === 'country') updateCountry({ target: { value: item.name } });
    if (locationLookup === 'state') updateState({ target: { value: item.name } });
    if (locationLookup === 'city') setForm((value) => ({ ...value, city: item.name }));
    setLocationLookup(null);
  };
  const locationOptions = (type) => type === 'country' ? countries : type === 'state' ? states : cities;
  const filteredLocationOptions = locationLookup
    ? [...locationOptions(locationLookup)]
      .filter((item) =>
        (item.code || '').toLowerCase().includes(locationCodeSearch.toLowerCase()) &&
        item.name.toLowerCase().includes(locationNameSearch.toLowerCase()) &&
        (locationStatus === 'Select' || item.status === locationStatus)
      )
      .sort((first, second) => first.name.localeCompare(second.name))
    : [];
  const locationTotalPages = Math.max(1, Math.ceil(filteredLocationOptions.length / locationPageSize));
  const visibleLocationOptions = filteredLocationOptions.slice(
    (locationPage - 1) * locationPageSize,
    locationPage * locationPageSize
  );
  const locationTitle = locationLookup ? locationLookup.charAt(0).toUpperCase() + locationLookup.slice(1) : '';
  const focusLookup = (event) => event.currentTarget.previousElementSibling?.focus();
  const lookupField = (label, key, placeholder) => (
    <label className="lookup-field"><span>{label}</span><div><input readOnly placeholder={placeholder} value={form[key] || ''} onChange={update(key)} /><button disabled={readOnly} type="button" aria-label={`Search ${label}`} onClick={focusLookup}><Search size={12} /></button></div></label>
  );
  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!validation.validate()) {
      return;
    }
    setDialog({ type: 'confirm' });
  };
  const requestCancel = () => {
    if (readOnly || JSON.stringify(form) === JSON.stringify(originalForm)) {
      onCancel();
      return;
    }
    setDialog({ type: 'discard' });
  };
  const discardChanges = () => {
    setForm(originalForm);
    setDialog(null);
    onCancel();
  };
  const confirmSave = () => {
    setDialog(null);
    organizationMutation.mutate({ id: organizationId, organization: form });
  };
  const uploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((value) => ({ ...value, imageDataUrl: String(reader.result) }));
    reader.onerror = () => setError('Unable to read the selected image.');
    reader.readAsDataURL(file);
  };
  const openCurrencyLookup = async () => {
    setCurrencyLookup(true);
    setCurrencyPage(1);
    if (currencies.length) return;
    try {
      const response = await fetch('/api/currencies');
      const result = await readApiResponse(response, 'Unable to load currencies');
      setCurrencies(result);
    } catch (requestError) {
      setCurrencyLookup(false);
      setError(requestError.message);
      setDialog({ type: 'error', message: requestError.message });
    }
  };
  const field = (label, key, required = false, type = 'text') => (
    <label><span className="field-label">{label}{required && <span className="required"> *</span>}</span><input readOnly={readOnly} required={required} type={type} value={form[key] || ''} onChange={update(key)} />{validation.errors[key] && <small className="field-error">{validation.errors[key]}</small>}</label>
  );
  const filteredCurrencies = currencies.filter((currency) =>
    currency.code.toLowerCase().includes(currencyCodeSearch.toLowerCase()) &&
    currency.name.toLowerCase().includes(currencyNameSearch.toLowerCase()) &&
    (currencyStatus === 'Select' || currency.status === currencyStatus) &&
    `${currency.code} ${currency.name}`.toLowerCase().includes(currencySearch.toLowerCase())
  );
  const currencyTotalPages = Math.max(1, Math.ceil(filteredCurrencies.length / currencyPageSize));
  const visibleCurrencies = filteredCurrencies.slice((currencyPage - 1) * currencyPageSize, currencyPage * currencyPageSize);

  return (
    <div className={`legacy-screen ${layout === 'four-4' ? 'detailed-create-screen' : ''} ${organizationQuery.isLoading ? 'form-loading' : ''}`}>
      <><TopNavigation /><header className="brand-bar"><strong>150CHF</strong><span>Organization - {readOnly ? 'View' : organizationId ? 'Edit' : 'Add'}</span><div className="user-meta">User: <b>APPADMIN</b>&nbsp;&nbsp; Party: <b>APPADMIN</b>&nbsp;&nbsp; Role: <b>APPADMIN</b></div></header><div className="action-bar form-toolbar"><button aria-label="Back" onClick={requestCancel}>↶</button>{!readOnly && <button aria-label="Save" onClick={submit}>✓</button>}<button aria-label="Cancel" onClick={requestCancel}><X size={13} /></button><button className="toolbar-power" aria-label="Power" type="button"><Power size={13} /></button></div></>
      <main className="organization-form-page">
        <section className="summary-box"><div className="section-title"><ClipboardList size={13} /> Summary</div><div className="summary-grid"><span>Code</span><span>Name</span><span>Status</span></div><div className="summary-values"><b>{form.code || '—'}</b><b>{form.name || '—'}</b><b>{form.status}</b></div><div className="summary-country"><span>Country</span><b>{form.country || '—'}</b></div></section><div className="details-tab">Main Details</div>
        <form className="organization-form reference-organization-form" onSubmit={submit}>
          <div className="reference-panels">
            <section className="reference-panel">
              <h2><Building2 size={13} /> Organization Details</h2>
              {field('Organization Code', 'code', true)}
              {field('Organization Name', 'name', true)}
              <label className="lookup-field">Reporting Currency<div><input readOnly placeholder="Search or select" value={form.reportingCurrency || ''} onChange={update('reportingCurrency')} /><button disabled={readOnly} type="button" aria-label="Search currencies" onClick={openCurrencyLookup}><Search size={12} /></button></div></label>
              {lookupField('Industry', 'industry', 'Search or select')}
              {lookupField('Organization Type', 'orgType', 'Search or select')}
              <label className="checkbox-field"><span>License Organization</span><div><input disabled={readOnly} type="checkbox" checked={form.licenseOrganization} onChange={update('licenseOrganization')} /><small>Yes</small></div></label>
              <label className="status-field"><span>Status <span className="required">*</span></span><select disabled={readOnly} value={form.status} onChange={update('status')}><option>Active</option><option>Inactive</option></select>{validation.errors.status && <small className="field-error">{validation.errors.status}</small>}</label>
            </section>
            <section className="reference-panel">
              <h2><MapPin size={13} /> Address Details</h2>
              {field('Registered Address', 'registeredAddress', true)}
              <label className="lookup-field"><span>Country <span className="required">*</span></span><div><input readOnly disabled={readOnly} placeholder="Search or select" value={form.country || ''} onChange={updateCountry} /><button disabled={readOnly} type="button" aria-label="Search country" onClick={() => openLocationLookup('country')}><Search size={12} /></button></div>{validation.errors.country && <small className="field-error">{validation.errors.country}</small>}</label>
              <label className="lookup-field">State/Province<div><input readOnly disabled={readOnly || !selectedCountry || !states.length} placeholder="Search or select" value={form.state || ''} onChange={updateState} /><button disabled={readOnly || !states.length} type="button" aria-label="Search state" onClick={() => openLocationLookup('state')}><Search size={12} /></button></div></label>
              <label className="lookup-field">City<div><input readOnly disabled={readOnly || !selectedState || !cities.length} placeholder="Search or select" value={form.city || ''} onChange={update('city')} /><button disabled={readOnly || !cities.length} type="button" aria-label="Search city" onClick={() => openLocationLookup('city')}><Search size={12} /></button></div></label>
              {field('Pincode', 'pincode')}
            </section>
            <section className="reference-panel">
              <h2><Phone size={13} /> Registration &amp; Contact Details</h2>
              {field('Registration Number', 'registrationNumber', true)}
              {field('Date of Incorporation', 'dateOfIncorporation', false, 'date')}
              {field('Tax ID', 'taxId')}
              <label><span className="field-label">Phone number<span className="required"> *</span></span><input readOnly={readOnly} required type="tel" inputMode="numeric" maxLength="10" value={form.phone || ''} onChange={updatePhone} />{validation.errors.phone && <small className="field-error">{validation.errors.phone}</small>}</label>
              {field('Email', 'email', true, 'email')}
              {field('Website', 'website', false, 'url')}
              <label className="upload-field"><span>Image Upload <span className="required">*</span></span><input disabled={readOnly} type="file" accept="image/*" onChange={uploadImage} />{validation.errors.imageDataUrl && <small className="field-error">{validation.errors.imageDataUrl}</small>}</label>
              {form.imageDataUrl && <img className="organization-image-preview" src={form.imageDataUrl} alt="Organization preview" />}
              <em className="upload-note">Image preview only. Server upload requires an API.</em>
            </section>
          </div>
        {error && <div className="form-error">{error}</div>}
        {locationError && <div className="form-error">{locationError}</div>}
        </form>
        {locationLookup && <div className="modal-backdrop"><section className="currency-modal location-modal"><header>{locationTitle}<button type="button" aria-label={`Close ${locationTitle} lookup`} onClick={() => setLocationLookup(null)}><X size={14} /></button></header><div className="currency-search location-search"><div className="currency-search-fields"><label>Code<input value={locationCodeSearch} onChange={(event) => { setLocationCodeSearch(event.target.value); setLocationPage(1); }} /></label><label>Name<input value={locationNameSearch} onChange={(event) => { setLocationNameSearch(event.target.value); setLocationPage(1); }} /></label><label>Status<select value={locationStatus} onChange={(event) => { setLocationStatus(event.target.value); setLocationPage(1); }}><option>Select</option><option>Active</option><option>Inactive</option></select></label></div></div><table><thead><tr><th>Code</th><th>{locationTitle} Name</th><th>Status</th></tr></thead><tbody>{visibleLocationOptions.map((item) => <tr key={item.id} onClick={() => chooseLocation(item)}><td>{item.code || '—'}</td><td>{item.name}</td><td>{item.status}</td></tr>)}{!visibleLocationOptions.length && <tr><td className="empty" colSpan="3">No matching {locationTitle.toLowerCase()}s found</td></tr>}</tbody></table><footer><em>♧ Click a row to select</em><div className="currency-pager"><button type="button" disabled={locationPage === 1} onClick={() => setLocationPage(1)}>|‹</button><button type="button" disabled={locationPage === 1} onClick={() => setLocationPage((value) => value - 1)}>‹</button><b>{locationPage}</b><span>/ {locationTotalPages}</span><button type="button" disabled={locationPage === locationTotalPages} onClick={() => setLocationPage((value) => value + 1)}>›</button><span>Lines per Page</span><select aria-label={`${locationTitle} lines per page`} value={locationPageSize} onChange={(event) => { setLocationPageSize(Number(event.target.value)); setLocationPage(1); }}><option value="5">5</option><option value="7">7</option></select></div></footer></section></div>}
        {currencyLookup && <div className="modal-backdrop"><section className="currency-modal"><header>Currency<button onClick={() => setCurrencyLookup(false)}><X size={14} /></button></header><div className="currency-search"><div className="currency-search-fields"><label>Code<input value={currencyCodeSearch} onChange={(event) => { setCurrencyCodeSearch(event.target.value); setCurrencyPage(1); }} /></label><label>Name<input value={currencyNameSearch} onChange={(event) => { setCurrencyNameSearch(event.target.value); setCurrencyPage(1); }} /></label><label>Status<select value={currencyStatus} onChange={(event) => { setCurrencyStatus(event.target.value); setCurrencyPage(1); }}><option>Select</option><option>Active</option><option>Inactive</option></select></label></div></div><table><thead><tr><th>Code</th><th>Currency Name</th><th>Status</th></tr></thead><tbody>{visibleCurrencies.map((currency) => <tr key={currency.id} onClick={() => { setForm((value) => ({ ...value, reportingCurrency: currency.code })); setCurrencyLookup(false); }}><td>{currency.code}</td><td>{currency.name}</td><td>{currency.status}</td></tr>)}</tbody></table><footer><em>♧ Click a row to select</em><div className="currency-pager"><button disabled={currencyPage === 1} onClick={() => setCurrencyPage(1)}>|‹</button><button disabled={currencyPage === 1} onClick={() => setCurrencyPage((value) => value - 1)}>‹</button><b>{currencyPage}</b><span>/ {currencyTotalPages}</span><button disabled={currencyPage === currencyTotalPages} onClick={() => setCurrencyPage((value) => value + 1)}>›</button><span>Lines per Page</span><select aria-label="Currency lines per page" value={currencyPageSize} onChange={(event) => { setCurrencyPageSize(Number(event.target.value)); setCurrencyPage(1); }}><option value="5">5</option><option value="7">7</option></select></div></footer></section></div>}
        {dialog && <OrganizationDialog type={dialog.type} message={dialog.message} onCancel={() => setDialog(null)} onConfirm={confirmSave} onDiscard={discardChanges} />}
      </main>
    </div>
  );
}

export { OrganizationForm };
