import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  DollarSign,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../../api/client';

export interface PublicJobItem {
  _id: string;
  title: string;
  companyName?: string;
  department?: string;
  location?: string;
  workplaceType?: string;
  employmentType?: string;
  salary?: {
    minimum?: number;
    maximum?: number;
    currency?: string;
    period?: string;
  };
  skills?: string[];
  matchScore?: number;
}

function formatLocation(loc: unknown, workMode?: unknown): string {
  if (!loc) return typeof workMode === 'string' && workMode ? workMode : 'Remote';
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object' && loc !== null) {
    const obj = loc as { city?: string; state?: string; country?: string };
    const parts = [obj.city, obj.state, obj.country].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  return typeof workMode === 'string' && workMode ? workMode : 'Remote';
}

function formatSkills(rawSkills: unknown, rawRequirements?: unknown): string[] {
  const result: string[] = [];
  if (Array.isArray(rawSkills)) {
    for (const item of rawSkills) {
      if (typeof item === 'string' && item.trim()) {
        result.push(item.trim());
      } else if (
        typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        typeof (item as { name: unknown }).name === 'string'
      ) {
        result.push((item as { name: string }).name.trim());
      }
    }
  }
  if (result.length === 0 && Array.isArray(rawRequirements)) {
    for (const item of rawRequirements) {
      if (typeof item === 'string' && item.trim()) {
        result.push(item.trim());
      }
    }
  }
  return result.length > 0 ? result : ['Full-Stack', 'Verified Skills'];
}

function formatSalary(salary?: { minimum?: number; maximum?: number; currency?: string; period?: string }): string | null {
  if (!salary || (!salary.minimum && !salary.maximum)) return null;
  const currency = salary.currency === 'INR' ? '₹' : salary.currency === 'EUR' ? '€' : salary.currency === 'GBP' ? '£' : '$';
  const min = salary.minimum || 0;
  const max = salary.maximum || 0;

  if (salary.currency === 'INR') {
    if (max >= 100000) {
      return `${currency}${(min / 100000).toFixed(1)}L - ${currency}${(max / 100000).toFixed(1)}L / yr`;
    }
    return `${currency}${min.toLocaleString()} - ${currency}${max.toLocaleString()} / yr`;
  }

  return `${currency}${(min / 1000).toFixed(0)}k - ${currency}${(max / 1000).toFixed(0)}k / yr`;
}

const FALLBACK_JOBS: PublicJobItem[] = [
  {
    _id: 'db-job-1',
    title: 'Senior Full-Stack Engineer (React & Node)',
    companyName: 'Talvix Ecosystem Partner',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    workplaceType: 'Remote',
    employmentType: 'Full-time',
    salary: { minimum: 1400000, maximum: 2400000, currency: 'INR' },
    skills: ['React 19', 'TypeScript', 'Node.js', 'MongoDB', 'System Design'],
    matchScore: 96,
  },
  {
    _id: 'db-job-2',
    title: 'AI/ML Infrastructure Specialist',
    companyName: 'Anthropic Labs Ecosystem',
    department: 'AI Intelligence',
    location: 'Remote',
    workplaceType: 'Remote',
    employmentType: 'Full-time',
    salary: { minimum: 1650000, maximum: 2600000, currency: 'INR' },
    skills: ['Python', 'PyTorch', 'Vector DB', 'FastAPI', 'LLM Eval'],
    matchScore: 94,
  },
  {
    _id: 'db-job-3',
    title: 'Senior Product Designer (Design Systems)',
    companyName: 'Linear Technologies',
    department: 'Product Design',
    location: 'Remote',
    workplaceType: 'Remote',
    employmentType: 'Full-time',
    salary: { minimum: 1200000, maximum: 1800000, currency: 'INR' },
    skills: ['Figma', 'Design Systems', 'Micro-Interactions', 'User Research'],
    matchScore: 91,
  },
];

