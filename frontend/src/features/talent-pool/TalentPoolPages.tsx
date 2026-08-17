import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import {
  Button,
  Card,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  SearchField,
  Select,
  StatusTag,
  TextArea,
  TextField,
  Toolbar,
} from '../../design-system';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Tag,
  MessageSquare,
  UserPlus,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  ChevronRight,
  X,
  FileCheck
} from 'lucide-react';

interface CandidateUser {
  _id: string;
  fullName: string;
  email: string;
}

interface CandidateSkill {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience: number;
}

interface Education {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear: number;
  endYear?: number;
}

interface Experience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  currentlyWorking?: boolean;
}

interface CandidateProfileView {
  _id: string;
  headline?: string;
  bio?: string;
  skills: CandidateSkill[];
  education: Education[];
  experience: Experience[];
  location?: { city?: string; country?: string };
  resume?: { url?: string; fileName?: string };
}

interface CompanyTagView {
  _id: string;
  name: string;
  color: string;
}

interface PoolNote {
  _id?: string;
  recruiter: { fullName?: string } | string;
  content: string;
  createdAt: string;
}

interface PoolMember {
  id: string;
  _id: string;
  candidate: CandidateUser;
  candidateProfile?: CandidateProfileView;
  status: 'sourced' | 'interested' | 'contacted' | 'silver-medalist' | 'archived';
  tags: CompanyTagView[];
  notes: PoolNote[];
  matchScore: number | null;
  missingRequiredSkills: string[];
}

