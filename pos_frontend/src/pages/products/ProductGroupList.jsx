import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import SplitTable from '../../components/SplitTable';
import RowActionPopup from '../../components/RowActionPopup';
import productGroupService from '../../services/productGroupService';
import { fetchCachedPage, getCachedPage, makePageKey, prefetchCachedPage } from '../../services/pageCache';
import { useAuth } from '../../context/AuthContext';

/* ─── Icons ─── */
const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const PlusIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const BackIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;

const PAGE_SIZE = 13;
const formatDate = (s) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ProductGroupList = () => {
  const navigate    = useNavigate();
  const { isAdmin } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [groups,     setGroups]     = useState([]);
  const [search,     setSearch]     = useState('');
  const [deb,        setDeb]        = useState('');
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [error,      setError]      = useState('');
  const [showDel,    setShowDel]    = useState(false);
  const [delTarget,  setDelTarget]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [hoveredGroupId, setHoveredGroupId] = useState(null);
  const [dismissedActionGroupId, setDismissedActionGroupId] = useState(null);
  const fetchSeqRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const isInteractiveTarget = (target) => Boolean(target?.closest?.(
    'input, select, textarea, button, a, [role="button"], .pagination, .row-action-popup'
  ));

  const moveGroupSelection = (delta) => {
    if (!groups.length) return;
    const currentIndex = Math.max(0, groups.findIndex(g => g.id === selectedGroupId));
    const nextIndex = Math.min(groups.length - 1, Math.max(0, currentIndex + delta));
    setSelectedGroupId(groups[nextIndex].id);
  };

  const handleListKeyDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveGroupSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveGroupSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!isAdmin) return;
      const active = groups.find(g => g.id === selectedGroupId);
      if (active) navigate(`/products/groups/${active.id}`);
    } else if (e.key === 'Escape') {
      setDismissedActionGroupId(hoveredGroupId ?? selectedGroupId);
      setHoveredGroupId(null);
    }
  };

  /* Debounce */
  useEffect(() => {
    const t = setTimeout(() => { setDeb(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  /* Fetch */
  const fetchGroups = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError('');
    const params = { page, page_size: PAGE_SIZE };
    if (deb) params.search = deb;
    const cacheKey = makePageKey('product-groups', params);
    const cached = getCachedPage('product-groups', cacheKey);
    if (cached) {
      const rows = cached.results !== undefined ? cached.results : (Array.isArray(cached) ? cached : []);
      setGroups(rows);
      setTotal(cached.count ?? rows.length);
      setLoading(false);
    }
    try {
      const { data } = await fetchCachedPage('product-groups', cacheKey, () => productGroupService.getGroups(params), { force: Boolean(cached) });
      if (seq !== fetchSeqRef.current) return;
      if (data.results !== undefined) {
        setGroups(data.results);
        setTotal(data.count);
      } else {
        setGroups(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.length : 0);
      }
      const rows = data.results !== undefined ? data.results : (Array.isArray(data) ? data : []);
      const totalCount = data.count ?? rows.length;
      const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      [page - 1, page + 1].filter(n => n >= 1 && n <= maxPage).forEach(n => {
        const nextParams = { ...params, page: n };
        prefetchCachedPage('product-groups', makePageKey('product-groups', nextParams), () => productGroupService.getGroups(nextParams));
      });
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      if (!cached && groups.length === 0) setError(err.response?.data?.detail || 'Failed to load groups.');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [page, deb, groups.length]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  /* Delete */
  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await productGroupService.deleteGroup(delTarget);
      setShowDel(false);
      setDelTarget(null);
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete group. It may still have products linked to it.');
      setShowDel(false);
    } finally {
      setDeleting(false);
    }
  };

  /* Pagination helper */
  const buildPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const p = [];
    if (page <= 4)                    p.push(1,2,3,4,5,'…',totalPages);
    else if (page >= totalPages - 3)  p.push(1,'…',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages);
    else                              p.push(1,'…',page-1,page,page+1,'…',totalPages);
    return p;
  };

  return (
    <Layout>
      {/* Page Header */}
      <div className="page-header animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate('/products')}>
            <BackIcon /> Products
          </button>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>Product Groups</h2>
            <p className="page-header-sub">
              {total > 0
                ? `${total} group${total !== 1 ? 's' : ''} configured`
                : 'Organise products into groups / categories'}
            </p>
          </div>
        </div>
        <div className="d-flex gap-2 align-center list-header-actions">
          <div className="input-group list-header-search">
            <span className="input-group-text"><SearchIcon /></span>
            <input type="text" className="form-control"
              placeholder="Search groups..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/products/groups/new')}>
            <PlusIcon /> Add Group
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning animate-in" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      {/* Table Card */}
      <div className="card animate-in animate-in-1">
        <div className="card-body">

          {/* Toolbar */}
          <div className="list-toolbar" style={{display:'none'}}>
            <div className="input-group" style={{ maxWidth: 380 }}>
              <span className="input-group-text"><SearchIcon /></span>
              <input type="text" className="form-control"
                placeholder="Search by group name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '.8125rem', color: 'var(--text-muted)' }}>
              {total} group{total !== 1 ? 's' : ''}
            </span>
          </div>

          <>
              <div className="list-keyboard-zone" tabIndex={0} onKeyDown={handleListKeyDown}>
              <SplitTable
                className="table table-compact product-group-table"
                tableProps={{ style: { tableLayout: 'auto' } }}
                empty={groups.length===0}
                head={(
                    <tr style={{background:'#8A5125'}}>
                      <th style={{width:50,color:'#fff',background:'#8A5125',fontWeight:800}}>#</th>
                      <th style={{color:'#fff',background:'#8A5125',fontWeight:800}}>Group Name</th>
                      <th style={{color:'#fff',background:'#8A5125',fontWeight:800}}>Created On</th>
                      <th style={{color:'#fff',background:'#8A5125',fontWeight:800}}>Created By</th>
                    </tr>
                )}
              >
                    {groups.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📁</div>
                          {deb
                            ? `No groups matching "${deb}"`
                            : 'No groups yet. Add your first product group.'}
                        </td>
                      </tr>
                    ) : groups.map((g, idx) => (
                      <tr key={g.id}
                        className={selectedGroupId === g.id ? 'row-keyboard-selected' : ''}
                        style={{ cursor: 'pointer', position:'relative' }}
                        onMouseEnter={(e) => { e.currentTarget.closest('.list-keyboard-zone')?.focus(); setHoveredGroupId(g.id); setSelectedGroupId(g.id); setDismissedActionGroupId(null); }}
                        onMouseLeave={() => setHoveredGroupId(prev => prev === g.id ? null : prev)}
                        onClick={() => { setSelectedGroupId(g.id); setDismissedActionGroupId(null); }}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '.8125rem' }}>
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {g.GroupName}
                          </span>
                        </td>
                        <td className="row-action-anchor" style={{ color: 'var(--text-muted)', fontSize: '.8125rem' }}>
                          {formatDate(g.CreatedOn)}
                          <RowActionPopup
                            visible={isAdmin && hoveredGroupId === g.id && dismissedActionGroupId !== g.id}
                            onDismiss={() => { setDismissedActionGroupId(hoveredGroupId ?? selectedGroupId); setHoveredGroupId(null); }}
                            actions={[
                              { type:'delete', title:'Delete', variant:'danger', onClick:() => { setSelectedGroupId(g.id); setDelTarget(g.id); setShowDel(true); } },
                            ]}
                          />
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '.8125rem' }}>
                          {g.CreatedByUsername || '—'}
                        </td>
                      </tr>
                    ))}
              </SplitTable>
              </div>

              <div className="table-pagination-footer">
                <div className="product-record-info">
                  Showing {groups.length ? ((page - 1) * PAGE_SIZE) + 1 : 0}-{Math.min(page * PAGE_SIZE, total)} of {total} records
                </div>
                <div className="pagination" style={{ marginTop: 0 }}>
                  <button className="pg-item" disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}>Previous</button>
                  {total > 0 && buildPages().map((n, i) =>
                    n === '...' || n === '…'
                      ? <span key={`e${i}`} className="pg-item"
                          style={{ border: 'none', cursor: 'default', color: 'var(--text-muted)' }}>...</span>
                      : <button key={n}
                          className={`pg-item${page === n ? ' active' : ''}`}
                          onClick={() => setPage(n)}>{n}</button>
                  )}
                  <button className="pg-item" disabled={page === totalPages || total === 0}
                    onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              </div>
          </>
        </div>
      </div>

      <ConfirmModal
        show={showDel}
        title="Delete Group"
        message="Delete this product group? Products linked to this group will have their group cleared, but will not be deleted."
        onConfirm={handleDelete}
        onCancel={() => { setShowDel(false); setDelTarget(null); }}
        confirmVariant="danger"
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        cancelText="Cancel"
      />
    </Layout>
  );
};

export default ProductGroupList;
