import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, Copy, Download, Eye, FilePlus2, Pencil, Power, Search, Trash2, X } from 'lucide-react';
import { emptySearch, getOrganizations, saveOrganization, deleteOrganization, readApiResponse } from './components/organizationService';
import { OrganizationForm } from './components/OrganizationForm';
import { TopNavigation } from './components/OrganizationShared';
export default function App() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Select');
  const [applied, setApplied] = useState(emptySearch);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formOrganizationId, setFormOrganizationId] = useState(null);
  const [formInitialOrganization, setFormInitialOrganization] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sort, setSort] = useState({ key: 'code', direction: 'asc' });

  const organizationsQuery = useQuery({
    queryKey: ['organizations', applied, page, perPage],
    queryFn: getOrganizations,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000)
  });
  const result = organizationsQuery.data || { rows: [], total: 0, totalPages: 1 };
  const sortedOrganizations = [...result.rows].sort((first, second) => {
    const comparison = String(first[sort.key] || '').localeCompare(String(second[sort.key] || ''), undefined, { sensitivity: 'base' });
    return sort.direction === 'asc' ? comparison : -comparison;
  });
  const organizationStatusMutation = useMutation({
    mutationFn: (organization) => saveOrganization(organization.id, { ...organization, status: 'Inactive', code: organization.code || '', name: organization.name || '', reportingCurrency: organization.reportingCurrency || organization.currency || '' }),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setSelected([]);
      organizationsQuery.refetch();
    },
    onError: (requestError) => window.alert(requestError.message)
  });
  const organizationDeleteMutation = useMutation({
    mutationFn: (organizationId) => deleteOrganization(organizationId),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setSelected([]);
      organizationsQuery.refetch();
    },
    onError: (requestError) => window.alert(requestError.message)
  });

  const updateFilter = (key, value) => {
    setApplied((current) => ({ ...current, [key]: key === 'status' ? value : value.trim() }));
    if (key === 'code') setCode(value);
    if (key === 'name') setName(value);
    if (key === 'status') setStatus(value);
    setPage(1);
  };

  const reset = () => {
    setCode('');
    setName('');
    setStatus('Select');
    setApplied(emptySearch);
    setPage(1);
    setSelected([]);
  };

  const selectRow = (organization) => {
    setSelected((current) => current.some((item) => item.id === organization.id) ? [] : [organization]);
  };
  const openNewOrganization = () => openForm('create');
  const openForm = (mode, organization = null) => {
    setFormMode(mode);
    setFormOrganizationId(mode === 'create' || mode === 'copy' ? null : organization?.id || null);
    setFormInitialOrganization(organization);
    setShowForm(true);
  };
  const deleteSelected = () => {
    if (!selected.length) return;
    setDeleteDialogOpen(true);
  };
  const markSelectedInactive = () => {
    if (selected[0]) organizationStatusMutation.mutate(selected[0]);
  };
  const removeSelected = () => {
    if (selected[0]) organizationDeleteMutation.mutate(selected[0].id);
  };
  const downloadOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations?page=1&linesPerPage=10000');
      const exportResult = await readApiResponse(response, 'Unable to export organizations');
      const escape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const rows = selected.length ? selected : exportResult.rows;
      const table = `<tr><th>Organization Code</th><th>Name</th><th>Reporting Currency</th><th>Status</th></tr>${rows.map((row) => `<tr><td>${escape(row.code)}</td><td>${escape(row.name)}</td><td>${escape(row.currency || row.reportingCurrency)}</td><td>${escape(row.status)}</td></tr>`).join('')}`;
      const blob = new Blob([`<html><head><meta charset="UTF-8"></head><body><table>${table}</table></body></html>`], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'organizations.xls';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error.message);
    }
  };

  if (showForm) {
    return <OrganizationForm
      layout="four-4"
      organizationId={formOrganizationId}
      initialOrganization={formInitialOrganization}
      formMode={formMode}
      readOnly={formMode === 'view'}
      onCancel={() => setShowForm(false)}
      onCreated={() => {
        setShowForm(false);
        organizationsQuery.refetch();
        setSelected([]);
      }}
    />;
  }

  return (
    <div className="legacy-screen">
      <TopNavigation />

      <header className="brand-bar">
        <strong>150CHF</strong>
        <span>Organizations</span>
        <div className="user-meta">User: <b>APPADMIN</b>&nbsp;&nbsp; Party: <b>APPADMIN</b>&nbsp;&nbsp; Role: <b>APPADMIN</b></div>
      </header>

      <div className="action-bar">
        <button aria-label="Search" title="Search organizations" onClick={() => document.querySelector('.search-fields input')?.focus()}><Search size={14} /></button>
        <button aria-label="Back" onClick={reset}>↶</button>
        <button aria-label="Export organizations" onClick={downloadOrganizations}><Download size={13} /></button>
        {!selected.length && <button aria-label="New organization" title="Add organization" onClick={openNewOrganization}><FilePlus2 size={13} /></button>}
        {selected.length > 0 && (
          <>
            <button aria-label="View organization" title="View organization" onClick={() => openForm('view', selected[0])}><Eye size={13} /></button>
            <button aria-label="Edit organization" title="Edit organization" onClick={() => openForm('edit', selected[0])}><Pencil size={13} /></button>
            <button aria-label="Copy organization" title="Copy organization" type="button"><Copy size={13} /></button>
            <button aria-label="Delete organization" title="Delete organization" onClick={deleteSelected}><Trash2 size={13} /></button>
          </>
        )}
        <button className="toolbar-power" aria-label="Power" type="button"><Power size={13} /></button>
      </div>
      <main>
        <section className="summary-box">
          <div className="section-title"><ClipboardList size={13} /> Summary</div>
          <div className="summary-grid"><span>Code</span><span>Name</span><span>Status</span></div>
          {selected.map((organization) => <div className="summary-values" key={organization.id}><b>{organization.code}</b><b>{organization.name}</b><b>{organization.status}</b></div>)}
        </section>

        <section className="search-box">
          <div className="search-fields">
            <label>Organization Code<input value={code} onChange={(event) => updateFilter('code', event.target.value)} /></label>
            <label>Name<input value={name} onChange={(event) => updateFilter('name', event.target.value)} /></label>
            <label>Status<select value={status} onChange={(event) => updateFilter('status', event.target.value)}><option>Select</option><option>Active</option><option>Inactive</option></select></label>
          </div>
        </section>

        <section className="table-box">
          <table>
            <thead><tr>{[['code', 'Organization Code'], ['name', 'Name'], ['currency', 'Rpt Curn'], ['status', 'Status']].map(([key, label]) => <th key={key} aria-sort={sort.key === key ? `${sort.direction}ending` : 'none'}><button className="sort-header" type="button" onClick={() => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))}>{label}<i>{sort.key === key && sort.direction === 'desc' ? '▼' : '▲'}</i></button></th>)}</tr></thead>
            <tbody>
              {organizationsQuery.isLoading && <tr><td className="empty" colSpan="4">Loading organizations...</td></tr>}
              {organizationsQuery.isError && <tr><td className="empty error" colSpan="4">{organizationsQuery.error.message}</td></tr>}
              {!organizationsQuery.isLoading && !organizationsQuery.isError && sortedOrganizations.map((organization) => (
                <tr
                  key={organization.id}
                  onClick={() => selectRow(organization)}
                  className={selected.some((item) => item.id === organization.id) ? 'selected-row' : ''}
                >
                  <td>{organization.code}</td><td>{organization.name}</td><td>{organization.currency}</td><td>{organization.status}</td>
                </tr>
              ))}
              {!organizationsQuery.isLoading && !organizationsQuery.isError && !result.rows.length && <tr><td className="empty" colSpan="4">No matching organizations found</td></tr>}
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
      {deleteDialogOpen && selected[0] && <div className="modal-backdrop delete-dialog-backdrop"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="delete-dialog-icon"><AlertTriangle size={25} /></div><h2 id="delete-title">Delete</h2><p>Do you really want to In-active/Delete this record?</p><div className="delete-dialog-actions"><button type="button" onClick={() => setDeleteDialogOpen(false)}><X size={13} /> No</button><button className="inactive-action" type="button" disabled={organizationStatusMutation.isPending || organizationDeleteMutation.isPending} onClick={markSelectedInactive}>In-Active</button><button className="delete-confirm" type="button" disabled={organizationStatusMutation.isPending || organizationDeleteMutation.isPending} onClick={removeSelected}><Trash2 size={13} /> Delete</button></div></section></div>}
    </div>
  );
}