export function TalentPoolPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Filters & State parameters
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const matchJobId = searchParams.get('matchJobId') || '';

  // Metadata arrays
  const [jobs, setJobs] = useState<any[]>([]);
  const [tags, setTags] = useState<CompanyTagView[]>([]);

  // Modals / Details states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState<PoolMember | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState<PoolMember | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState<PoolMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<PoolMember | null>(null);

  // Add Candidate Sourcing state
  const [candidateSearch, setCandidateSearch] = useState('');
  const [globalCandidates, setGlobalCandidates] = useState<any[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // New note form state
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Edit status/tags state
  const [editStatus, setEditStatus] = useState<string>('sourced');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // New tag inline state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366F1');

  // Load static context items (Jobs & Tags)
  useEffect(() => {
    apiRequest<{ jobs?: any[] }>('/jobs/manage?limit=50')
      .then((res) => {
        const activeJobs = (res.jobs || []).filter(
          (j) => j.status === 'published' || j.status === 'paused'
        );
        setJobs(activeJobs);
      })
      .catch((err) => console.error('Failed to load recruiter jobs', err));

    apiRequest<{ tags?: CompanyTagView[] }>('/talent-pool/tags')
      .then((res) => setTags(res.tags || []))
      .catch((err) => console.error('Failed to load company tags', err));
  }, []);

  // Fetch Talent Pool members on param change
  const fetchPool = () => {
    setLoading(true);
    setError(null);
    const queryParts = [
      `page=${page}`,
      `limit=10`,
      search ? `search=${encodeURIComponent(search)}` : '',
      status ? `status=${status}` : '',
      matchJobId ? `matchJobId=${matchJobId}` : '',
    ].filter(Boolean);

    apiRequest<{ items: PoolMember[]; pagination: any }>(
      `/talent-pool?${queryParts.join('&')}`
    )
      .then((res) => {
        setMembers(res.items || []);
        setPagination(res.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
      })
      .catch((err) => setError(err.message || 'Failed to fetch talent pool'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPool();
  }, [page, search, status, matchJobId]);

  // Load global candidates for manual addition
  useEffect(() => {
    if (!isAddOpen) return;
    setGlobalLoading(true);
    apiRequest<{ candidates?: any[] }>([
      `/candidates?limit=20`,
      candidateSearch ? `search=${encodeURIComponent(candidateSearch)}` : ''
    ].filter(Boolean).join('&'))
      .then((res) => setGlobalCandidates(res.candidates || []))
      .catch((err) => console.error('Failed to fetch candidates', err))
      .finally(() => setGlobalLoading(false));
  }, [isAddOpen, candidateSearch]);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    next.set('page', '1'); // reset to page 1
    setSearchParams(next);
  };

  const handleAddCandidate = async (candidateId: string) => {
    try {
      await apiRequest('/talent-pool', {
        method: 'POST',
        body: { candidateId },
      });
      alert('Candidate added to talent pool successfully.');
      setIsAddOpen(false);
      setCandidateSearch('');
      fetchPool();
    } catch (err: any) {
      alert(err.message || 'Failed to add candidate');
    }
  };

  const handleSaveNote = async () => {
    if (!isNoteOpen || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      await apiRequest(`/talent-pool/${isNoteOpen._id}/notes`, {
        method: 'POST',
        body: { content: noteContent },
      });
      setNoteContent('');
      setIsNoteOpen(null);
      fetchPool();
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!isEditOpen) return;
    setSavingEdit(true);
    try {
      await apiRequest(`/talent-pool/${isEditOpen._id}`, {
        method: 'PATCH',
        body: { status: editStatus, tags: editTags },
      });
      setIsEditOpen(null);
      fetchPool();
    } catch (err: any) {
      alert(err.message || 'Failed to update member status/tags');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await apiRequest<{ tag: CompanyTagView }>('/talent-pool/tags', {
        method: 'POST',
        body: { name: newTagName, color: newTagColor },
      });
      if (res?.tag) {
        setTags([...tags, res.tag]);
        setEditTags([...editTags, res.tag._id]);
        setNewTagName('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create tag');
    }
  };

  const handleDeleteMember = async () => {
    if (!isDeleteOpen) return;
    try {
      await apiRequest(`/talent-pool/${isDeleteOpen._id}`, {
        method: 'DELETE',
      });
      setIsDeleteOpen(null);
      fetchPool();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const openEditModal = (member: PoolMember) => {
    setEditStatus(member.status);
    setEditTags(member.tags.map((t) => t._id));
    setIsEditOpen(member);
  };

  // Status mapping colors
  const statusTone = (st: string): 'danger' | 'neutral' | 'success' | 'warning' | 'info' | 'ai' => {
    switch (st) {
      case 'interested': return 'success';
      case 'contacted': return 'warning';
      case 'silver-medalist': return 'ai';
      case 'archived': return 'neutral';
      default: return 'info';
    }
  };

  return (
    <main className="talent-pool-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <PageHeader
        title="Talent Pool"
        description="Search, organize, and match sourced candidates or past applicants against current job openings."
        primaryAction={
          <Button
            type="button"
            onClick={() => setIsAddOpen(true)}
          >
            <UserPlus size={16} style={{ marginRight: '8px' }} />
            Add Candidate
          </Button>
        }
      />

      {/* Pipeline Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard label="Total Talent Pool" value={pagination.total} metadata="Candidates in pool" />
        <MetricCard label="Silver Medalists" value={members.filter(m => m.status === 'silver-medalist').length} metadata="Reached final stages" />
        <MetricCard label="Interested Prospects" value={members.filter(m => m.status === 'interested').length} metadata="Actively interested" />
      </div>

      {/* Filters Toolbar */}
      <Toolbar
        label="Talent Pool Filters"
        start={
          <SearchField
            label="Search candidate name or bio"
            defaultValue={search}
            onSearch={(v) => updateParams({ search: v })}
          />
        }
        end={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Select
              aria-label="Filter by pool status"
              value={status}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'sourced', label: 'Sourced' },
                { value: 'interested', label: 'Interested' },
                { value: 'contacted', label: 'Contacted' },
                { value: 'silver-medalist', label: 'Silver Medalist' },
                { value: 'archived', label: 'Archived' },
              ]}
              onChange={(e) => updateParams({ status: e.target.value })}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-2)', padding: '4px 12px', borderRadius: 'var(--border-radius-md)' }}>
              <Sparkles size={16} className="text-premium" />
              <Select
                aria-label="Smart Job Match Sorting"
                placeholder="Select Job to Rank..."
                value={matchJobId}
                options={jobs.map((j) => ({ value: j.id || j._id || '', label: j.title }))}
                onChange={(e) => updateParams({ matchJobId: e.target.value })}
              />
            </div>
          </div>
        }
      />

      {/* Main Results Listing */}
      {loading ? (
        <LoadingState label="Loading talent pool database..." />
      ) : error ? (
        <ErrorState detail={error} retry={fetchPool} />
      ) : members.length === 0 ? (
        <EmptyState
          title="No candidates found"
          description={
            search || status || matchJobId
              ? 'Try adjusting your filters or active job match sorting.'
              : 'Your talent pool is currently empty. Add candidates to get started.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          {members.map((member) => (
            <div
              key={member.id}
              className="tvx-card tvx-card--bordered talent-card"
              style={{ transition: 'all 0.2s ease', position: 'relative', padding: '24px', background: 'var(--color-surface-1)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                
                {/* Details Section */}
                <div style={{ flex: '1', minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{member.candidate.fullName}</h3>
                    <StatusTag tone={statusTone(member.status)}>{member.status}</StatusTag>
                    {member.matchScore !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-premium-bg)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--color-premium-text)' }}>
                        <Sparkles size={12} />
                        {member.matchScore}% Match
                      </div>
                    )}
                  </div>

                  <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    {member.candidateProfile?.headline || 'No headline provided'}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    {member.candidateProfile?.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} />
                        {[member.candidateProfile?.location?.city, member.candidateProfile?.location?.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {member.candidateProfile?.experience && member.candidateProfile.experience.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Briefcase size={14} />
                        {member.candidateProfile?.experience?.[0]?.title} at {member.candidateProfile?.experience?.[0]?.company}
                      </span>
                    )}
                  </div>

                  {/* Skills tags */}
                  {member.candidateProfile?.skills && member.candidateProfile.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {member.candidateProfile.skills.slice(0, 6).map((skill, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '2px 8px',
                            background: 'var(--color-surface-2)',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {skill.name} ({skill.yearsOfExperience}y)
                        </span>
                      ))}
                      {member.candidateProfile.skills.length > 6 && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                          +{member.candidateProfile.skills.length - 6} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Company specific Tags */}
                  {member.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {member.tags.map((t) => (
                        <span
                          key={t._id}
                          style={{
                            padding: '2px 8px',
                            background: `${t.color}20`,
                            border: `1px solid ${t.color}`,
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '500',
                            color: t.color,
                          }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Private Review Notes snippet */}
                  {member.notes.length > 0 && (
                    <div
                      style={{
                        padding: '10px',
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--border-radius-md)',
                        fontSize: '13px',
                        borderLeft: '3px solid var(--color-border)',
                      }}
                    >
                       <strong>Team Review:</strong> "{member.notes[member.notes.length - 1]?.content}"
                    </div>
                  )}
                </div>

                {/* Actions Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'flex-start', minWidth: '160px' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedMember(member)}
                  >
                    View Profile
                    <ChevronRight size={14} style={{ marginLeft: '4px' }} />
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => openEditModal(member)}
                  >
                    <Tag size={14} style={{ marginRight: '6px' }} />
                    Edit Status/Tags
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => setIsNoteOpen(member)}
                  >
                    <MessageSquare size={14} style={{ marginRight: '6px' }} />
                    Add Team Note
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => setIsDeleteOpen(member)}
                  >
                    <Trash2 size={14} style={{ marginRight: '6px' }} />
                    Remove
                  </Button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <span style={{ alignSelf: 'center', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Page {page} of {pagination.pages}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= pagination.pages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      )}

      {/* Modal 1: Add Candidate Sourcing */}
      {isAddOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-overlay)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '24px',
              borderRadius: 'var(--border-radius-lg)',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Add Candidate to Pool</h2>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                onClick={() => setIsAddOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <SearchField
              label="Search registered candidates..."
              defaultValue={candidateSearch}
              onSearch={(v) => setCandidateSearch(v)}
            />

            <div style={{ flex: '1', overflowY: 'auto', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {globalLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
              ) : globalCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No candidate profiles found.</div>
              ) : (
                globalCandidates.map((cand) => {
                  const userObj = cand.user || {};
                  const userId = userObj._id || '';
                  return (
                    <div
                      key={cand._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--border-radius-md)',
                      }}
                    >
                      <div>
                        <strong>{userObj.fullName || 'Unnamed Candidate'}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{userObj.email || ''}</div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!userId}
                        onClick={() => handleAddCandidate(userId)}
                      >
                        Add
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add Note */}
      {isNoteOpen && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setIsNoteOpen(null)}
          title={`Add private note for ${isNoteOpen.candidate.fullName}`}
          confirmLabel={savingNote ? 'Adding...' : 'Add Note'}
          onConfirm={handleSaveNote}
          description={
            <TextArea
              label="Internal review comment"
              placeholder="Add comments on experience, interview highlights, or match logic..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
          }
        />
      )}

      {/* Modal 3: Edit Status/Tags */}
      {isEditOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-overlay)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '24px',
              borderRadius: 'var(--border-radius-lg)',
              width: '90%',
              maxWidth: '500px',
            }}
          >
            <h2 style={{ margin: '0 0 16px 0' }}>Update Profile</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Pool Status</label>
              <Select
                aria-label="Edit Status"
                value={editStatus}
                options={[
                  { value: 'sourced', label: 'Sourced' },
                  { value: 'interested', label: 'Interested' },
                  { value: 'contacted', label: 'Contacted' },
                  { value: 'silver-medalist', label: 'Silver Medalist' },
                  { value: 'archived', label: 'Archived' },
                ]}
                onChange={(e) => setEditStatus(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Company Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                {tags.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    style={{
                      border: `1px solid ${t.color}`,
                      borderRadius: '12px',
                      padding: '4px 12px',
                      fontSize: '12px',
                      background: editTags.includes(t._id) ? `${t.color}30` : 'none',
                      color: t.color,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (editTags.includes(t._id)) {
                        setEditTags(editTags.filter((id) => id !== t._id));
                      } else {
                        setEditTags([...editTags, t._id]);
                      }
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              
              {/* Create new tag inline */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <TextField
                  label="Create Tag"
                  placeholder="New tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  style={{ width: '40px', height: '40px', border: 'none', cursor: 'pointer', alignSelf: 'flex-end', borderRadius: '4px' }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={handleCreateTag}
                >
                  Create
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditOpen(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={savingEdit}
                onClick={handleSaveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Confirmation */}
      {isDeleteOpen && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setIsDeleteOpen(null)}
          title="Remove candidate from pool?"
          description={`Are you sure you want to remove ${isDeleteOpen.candidate.fullName} from your company's talent pool? Internal tags and comments will be lost.`}
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={handleDeleteMember}
        />
      )}

      {/* Drawer: Detailed Profile View */}
      {selectedMember && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            maxWidth: '650px',
            background: 'var(--color-surface-1)',
            borderLeft: '1px solid var(--color-border-subtle)',
            boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedMember.candidate.fullName}</h2>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{selectedMember.candidate.email}</span>
            </div>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              onClick={() => setSelectedMember(null)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable details */}
          <div style={{ flex: '1', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <StatusTag tone={statusTone(selectedMember.status)}>{selectedMember.status}</StatusTag>
              {selectedMember.matchScore !== null && (
                <StatusTag tone="ai">Match Score: {selectedMember.matchScore}%</StatusTag>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>Professional Summary</h4>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                {selectedMember.candidateProfile?.bio || 'No career bio provided by the candidate.'}
              </p>
            </div>

            {selectedMember.candidateProfile?.resume?.url && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>Attachments</h4>
                <a
                  href={selectedMember.candidateProfile.resume.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tvx-button tvx-button--secondary tvx-button--md"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <FileCheck size={16} />
                  View Uploaded Resume
                </a>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>Work History</h4>
              {selectedMember.candidateProfile?.experience && selectedMember.candidateProfile.experience.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedMember.candidateProfile.experience.map((exp, idx) => (
                    <div key={idx} style={{ padding: '12px', background: 'var(--color-surface-2)', borderRadius: 'var(--border-radius-md)' }}>
                      <strong style={{ display: 'block' }}>{exp.title}</strong>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{exp.company}</span>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {new Date(exp.startDate).toLocaleDateString()} – {exp.currentlyWorking ? 'Present' : exp.endDate ? new Date(exp.endDate).toLocaleDateString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No work history listed.</p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>Education</h4>
              {selectedMember.candidateProfile?.education && selectedMember.candidateProfile.education.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedMember.candidateProfile.education.map((edu, idx) => (
                    <div key={idx} style={{ padding: '12px', background: 'var(--color-surface-2)', borderRadius: 'var(--border-radius-md)' }}>
                      <strong style={{ display: 'block' }}>{edu.degree} in {edu.fieldOfStudy || 'General study'}</strong>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{edu.institution}</span>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Graduated: {edu.endYear || edu.startYear}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No education history listed.</p>
              )}
            </div>

            <div>
              <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>Team Feedback History</h4>
              {selectedMember.notes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedMember.notes.map((n, idx) => (
                    <div key={idx} style={{ padding: '10px', borderLeft: '3px solid var(--color-primary)', background: 'var(--color-surface-2)' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>{n.content}</p>
                      <small style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No comments or review notes yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
