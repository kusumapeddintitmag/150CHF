import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ClipboardList, Power, Search, X } from 'lucide-react';
import {
  emptyCompany,
  createProvinceState,
  saveProvinceState,
  getProvinceState,
  getCountries,
  getStates,
  useCompanyValidation
} from './provinceStateService';
import { ProvinceStateDialog, TopNavigation } from './ProvinceStateShared';

const lookupConfig = {
  country: { title: 'Country', placeholder: 'Type 3+ characters to search Country...' },
  provinceType: { title: 'Province Type', placeholder: 'Type 3+ characters to search Province Type...' }
};

function ProvinceStateForm({ onCancel, onCreated, companyId, initialCompany, readOnly = false }) {
  const toProvinceState = (value) => ({
    ...emptyCompany,
    ...value,
    code: value?.code || value?.companyCode || '',
    country: value?.country || value?.organizationCode || '',
    provinceType: value?.provinceType || value?.branchCode || '',
    sortOrder: value?.sortOrder || value?.department || ''
  });
  const [form, setForm] = useState(() => toProvinceState(initialCompany));
  const [originalForm, setOriginalForm] = useState(() => toProvinceState(initialCompany));
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookupFilters, setLookupFilters] = useState({ code: '', name: '', status: 'Select' });
  const [lookupPage, setLookupPage] = useState(1);
  const [lookupLinesPerPage, setLookupLinesPerPage] = useState(5);
  const validation = useCompanyValidation(form);
  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getProvinceState(companyId),
    enabled: Boolean(companyId) && !initialCompany,
    refetchOnWindowFocus: false
  });
  const lookups = {
    country: useQuery({ queryKey: ['countries'], queryFn: getCountries, refetchOnWindowFocus: false }),
    provinceType: useQuery({ queryKey: ['province-types'], queryFn: async () => [], refetchOnWindowFocus: false })
  };
  const companyMutation = useMutation({
    mutationFn: ({ id, company }) => {
      const payload = {
        country: company.country,
        code: company.code,
        name: company.name,
        provinceType: company.provinceType,
        sortOrder: company.sortOrder || 0,
        status: company.status
      };
      return id ? saveProvinceState(id, payload) : createProvinceState(payload);
    },
    onSuccess: onCreated,
    onError: (requestError) => {
      setError(requestError.message);
      setDialog({ type: 'error', message: requestError.message });
    }
  });

  useEffect(() => {
    if (companyQuery.data) {
      const loaded = toProvinceState(companyQuery.data);
      setForm(loaded);
      setOriginalForm(loaded);
    }
    if (companyQuery.error) {
      setError(companyQuery.error.message);
      setDialog({ type: 'error', message: companyQuery.error.message });
    }
  }, [companyQuery.data, companyQuery.error]);

  const update = (field) => (event) => setForm((value) => ({ ...value, [field]: event.target.value }));
  const chooseLookup = (item) => {
    const field = lookup;
    setForm((value) => ({ ...value, [field]: item.code || item.name }));
    setLookup(null);
  };
  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!validation.validate()) return;
    if (form.code) {
      try {
        const states = await getStates(form.country);
        const belongsToCountry = states.some((state) =>
          String(state.code || '').toLowerCase() === String(form.code).trim().toLowerCase()
          || String(state.name || '').toLowerCase() === String(form.name).trim().toLowerCase()
        );
        if (!belongsToCountry) {
          const message = `${form.name} (${form.code}) does not belong to the selected country.`;
          setError(message);
          setDialog({ type: 'error', message });
          return;
        }
      } catch (requestError) {
        setError(requestError.message);
        setDialog({ type: 'error', message: requestError.message });
        return;
      }
    }
    setDialog({ type: 'confirm' });
  };
  const requestCancel = () => {
    if (readOnly || JSON.stringify(form) === JSON.stringify(originalForm)) return onCancel();
    setDialog({ type: 'discard' });
  };

  const allLookupItems = lookup ? (lookups[lookup].data || []).filter((item) => {
    const codeMatches = String(item.code || '').toLowerCase().includes(lookupFilters.code.toLowerCase());
    const nameMatches = String(item.name || '').toLowerCase().includes(lookupFilters.name.toLowerCase());
    const statusMatches = lookupFilters.status === 'Select' || item.status === lookupFilters.status;
    return codeMatches && nameMatches && statusMatches;
  }) : [];
  const lookupTotalPages = Math.max(1, Math.ceil(allLookupItems.length / lookupLinesPerPage));
  const lookupItems = allLookupItems.slice((lookupPage - 1) * lookupLinesPerPage, lookupPage * lookupLinesPerPage);
  const updateLookupFilter = (key, value) => {
    setLookupFilters((current) => ({ ...current, [key]: value }));
    setLookupPage(1);
  };
  const field = (label, key, required = false) => (
    <label>
      <span className="field-label">{label}{required && <span className="required"> *</span>}</span>
      <input readOnly={readOnly} required={required} value={form[key] || ''} onChange={update(key)} />
      {validation.errors[key] && <small className="field-error">{validation.errors[key]}</small>}
    </label>
  );
  const lookupField = (type, key, required = false) => (
    <label className="lookup-field">
      <span className="field-label">{lookupConfig[type].title}{required && <span className="required"> *</span>}</span>
      <div>
        <input readOnly value={form[key] || ''} placeholder={lookupConfig[type].placeholder} />
        <button disabled={readOnly} type="button" aria-label={`Search ${lookupConfig[type].title}`} onClick={() => { setLookup(type); setLookupFilters({ code: '', name: '', status: 'Select' }); setLookupPage(1); }}>
          <Search size={12} />
        </button>
      </div>
      {validation.errors[key] && <small className="field-error">{validation.errors[key]}</small>}
    </label>
  );

  return (
    <div className={`legacy-screen detailed-create-screen ${companyQuery.isLoading ? 'form-loading' : ''}`}>
      <TopNavigation />
      <header className="brand-bar"><strong>150CHF</strong><span>New Province / State - {readOnly ? 'View' : companyId ? 'Edit' : 'Add'}</span><div className="user-meta">User: <b>APPADMIN</b>&nbsp;&nbsp; Party: <b>APPADMIN</b>&nbsp;&nbsp; Role: <b>APPADMIN</b></div></header>
      <div className="action-bar form-toolbar"><button aria-label="Back" onClick={requestCancel}>↶</button>{!readOnly && <button aria-label="Save" onClick={submit}>✓</button>}<button aria-label="Cancel" onClick={requestCancel}><X size={13} /></button><button className="toolbar-power" aria-label="Power" type="button"><Power size={13} /></button></div>
      <main className="company-form-page">
        <section className="summary-box"><div className="section-title"><ClipboardList size={13} /> Summary</div><div className="summary-grid"><span>Code</span><span>Name</span><span>Status</span></div><div className="summary-values"><b>{form.code || '—'}</b><b>{form.name || '—'}</b><b>{form.status}</b></div></section>
        <div className="details-tab">Main Details</div>
        <form className="company-form reference-company-form" onSubmit={submit}>
          <section className="reference-panel">
            {field('Name', 'name', true)}
            {field('Code', 'code')}
            {lookupField('country', 'country', true)}
            {lookupField('provinceType', 'provinceType')}
            {field('Sort Order', 'sortOrder')}
            <label className="status-field"><span>Status <span className="required">*</span></span><select disabled={readOnly} value={form.status} onChange={update('status')}><option>Active</option><option>Inactive</option></select>{validation.errors.status && <small className="field-error">{validation.errors.status}</small>}</label>
          </section>
          {error && <div className="form-error">{error}</div>}
        </form>
      </main>
      {lookup && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLookup(null); }}>
          <section className="currency-modal location-modal" role="dialog" aria-modal="true" aria-labelledby="lookup-dialog-title">
            <header><span id="lookup-dialog-title">{lookupConfig[lookup].title}</span><button type="button" aria-label={`Close ${lookupConfig[lookup].title} lookup`} onClick={() => setLookup(null)}><X size={14} /></button></header>
            <div className="currency-search location-search">
              <div className="currency-search-fields lookup-search-fields">
                <label>Code<input autoFocus value={lookupFilters.code} onChange={(event) => updateLookupFilter('code', event.target.value)} /></label>
                <label>Name<input value={lookupFilters.name} onChange={(event) => updateLookupFilter('name', event.target.value)} /></label>
                <label>Status<select value={lookupFilters.status} onChange={(event) => updateLookupFilter('status', event.target.value)}><option>Select</option><option>Active</option><option>Inactive</option></select></label>
              </div>
            </div>
            <table><thead><tr><th>Code</th><th>Name</th><th>Status</th></tr></thead><tbody>
              {lookups[lookup].isLoading && <tr><td className="empty" colSpan="3">Loading...</td></tr>}
              {lookups[lookup].isError && <tr><td className="empty error" colSpan="3">{lookups[lookup].error.message}</td></tr>}
              {!lookups[lookup].isLoading && !lookups[lookup].isError && lookupItems.map((item) => <tr key={item.id} onClick={() => chooseLookup(item)}><td>{item.code || '—'}</td><td>{item.name}</td><td>{item.status}</td></tr>)}
              {!lookups[lookup].isLoading && !lookups[lookup].isError && !allLookupItems.length && <tr><td className="empty" colSpan="3">No matching records found</td></tr>}
            </tbody></table>
            <footer>
              <em>Click a row to select</em>
              <div className="currency-pager">
                <button type="button" onClick={() => setLookupPage(1)} disabled={lookupPage === 1}>|‹</button>
                <button type="button" onClick={() => setLookupPage((page) => Math.max(1, page - 1))} disabled={lookupPage === 1}><ChevronLeft size={12} /></button>
                <b>{lookupPage}</b><span>/ {lookupTotalPages}</span>
                <button type="button" onClick={() => setLookupPage((page) => Math.min(lookupTotalPages, page + 1))} disabled={lookupPage === lookupTotalPages}><ChevronRight size={12} /></button>
                <label>Lines per Page <select value={lookupLinesPerPage} onChange={(event) => { setLookupLinesPerPage(Number(event.target.value)); setLookupPage(1); }}><option value="5">5</option><option value="7">7</option></select></label>
              </div>
            </footer>
          </section>
        </div>
      )}
      {dialog && <ProvinceStateDialog type={dialog.type} message={dialog.message} onCancel={() => setDialog(null)} onConfirm={() => { setDialog(null); companyMutation.mutate({ id: companyId, company: form }); }} onDiscard={() => { setForm(originalForm); setDialog(null); onCancel(); }} />}
    </div>
  );
}

export { ProvinceStateForm };
