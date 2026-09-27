import { useEffect, useState } from 'react';
import {
  Layers,
  Clock,
  CheckCircle2,
  Sparkles,
  Search,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Wand2,
} from 'lucide-react';
import { PageHeader, TextField, TextArea, LoadingState, ErrorState, EmptyState } from '../../design-system';
import { Tabs } from './Pages';

interface BlueprintItem {
  _id: string;
  name: string;
  description?: string;
  defaultDuration?: number;
  passingScore?: number;
  sections?: { name: string; type: string; questionCount: number; difficulty: string }[];
}

export function BlueprintBuilder() {
  const [blueprints, setBlueprints] = useState<BlueprintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState('60');
  const [passingScore, setPassingScore] = useState('50');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchBlueprints = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/assessments/blueprints');
      const json = await res.json();
      if (json.success) {
        setBlueprints(json.data.blueprints || []);
      } else {
        setError(json.message || 'Failed to load blueprints');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const createBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setLoading(true);
      await fetch('/api/v1/assessments/blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          sections: [
            { name: 'Coding Evaluation', type: 'coding', questionCount: 1, difficulty: 'mixed' },
            { name: 'SQL Querying', type: 'sql', questionCount: 1, difficulty: 'mixed' },
          ],
          defaultDuration: Number(duration) || 60,
          passingScore: Number(passingScore) || 50,
        }),
      });
      setName('');
      setDesc('');
      setIsFormOpen(false);
      await fetchBlueprints();
    } catch (err) {
      console.error('Failed to create blueprint', err);
      setLoading(false);
    }
  };

  const cloneBlueprint = async (id: string) => {
    try {
      setLoading(true);
      await fetch(`/api/v1/assessments/blueprints/${id}/clone`, { method: 'POST' });
      await fetchBlueprints();
    } catch (err) {
      console.error('Failed to clone blueprint', err);
      setLoading(false);
    }
  };

  const generateAssessment = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/assessments/blueprints/${id}/generate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert('Assessment successfully generated in Draft state from blueprint sections!');
      } else {
        alert(json.message || 'Failed to generate assessment');
      }
    } catch (err) {
      console.error('Failed to generate assessment', err);
      alert('Failed to generate assessment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch('/api/v1/assessments/blueprints')
      .then((res) => res.json())
      .then((json) => {
        if (!ignore) {
          if (json.success) {
            setBlueprints(json.data.blueprints || []);
          } else {
            setError(json.message || 'Failed to load blueprints');
          }
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Network error');
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const totalBlueprints = blueprints.length;
  const avgDuration =
    totalBlueprints > 0
      ? Math.round(
          blueprints.reduce((acc, b) => acc + (b.defaultDuration || 60), 0) /
            totalBlueprints,
        )
      : 60;
  const totalSections = blueprints.reduce(
    (acc, b) => acc + (b.sections?.length || 0),
    0,
  );

  const filteredBlueprints = blueprints.filter((b) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (b.name || '').toLowerCase().includes(term) ||
      (b.description || '').toLowerCase().includes(term) ||
      (b._id || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredBlueprints.length / pageSize) || 1;
  const paginatedBlueprints = filteredBlueprints.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  return (
    <div className="as-page">
      <div className="as-page-header-row">
        <div>
          <PageHeader
            title="Assessment Blueprints"
            description="Design reusable structural blueprint templates and generate complete assessments from section criteria."
          />
        </div>
        <Tabs />
      </div>

      {/* 4 Top Metric Cards */}
      <div className="as-metrics-grid">
        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <Layers size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--neutral">
              Templates
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Total Blueprints</span>
            <span className="as-metric-card__val">{totalBlueprints}</span>
            <span className="as-metric-card__sub">Reusable exam frameworks</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#0284c7' }}>
              <Clock size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--info">
              Standard
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Average Duration</span>
            <span className="as-metric-card__val">{avgDuration} min</span>
            <span className="as-metric-card__sub">Recommended test time</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#7c3aed' }}>
              <Sparkles size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--warning">
              Composition
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Sections Configured</span>
            <span className="as-metric-card__val">{totalSections}</span>
            <span className="as-metric-card__sub">Across all templates</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#16a34a' }}>
              <CheckCircle2 size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--success">
              Ready
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Instant Generation</span>
            <span className="as-metric-card__val">{totalBlueprints}</span>
            <span className="as-metric-card__sub">1-click draft creation</span>
          </div>
        </div>
      </div>

      {/* Modern Toolbar */}
      <div className="as-modern-toolbar">
        <div className="as-toolbar-filters">
          <div className="as-search-container">
            <Search className="as-search-icon" size={16} />
            <input
              type="text"
              className="as-search-input"
              placeholder="Search blueprint title, specifications..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                className="as-search-clear"
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchTerm && (
            <button
              type="button"
              className="as-action-link"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              style={{ height: '42px', borderRadius: '9999px', padding: '0 16px' }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>

        <div className="as-toolbar-actions">
          <button
            type="button"
            className="as-btn-black"
            onClick={() => setIsFormOpen((prev) => !prev)}
          >
            <Plus size={16} /> {isFormOpen ? 'Close Designer' : 'New Blueprint'}
          </button>
        </div>
      </div>

      {/* Modern Blueprint Creation Card */}
      {isFormOpen && (
        <form className="as-form-card" onSubmit={createBlueprint}>
          <div className="as-form-header">
            <h2 className="as-form-title">Blueprint Designer</h2>
            <p className="as-form-desc">
              Define a reusable architectural template. Assessments generated from this blueprint will automatically structure sections and difficulty distributions.
            </p>
          </div>

          <div className="as-form-section">
            <TextField
              required
              label="Blueprint Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Backend Engineer Benchmark"
            />
            <TextArea
              label="Description & Specifications"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Outline what skills, competencies, or requirements this blueprint measures..."
            />

            <div className="as-form-grid-2">
              <TextField
                label="Default Duration (minutes)"
                type="number"
                min="10"
                max="300"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <TextField
                label="Passing Score (%)"
                type="number"
                min="1"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
              />
            </div>
          </div>

          <div className="as-form-footer">
            <button
              type="button"
              className="as-btn-table-action"
              onClick={() => setIsFormOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="as-btn-black"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Creating...' : 'Create Blueprint Template'}
            </button>
          </div>
        </form>
      )}

      {/* Modern Table Card */}
      <div className="as-table-card">
        {error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState detail={error} retry={fetchBlueprints} />
          </div>
        ) : loading && blueprints.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <LoadingState label="Loading blueprint templates..." />
          </div>
        ) : filteredBlueprints.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <EmptyState
              title="No blueprint templates found"
              description="Design your first structural blueprint to start generating assessments."
            />
          </div>
        ) : (
          <div className="as-table-wrapper">
            <table className="as-modern-table">
              <thead>
                <tr>
                  <th>Blueprint ID</th>
                  <th>Template Name & Scope</th>
                  <th>Duration</th>
                  <th>Passing Score</th>
                  <th>Sections Configured</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBlueprints.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <span className="as-code-badge">
                        #BLP-{row._id?.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="as-entity-cell">
                        <div className="as-entity-icon">
                          <Layers size={18} />
                        </div>
                        <div className="as-entity-info">
                          <strong className="as-entity-title">{row.name}</strong>
                          <span className="as-entity-meta">
                            {row.description || 'General engineering evaluation blueprint'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="as-code-badge">
                        {row.defaultDuration || 60} min
                      </span>
                    </td>
                    <td>
                      <span className="as-status-pill as-status-pill--published">
                        <span className="as-status-dot" />
                        {row.passingScore || 50}% Passing
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                        }}
                      >
                        {row.sections?.length || 0} sections
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          type="button"
                          className="as-btn-table-action"
                          onClick={() => cloneBlueprint(row._id)}
                          title="Clone Blueprint"
                        >
                          <Copy size={13} /> Clone
                        </button>
                        <button
                          type="button"
                          className="as-btn-table-primary"
                          onClick={() => generateAssessment(row._id)}
                          title="Generate Assessment from Blueprint"
                        >
                          <Wand2 size={13} /> Generate Assessment
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Custom Pagination Footer */}
            <div className="as-pagination-footer">
              <div className="as-pagination-info">
                Showing{' '}
                <strong>
                  {filteredBlueprints.length > 0 ? (page - 1) * pageSize + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(page * pageSize, filteredBlueprints.length)}
                </strong>{' '}
                of <strong>{filteredBlueprints.length}</strong> blueprints
              </div>

              <div className="as-pagination-controls">
                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`as-page-btn ${pageNum === page ? 'as-page-btn--active' : ''}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
