import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, Copy, Download, Eye, FilePlus2, Pencil, Power, Search, Trash2, X } from 'lucide-react';
import { emptySearch, getCompanies, getOrganizations, saveCompany, deleteCompany, readApiResponse } from './components/sectionService';
import { SectionForm } from './components/SectionForm';
import { TopNavigation } from './components/SectionShared';
export default function App() {
  const [organizationCode, setOrganizationCode] = useState('');
  const [name, setName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('Select');
  const [applied, setApplied] = useState(emptySearch);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formCompanyId, setFormCompanyId] = useState(null);
  const [formInitialCompany, setFormInitialCompany] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sort, setSort] = useState({ key: 'code', direction: 'asc' });
  const [organizationLookupOpen, setOrganizationLookupOpen] = useState(false);
  const [organizationLookupSearch, setOrganizationLookupSearch] = useState('');
  const organizationsQuery = useQuery({
    queryKey: ['organizations'],
    queryFn: getOrganizations,
    enabled: organizationLookupOpen,
    refetchOnWindowFocus: false
  });

  const companiesQuery = useQuery({
    queryKey: ['companies', applied, page, perPage],
    queryFn: getCompanies,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000)
  });
  const result = companiesQuery.data || { rows: [], total: 0, totalPages: 1 };
  const sortedCompanies = [...result.rows].sort((first, second) => {
    const comparison = String(first[sort.key] || '').localeCompare(String(second[sort.key] || ''), undefined, { sensitivity: 'base' });
    return sort.direction === 'asc' ? comparison : -comparison;
  });
  const companyStatusMutation = useMutation({
    mutationFn: (company) => saveCompany(company.id, {
      organizationCode: company.organizationCode || company.organization || '',
      companyCode: company.companyCode || company.code || '',
      branchCode: company.branchCode || '',
      department: company.department || 'General',
      name: company.name || '',
      status: 'Inactive'
    }),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setSelected([]);
      companiesQuery.refetch();
    },
    onError: (requestError) => window.alert(requestError.message)
  });
  const companyDeleteMutation = useMutation({
    mutationFn: (companyId) => deleteCompany(companyId),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setSelected([]);
      companiesQuery.refetch();
    },
    onError: (requestError) => window.alert(requestError.message)
  });

  const updateFilter = (key, value) => {
    setApplied((current) => ({ ...current, [key]: key === 'status' ? value : value.trim() }));
    if (key === 'organizationCode') setOrganizationCode(value);
    if (key === 'name') setName(value);
    if (key === 'companyCode') setCompanyCode(value);
    if (key === 'branchCode') setBranchCode(value);
    if (key === 'department') setDepartment(value);
    if (key === 'status') setStatus(value);
    setPage(1);
  };

  const reset = () => {
    setOrganizationCode('');
    setName('');
    setCompanyCode('');
    setBranchCode('');
    setDepartment('');
    setStatus('Select');
    setApplied(emptySearch);
    setPage(1);
    setSelected([]);
  };

  const selectRow = (company) => {
    setSelected((current) => current.some((item) => item.id === company.id) ? [] : [company]);
  };
  const openNewCompany = () => openForm('create');
  const openForm = (mode, company = null) => {
    setFormMode(mode);
    setFormCompanyId(mode === 'create' || mode === 'copy' ? null : company?.id || null);
    setFormInitialCompany(company);
    setShowForm(true);
  };
  const deleteSelected = () => {
    if (!selected.length) return;
    setDeleteDialogOpen(true);
  };
  const markSelectedInactive = () => {
    if (selected[0]) companyStatusMutation.mutate(selected[0]);
  };
  const removeSelected = () => {
    if (selected[0]) companyDeleteMutation.mutate(selected[0].id);
  };
  const downloadCompanies = async () => {
    try {
      const response = await fetch('/api/companies?page=1&linesPerPage=10000');
      const exportResult = await readApiResponse(response, 'Unable to export companies');
      const escape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const rows = selected.length ? selected : exportResult.rows;
      const table = `<tr><th>Organization Code</th><th>Name</th><th>Company Code</th><th>Branch Code</th><th>Department</th><th>Status</th></tr>${rows.map((row) => `<tr><td>${escape(row.organizationCode)}</td><td>${escape(row.name)}</td><td>${escape(row.companyCode)}</td><td>${escape(row.branchCode)}</td><td>${escape(row.department)}</td><td>${escape(row.status)}</td></tr>`).join('')}`;
      const blob = new Blob([`<html><head><meta charset="UTF-8"></head><body><table>${table}</table></body></html>`], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'section-2.xls';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error.message);
    }
  };

  if (showForm) {
    return <SectionForm
      layout="four-4"
      companyId={formCompanyId}
      initialCompany={formInitialCompany}
      formMode={formMode}
      readOnly={formMode === 'view'}
      onCancel={() => setShowForm(false)}
      onCreated={() => {
        setShowForm(false);
        companiesQuery.refetch();
        setSelected([]);
      }}
    />;
  }

  return (
    <div className="legacy-screen">
      <TopNavigation />

      <header className="brand-bar">
        <strong>150CHF</strong>
        <span>Section</span>
        <div className="user-meta">User: <b>APPADMIN</b>&nbsp;&nbsp; Party: <b>APPADMIN</b>&nbsp;&nbsp; Role: <b>APPADMIN</b></div>
      </header>

      <div className="action-bar">
        <button aria-label="Search" title="Search companies" onClick={() => document.querySelector('.search-fields input')?.focus()}><Search size={14} /></button>
        <button aria-label="Back" onClick={reset}>↶</button>
        <button aria-label="Download Section" title="Download Section" onClick={downloadCompanies}><Download size={13} /></button>
        {!selected.length && <button aria-label="New company" title="Add company" onClick={openNewCompany}><FilePlus2 size={13} /></button>}
        {selected.length > 0 && (
          <>
            <button aria-label="View company" title="View company" onClick={() => openForm('view', selected[0])}><Eye size={13} /></button>
            <button aria-label="Edit company" title="Edit company" onClick={() => openForm('edit', selected[0])}><Pencil size={13} /></button>
            <button aria-label="Copy company" title="Copy company" type="button"><Copy size={13} /></button>
            <button aria-label="Delete company" title="Delete company" onClick={deleteSelected}><Trash2 size={13} /></button>
          </>
        )}
        <button className="toolbar-power" aria-label="Power" type="button"><Power size={13} /></button>
      </div>
      <main>
        <section className="summary-box">
          <div className="section-title"><ClipboardList size={13} /> Summary</div>
          <div className="summary-grid"><span>Organization Code</span><span>Name</span><span>Company Code</span><span>Branch Code</span><span>Department</span><span>Status</span></div>
          {selected.map((company) => <div className="summary-values summary-values-six" key={company.id}><b>{company.organizationCode}</b><b>{company.name}</b><b>{company.companyCode}</b><b>{company.branchCode}</b><b>{company.department}</b><b>{company.status}</b></div>)}
        </section>

        <section className="search-box">
          <div className="search-fields">
            <label>Organization Code<input value={organizationCode} onChange={(event) => updateFilter('organizationCode', event.target.value)} /></label>
            <label>Name<input value={name} onChange={(event) => updateFilter('name', event.target.value)} /></label>
            <label>Company Code<input value={companyCode} onChange={(event) => updateFilter('companyCode', event.target.value)} /></label>
            <label>Branch Code<input value={branchCode} onChange={(event) => updateFilter('branchCode', event.target.value)} /></label>
            <label>Department<input value={department} onChange={(event) => updateFilter('department', event.target.value)} /></label>
            <label>Status<select value={status} onChange={(event) => updateFilter('status', event.target.value)}><option>Select</option><option>Active</option><option>Inactive</option></select></label>
          </div>
        </section>

        <section className="table-box">
          <table>
            <thead><tr>{[['organizationCode', 'Organization Code'], ['name', 'Name'], ['companyCode', 'Company Code'], ['branchCode', 'Branch Code'], ['department', 'Department'], ['status', 'Status']].map(([key, label]) => <th key={key} aria-sort={sort.key === key ? `${sort.direction}ending` : 'none'}><button className="sort-header" type="button" onClick={() => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))}>{label}<i>{sort.key === key && sort.direction === 'desc' ? '▼' : '▲'}</i></button></th>)}</tr></thead>
            <tbody>
              {companiesQuery.isLoading && <tr><td className="empty" colSpan="6">Loading Section 2...</td></tr>}
              {companiesQuery.isError && <tr><td className="empty error" colSpan="6">{companiesQuery.error.message}</td></tr>}
              {!companiesQuery.isLoading && !companiesQuery.isError && sortedCompanies.map((company) => (
                <tr
                  key={company.id}
                  onClick={() => selectRow(company)}
                  className={selected.some((item) => item.id === company.id) ? 'selected-row' : ''}
                >
                  <td>{company.organizationCode}</td><td>{company.name}</td><td>{company.companyCode}</td><td>{company.branchCode}</td><td>{company.department}</td><td>{company.status}</td>
                </tr>
              ))}
              {!companiesQuery.isLoading && !companiesQuery.isError && !result.rows.length && <tr><td className="empty" colSpan="6">No matching Section 2 records found</td></tr>}
            </tbody>
          </table>
          <footer className="table-footer">
            <em>♧ Click a row to select</em>
            <div className="pager">
              <button onClick={() => setPage(1)} disabled={page === 1}>|‹</button>
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}><ChevronLeft size={12} /></button>
              <b>{page}</b><span>/ {result.totalPages}</span>
              <button onClick={() => setPage((value) => Math.min(result.totalPages, value + 1))} disabled={page === result.totalPages}><ChevronRight size={12} /></button>
              <span className="divider">|</span>
              <label>Lines per Page <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label>
            </div>
          </footer>
        </section>
      </main>
      {organizationLookupOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOrganizationLookupOpen(false); }}>
          <section className="currency-modal location-modal organization-modal" role="dialog" aria-modal="true" aria-labelledby="organization-dialog-title">
            <header><span id="organization-dialog-title">Select Organization</span><button type="button" aria-label="Close organization lookup" onClick={() => setOrganizationLookupOpen(false)}><X size={14} /></button></header>
            <div className="currency-search location-search"><div className="currency-search-fields organization-search-fields"><label>Name<input autoFocus value={organizationLookupSearch} onChange={(event) => setOrganizationLookupSearch(event.target.value)} /></label></div></div>
            <table><thead><tr><th>Code</th><th>Organization</th><th>Status</th></tr></thead><tbody>
              {(organizationsQuery.data || []).filter((item) => `${item.code || ''} ${item.name || ''}`.toLowerCase().includes(organizationLookupSearch.toLowerCase())).map((item) => <tr key={item.id} onClick={() => { updateFilter('organizationCode', item.code || ''); setOrganizationLookupOpen(false); }}><td>{item.code || '—'}</td><td>{item.name}</td><td>{item.status}</td></tr>)}
              {organizationsQuery.isLoading && <tr><td className="empty" colSpan="3">Loading organizations...</td></tr>}
              {organizationsQuery.isError && <tr><td className="empty error" colSpan="3">{organizationsQuery.error.message}</td></tr>}
              {!organizationsQuery.isLoading && !organizationsQuery.isError && !(organizationsQuery.data || []).filter((item) => item.name.toLowerCase().includes(organizationLookupSearch.toLowerCase())).length && <tr><td className="empty" colSpan="3">No matching organizations found</td></tr>}
            </tbody></table>
            <footer><em>Click a row to select</em></footer>
          </section>
        </div>
      )}
      {deleteDialogOpen && selected[0] && <div className="modal-backdrop delete-dialog-backdrop"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="delete-dialog-icon"><AlertTriangle size={25} /></div><h2 id="delete-title">Delete</h2><p>Do you really want to In-active/Delete this record?</p><div className="delete-dialog-actions"><button type="button" onClick={() => setDeleteDialogOpen(false)}><X size={13} /> No</button><button className="inactive-action" type="button" disabled={companyStatusMutation.isPending || companyDeleteMutation.isPending} onClick={markSelectedInactive}>In-Active</button><button className="delete-confirm" type="button" disabled={companyStatusMutation.isPending || companyDeleteMutation.isPending} onClick={removeSelected}><Trash2 size={13} /> Delete</button></div></section></div>}
    </div>
  );
}