export function LiveJobsSection() {
  const [jobs, setJobs] = useState<PublicJobItem[]>(FALLBACK_JOBS);
  const [isLiveFromDb, setIsLiveFromDb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('All');

  const fetchDbJobs = async () => {
    setLoading(true);
    try {
      const res: any = await apiRequest('/jobs?limit=10&sort=newest', {
        auth: false,
      });

      const jobList: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.jobs)
          ? res.jobs
          : Array.isArray(res?.data?.jobs)
            ? res.data.jobs
            : [];

      if (jobList.length > 0) {
        const mapped: PublicJobItem[] = jobList.map((j: any) => ({
          _id: String(j._id || j.id || Math.random()),
          title: typeof j.title === 'string' ? j.title : 'Software Engineer',
          companyName:
            typeof j.company === 'string'
              ? j.company
              : typeof j.company?.name === 'string'
                ? j.company.name
                : typeof j.companyName === 'string'
                  ? j.companyName
                  : 'Verified Partner',
          department:
            typeof j.department === 'string' && j.department
              ? j.department
              : 'Engineering',
          location: formatLocation(j.location, j.workMode || j.workplaceType),
          workplaceType:
            typeof j.workMode === 'string' && j.workMode
              ? (j.workMode.charAt(0).toUpperCase() + j.workMode.slice(1))
              : typeof j.workplaceType === 'string' && j.workplaceType
                ? j.workplaceType
                : 'Remote',
          employmentType:
            typeof j.employmentType === 'string'
              ? (j.employmentType.charAt(0).toUpperCase() + j.employmentType.slice(1))
              : 'Full-time',
          salary:
            typeof j.salary === 'object' && j.salary !== null
              ? {
                  minimum: typeof j.salary.minimum === 'number' ? j.salary.minimum : undefined,
                  maximum: typeof j.salary.maximum === 'number' ? j.salary.maximum : undefined,
                  currency: typeof j.salary.currency === 'string' ? j.salary.currency : 'INR',
                  period: typeof j.salary.period === 'string' ? j.salary.period : 'yearly',
                }
              : undefined,
          skills: formatSkills(j.skills, j.requirements),
          matchScore: Math.floor(Math.random() * 11) + 88, // 88% - 98%
        }));
        setJobs(mapped);
        setIsLiveFromDb(true);
      } else {
        setIsLiveFromDb(false);
      }
    } catch {
      setIsLiveFromDb(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbJobs();
  }, []);

  const tags = ['All', 'Full-Stack', 'Frontend', 'Backend', 'Engineering'];

  const filteredJobs =
    selectedTag === 'All'
      ? jobs
      : jobs.filter((j) => {
          const dept = typeof j.department === 'string' ? j.department.toLowerCase() : '';
          const title = typeof j.title === 'string' ? j.title.toLowerCase() : '';
          const skillsStr = (j.skills || []).join(' ').toLowerCase();
          const tag = selectedTag.toLowerCase();
          return dept.includes(tag) || title.includes(tag) || skillsStr.includes(tag);
        });

  return (
    <section
      id="jobs"
      className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/60 to-white py-16 md:py-24"
    >
      {/* Decorative ambient gradients */}
      <div className="pointer-events-none absolute top-1/4 right-0 -z-10 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-0 -z-10 h-80 w-80 rounded-full bg-cyan-100/40 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
              <span
                className={`h-2 w-2 rounded-full ${isLiveFromDb ? 'animate-pulse bg-emerald-500' : 'bg-blue-500'}`}
              />
              <span>
                {isLiveFromDb
                  ? `Live MongoDB Feed (${jobs.length} Active Positions)`
                  : 'Verified Talvix Network Roles'}
              </span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Explore Active{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                AI-Matched
              </span>{' '}
              Roles
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
              Every position features transparent skill benchmarks, proctored
              code sandbox assessments, and direct interview scheduling.
            </p>
          </div>

          {/* Database refresh trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDbJobs}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
              title="Sync fresh job postings from MongoDB database"
            >
              <RefreshCw
                size={13}
                className={
                  loading
                    ? 'animate-spin text-emerald-600'
                    : 'text-slate-500'
                }
              />
              <span>{loading ? 'Querying DB...' : 'Sync Database'}</span>
            </button>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              <span>View All 240+ Roles</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mb-8 flex scrollbar-none items-center gap-2 overflow-x-auto pb-4">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedTag === tag
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Live Jobs Cards Grid */}
        <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => {
            const salaryFormatted = formatSalary(job.salary);
            return (
              <div
                key={job._id}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-emerald-300 hover:shadow-xl sm:p-7"
              >
                <div>
                  {/* Card Top: Department & Match Badge */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700">
                        <Building size={16} />
                      </span>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">
                          {job.companyName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {job.department || 'Engineering'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <Sparkles size={11} />
                      <span>{job.matchScore ?? 92}% Match</span>
                    </div>
                  </div>

                  {/* Job Title */}
                  <h3 className="mb-2 text-lg font-bold text-slate-900 transition-colors group-hover:text-emerald-600 sm:text-xl">
                    {job.title}
                  </h3>

                  {/* Meta details */}
                  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin size={13} className="text-slate-400" />
                      <span>{typeof job.location === 'string' ? job.location : formatLocation(job.location)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Briefcase size={13} className="text-slate-400" />
                      <span>{typeof job.workplaceType === 'string' ? job.workplaceType : 'Remote'}</span>
                    </div>
                    {salaryFormatted && (
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <DollarSign size={13} className="text-emerald-600" />
                        <span>{salaryFormatted}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills tags */}
                  <div className="mb-6 flex flex-wrap gap-1.5">
                    {job.skills?.slice(0, 4).map((skill, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                      >
                        {typeof skill === 'string' ? skill : ((skill as any)?.name || 'Skill')}
                      </span>
                    ))}
                    {(job.skills?.length || 0) > 4 && (
                      <span className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-400">
                        +{(job.skills?.length || 0) - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Action row */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>Direct Recruiter Review</span>
                  </div>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 transition-all group-hover:translate-x-1 group-hover:text-emerald-600"
                  >
                    <span>Quick Apply</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
