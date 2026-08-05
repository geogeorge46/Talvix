import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import { Button } from '../../design-system';

// Define TS Interfaces for typesafety
interface AIProvider {
  _id: string;
  name: string;
  displayName: string;
  isActive: boolean;
  isPrimary: boolean;
  apiKey?: string;
  baseUrl?: string;
  supportedModels: string[];
  costPerInputToken: number;
  costPerOutputToken: number;
  metadata?: Record<string, any>;
}

interface AIConfig {
  _id: string;
  primaryProvider: string;
  fallbackProvider: string | null;
  cachingEnabled: boolean;
  cacheTtlSeconds: number;
  retryCount: number;
  retryBackoffMs: number;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  promptInjectionFiltersEnabled: boolean;
}

interface AIPrompt {
  _id: string;
  key: string;
  version: number;
  template: string;
  description: string;
  requiredVariables: string[];
  isActive: boolean;
  createdAt: string;
}

interface AIUsageLog {
  _id: string;
  providerName: string;
  modelName: string;
  promptKey: string;
  promptVersion: number;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  durationMs: number;
  status: 'success' | 'failed';
  errorMessage?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user?: { fullName: string; email: string };
  company?: { name: string };
  requestPayload?: any;
  responsePayload?: any;
}

interface AIHealth {
  databaseState: string;
  activeProviders: number;
  totalCacheSize: number;
  recentStats: {
    requestsLastHour: number;
    errorRatePercent: number;
    averageLatencyMs: number;
  };
}

interface AISecurity {
  rateLimitsTriggered24h: number;
  potentialPromptInjections24h: number;
}

export function AIConsolePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'prompts' | 'logs' | 'config'>('overview');
  const queryClient = useQueryClient();

  // Queries
  const { data: config, isLoading: loadingConfig } = useQuery<AIConfig>({
    queryKey: ['admin-ai-config'],
    queryFn: () => apiRequest<AIConfig>('/admin/ai/config'),
  });

  const { data: providers, isLoading: loadingProviders } = useQuery<AIProvider[]>({
    queryKey: ['admin-ai-providers'],
    queryFn: () => apiRequest<AIProvider[]>('/admin/ai/providers'),
  });

  const { data: prompts, isLoading: loadingPrompts } = useQuery<AIPrompt[]>({
    queryKey: ['admin-ai-prompts'],
    queryFn: () => apiRequest<AIPrompt[]>('/admin/ai/prompts'),
  });

  const { data: health, isLoading: loadingHealth } = useQuery<AIHealth>({
    queryKey: ['admin-ai-health'],
    queryFn: () => apiRequest<AIHealth>('/admin/ai/health'),
    refetchInterval: 15000,
  });

  const { data: logs, isLoading: loadingLogs } = useQuery<AIUsageLog[]>({
    queryKey: ['admin-ai-logs'],
    queryFn: () => apiRequest<AIUsageLog[]>('/admin/ai/logs'),
  });

  const { data: security } = useQuery<AISecurity>({
    queryKey: ['admin-ai-security'],
    queryFn: () => apiRequest<AISecurity>('/admin/ai/security'),
    refetchInterval: 30000,
  });

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: Partial<AIConfig>) => apiRequest<AIConfig>('/admin/ai/config', { method: 'PUT', body: newConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-config'] });
    },
  });

  const createProviderMutation = useMutation({
    mutationFn: (newProvider: Partial<AIProvider>) => apiRequest<AIProvider>('/admin/ai/providers', { method: 'POST', body: newProvider }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AIProvider> }) =>
      apiRequest<AIProvider>(`/admin/ai/providers/${id}`, { method: 'PUT', body: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/admin/ai/providers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });

  const createPromptMutation = useMutation({
    mutationFn: (newPrompt: Partial<AIPrompt>) => apiRequest<AIPrompt>('/admin/ai/prompts', { method: 'POST', body: newPrompt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-prompts'] });
    },
  });

  const activatePromptMutation = useMutation({
    mutationFn: ({ key, version }: { key: string; version: number }) =>
      apiRequest<AIPrompt>(`/admin/ai/prompts/${key}/active/${version}`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-prompts'] });
    },
  });

  // Dialog / Modal Form States
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerForm, setProviderForm] = useState<Partial<AIProvider>>({
    name: '', displayName: '', costPerInputToken: 0, costPerOutputToken: 0, supportedModels: [], apiKey: '', baseUrl: '', isActive: true
  });
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptForm, setPromptForm] = useState<Partial<AIPrompt>>({
    key: '', template: '', description: '', requiredVariables: []
  });

  const [activeLogPayload, setActiveLogPayload] = useState<AIUsageLog | null>(null);

  // Form Handlers
  const handleSaveProvider = () => {
    if (editingProviderId) {
      updateProviderMutation.mutate({ id: editingProviderId, updates: providerForm });
    } else {
      createProviderMutation.mutate(providerForm);
    }
    setShowProviderModal(false);
    setEditingProviderId(null);
    setProviderForm({ name: '', displayName: '', costPerInputToken: 0, costPerOutputToken: 0, supportedModels: [], apiKey: '', baseUrl: '', isActive: true });
  };

  const handleEditProvider = (prov: AIProvider) => {
    setEditingProviderId(prov._id);
    setProviderForm({ ...prov });
    setShowProviderModal(true);
  };

  const handleSavePrompt = () => {
    createPromptMutation.mutate(promptForm);
    setShowPromptModal(false);
    setPromptForm({ key: '', template: '', description: '', requiredVariables: [] });
  };

  return (
    <div className="sys-page">
      <header className="sys-header">
        <div>
          <span className="sys-eyebrow">Enterprise Core</span>
          <h1>AI Gateway Console</h1>
          <p>Orchestrate language model providers, prompt templates, rate limit limits, caching, and token usage audit logs.</p>
        </div>
      </header>

      {/* Tabs */}
      <nav className="sys-tabs">
        <button aria-selected={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview & Health</button>
        <button aria-selected={activeTab === 'providers'} onClick={() => setActiveTab('providers')}>AI Providers</button>
        <button aria-selected={activeTab === 'prompts'} onClick={() => setActiveTab('prompts')}>Prompt Templates</button>
        <button aria-selected={activeTab === 'logs'} onClick={() => setActiveTab('logs')}>Audit Logs</button>
        <button aria-selected={activeTab === 'config'} onClick={() => setActiveTab('config')}>Configuration</button>
      </nav>

      {/* Overview & Health Tab */}
      {activeTab === 'overview' && (
        <section style={{ animation: 'sys-in 0.35s ease both' }}>
          <div className="sys-metrics" style={{ marginTop: '24px' }}>
            <article className="sys-metric--lead">
              <span>Primary Engine Status</span>
              <strong>{config?.primaryProvider.toUpperCase() ?? 'GEMINI'}</strong>
              <small>Fallbacks: {config?.fallbackProvider?.toUpperCase() ?? 'None'}</small>
            </article>
            <article>
              <span>Platform Health</span>
              <strong className={health?.databaseState === 'connected' ? 'sys-status--good' : 'sys-status--bad'}>
                {health?.databaseState === 'connected' ? 'ACTIVE' : 'OFFLINE'}
              </strong>
              <small>Database: {health?.databaseState ?? 'Checking...'}</small>
            </article>
            <article>
              <span>Token Caching</span>
              <strong>{health?.totalCacheSize ?? 0}</strong>
              <small>Total Cached Responses</small>
            </article>
            <article>
              <span>Rate Limits (24h)</span>
              <strong className={security?.rateLimitsTriggered24h ? 'sys-status--warn' : 'sys-status--good'}>
                {security?.rateLimitsTriggered24h ?? 0}
              </strong>
              <small>Throttled Requests</small>
            </article>
            <article>
              <span>Injection Blocks (24h)</span>
              <strong className={security?.potentialPromptInjections24h ? 'sys-status--bad' : 'sys-status--good'}>
                {security?.potentialPromptInjections24h ?? 0}
              </strong>
              <small>Potential Injections Filtered</small>
            </article>
            <article>
              <span>Avg Latency</span>
              <strong>{health?.recentStats?.averageLatencyMs ?? 0}ms</strong>
              <small>Across recent calls</small>
            </article>
            <article>
              <span>Error Rate</span>
              <strong className={health?.recentStats?.errorRatePercent && health.recentStats.errorRatePercent > 5 ? 'sys-status--bad' : 'sys-status--good'}>
                {health?.recentStats?.errorRatePercent ?? 0}%
              </strong>
              <small>Last 60 minutes</small>
            </article>
          </div>
        </section>
      )}

      {/* Providers Tab */}
      {activeTab === 'providers' && (
        <section style={{ animation: 'sys-in 0.35s ease both' }}>
          <div className="sys-toolbar">
            <h2>Configured AI Providers</h2>
            <Button onClick={() => setShowProviderModal(true)}>Add Provider</Button>
          </div>

          <div className="sys-table-wrap">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Key</th>
                  <th>Status</th>
                  <th>Input Cost / 1K</th>
                  <th>Output Cost / 1K</th>
                  <th>Supported Models</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers?.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <strong>{p.displayName}</strong>
                      <small>{p.baseUrl || 'Default Base URL'}</small>
                    </td>
                    <td className="sys-mono">{p.name}</td>
                    <td>
                      <span className={`sys-status sys-status--${p.isActive ? 'good' : 'neutral'}`}>
                        <i></i> {p.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="sys-mono">${(p.costPerInputToken * 1000).toFixed(4)}</td>
                    <td className="sys-mono">${(p.costPerOutputToken * 1000).toFixed(4)}</td>
                    <td>{p.supportedModels.join(', ')}</td>
                    <td className="sys-row-actions">
                      <button className="sys-button sys-button--quiet" onClick={() => handleEditProvider(p)}>Edit</button>
                      <button className="sys-button sys-button--danger" onClick={() => deleteProviderMutation.mutate(p._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {(!providers || providers.length === 0) && (
                  <tr>
                    <td colSpan={7} className="sys-state">No custom providers configured. Using hardcoded Gemini system defaults.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Prompt Templates Tab */}
      {activeTab === 'prompts' && (
        <section style={{ animation: 'sys-in 0.35s ease both' }}>
          <div className="sys-toolbar">
            <h2>System Prompt Library</h2>
            <Button onClick={() => setShowPromptModal(true)}>New Version</Button>
          </div>

          <div className="sys-table-wrap">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>Prompt Key</th>
                  <th>Version</th>
                  <th>Variables</th>
                  <th>Template Preview</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {prompts?.map((pr) => (
                  <tr key={pr._id}>
                    <td>
                      <strong>{pr.key}</strong>
                      <small>{pr.description || 'No description provided'}</small>
                    </td>
                    <td className="sys-mono">v{pr.version}</td>
                    <td className="sys-mono">{pr.requiredVariables.join(', ') || 'None'}</td>
                    <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="sys-mono">
                      {pr.template}
                    </td>
                    <td>
                      <span className={`sys-status sys-status--${pr.isActive ? 'good' : 'neutral'}`}>
                        <i></i> {pr.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="sys-row-actions">
                      {!pr.isActive && (
                        <button className="sys-button sys-button--quiet" onClick={() => activatePromptMutation.mutate({ key: pr.key, version: pr.version })}>
                          Make Active
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!prompts || prompts.length === 0) && (
                  <tr>
                    <td colSpan={6} className="sys-state">No custom prompts stored in database. Using system-wide default prompt configurations.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'logs' && (
        <section style={{ animation: 'sys-in 0.35s ease both' }}>
          <div className="sys-toolbar">
            <h2>AI Execution Logs & Auditing</h2>
          </div>

          <div className="sys-table-wrap">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Prompt Key</th>
                  <th>Model / Provider</th>
                  <th>Duration</th>
                  <th>Token Usage</th>
                  <th>Estimated Cost</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs?.map((log) => (
                  <tr key={log._id}>
                    <td className="sys-mono">{new Date(log.createdAt).toLocaleTimeString()}</td>
                    <td>
                      <strong>{log.promptKey || 'Raw Input'}</strong>
                      <small>
                        User: {log.user?.fullName || 'System'} | Company: {log.company?.name || 'Global'}
                      </small>
                    </td>
                    <td>
                      {log.providerName.toUpperCase()}
                      <small className="sys-mono">{log.modelName}</small>
                    </td>
                    <td className="sys-mono">{log.durationMs}ms</td>
                    <td className="sys-mono">
                      In: {log.tokensInput} / Out: {log.tokensOutput}
                    </td>
                    <td className="sys-mono">${log.cost.toFixed(6)}</td>
                    <td>
                      <span className={`sys-status sys-status--${log.status === 'success' ? 'good' : 'bad'}`}>
                        <i></i> {log.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="sys-row-actions">
                      <button className="sys-button sys-button--quiet" onClick={() => setActiveLogPayload(log)}>Inspect Payload</button>
                    </td>
                  </tr>
                ))}
                {(!logs || logs.length === 0) && (
                  <tr>
                    <td colSpan={8} className="sys-state">No execution logs logged. Perform AI tasks to populate logs.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <section style={{ animation: 'sys-in 0.35s ease both', marginTop: '24px' }}>
          <div className="sys-detail">
            <h2>Gateway Settings</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updates = {
                  primaryProvider: formData.get('primaryProvider') as string,
                  fallbackProvider: (formData.get('fallbackProvider') as string) || null,
                  cachingEnabled: formData.get('cachingEnabled') === 'true',
                  cacheTtlSeconds: Number(formData.get('cacheTtlSeconds')),
                  retryCount: Number(formData.get('retryCount')),
                  retryBackoffMs: Number(formData.get('retryBackoffMs')),
                  promptInjectionFiltersEnabled: formData.get('promptInjectionFiltersEnabled') === 'true',
                  rateLimits: {
                    requestsPerMinute: Number(formData.get('requestsPerMinute')),
                    tokensPerMinute: Number(formData.get('tokensPerMinute'))
                  }
                };
                updateConfigMutation.mutate(updates);
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBlock: '20px' }}>
                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Primary Provider
                  <select name="primaryProvider" defaultValue={config?.primaryProvider}>
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI (Future)</option>
                    <option value="claude">Anthropic Claude (Future)</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Fallback Provider
                  <select name="fallbackProvider" defaultValue={config?.fallbackProvider || ''}>
                    <option value="">None</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI (Future)</option>
                    <option value="claude">Anthropic Claude (Future)</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Caching
                  <select name="cachingEnabled" defaultValue={config?.cachingEnabled ? 'true' : 'false'}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Cache TTL (Seconds)
                  <input type="number" name="cacheTtlSeconds" defaultValue={config?.cacheTtlSeconds || 3600} />
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Max Retries
                  <input type="number" name="retryCount" defaultValue={config?.retryCount || 3} />
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Retry Base Backoff (ms)
                  <input type="number" name="retryBackoffMs" defaultValue={config?.retryBackoffMs || 1000} />
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Prompt Injection Filters
                  <select name="promptInjectionFiltersEnabled" defaultValue={config?.promptInjectionFiltersEnabled ? 'true' : 'false'}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Rate Limits (Requests per Min)
                  <input type="number" name="requestsPerMinute" defaultValue={config?.rateLimits?.requestsPerMinute || 60} />
                </label>

                <label style={{ display: 'grid', gap: '7px', fontWeight: 'bold' }}>
                  Rate Limits (Tokens per Min)
                  <input type="number" name="tokensPerMinute" defaultValue={config?.rateLimits?.tokensPerMinute || 100000} />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <Button type="submit">Save Configurations</Button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Provider Edit Modal */}
      {showProviderModal && (
        <div className="sys-dialog-backdrop">
          <div className="sys-dialog">
            <h2>{editingProviderId ? 'Edit AI Provider' : 'Add AI Provider'}</h2>
            <div style={{ display: 'grid', gap: '15px', marginTop: '16px' }}>
              <label>
                Provider Key (Unique lowercase ID)
                <input
                  type="text"
                  placeholder="e.g. gemini, openai"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  disabled={!!editingProviderId}
                />
              </label>

              <label>
                Display Label
                <input
                  type="text"
                  placeholder="e.g. Google Gemini Engine"
                  value={providerForm.displayName}
                  onChange={(e) => setProviderForm({ ...providerForm, displayName: e.target.value })}
                />
              </label>

              <label>
                API Key (Selectively stored)
                <input
                  type="password"
                  placeholder="Insert Key"
                  value={providerForm.apiKey || ''}
                  onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
                />
              </label>

              <label>
                Custom API Base URL (Optional)
                <input
                  type="text"
                  placeholder="e.g. https://generativelanguage.googleapis.com/v1beta"
                  value={providerForm.baseUrl || ''}
                  onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Input cost per Token
                  <input
                    type="number"
                    step="any"
                    value={providerForm.costPerInputToken || 0}
                    onChange={(e) => setProviderForm({ ...providerForm, costPerInputToken: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Output cost per Token
                  <input
                    type="number"
                    step="any"
                    value={providerForm.costPerOutputToken || 0}
                    onChange={(e) => setProviderForm({ ...providerForm, costPerOutputToken: Number(e.target.value) })}
                  />
                </label>
              </div>

              <label>
                Supported Models (Comma-separated)
                <input
                  type="text"
                  placeholder="e.g. gemini-2.5-flash, gemini-2.5-pro"
                  value={providerForm.supportedModels?.join(', ') || ''}
                  onChange={(e) => setProviderForm({ ...providerForm, supportedModels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={!!providerForm.isActive}
                  onChange={(e) => setProviderForm({ ...providerForm, isActive: e.target.checked })}
                />
                Active & Available for Routing
              </label>
            </div>

            <footer>
              <button className="sys-button sys-button--quiet" onClick={() => setShowProviderModal(false)}>Cancel</button>
              <Button onClick={handleSaveProvider}>Save Provider</Button>
            </footer>
          </div>
        </div>
      )}

      {/* Prompt Create Modal */}
      {showPromptModal && (
        <div className="sys-dialog-backdrop">
          <div className="sys-dialog">
            <h2>Add Prompt Template Version</h2>
            <div style={{ display: 'grid', gap: '15px', marginTop: '16px' }}>
              <label>
                Prompt Key
                <input
                  type="text"
                  placeholder="e.g. generate_job_description"
                  value={promptForm.key}
                  onChange={(e) => setPromptForm({ ...promptForm, key: e.target.value })}
                />
              </label>

              <label>
                Template Description
                <input
                  type="text"
                  placeholder="Purpose of this prompt"
                  value={promptForm.description}
                  onChange={(e) => setPromptForm({ ...promptForm, description: e.target.value })}
                />
              </label>

              <label>
                Required variables (Comma-separated)
                <input
                  type="text"
                  placeholder="e.g. title, keyRequirements"
                  value={promptForm.requiredVariables?.join(', ') || ''}
                  onChange={(e) => setPromptForm({ ...promptForm, requiredVariables: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </label>

              <label>
                Prompt Template Body
                <textarea
                  placeholder="Write prompt using {{variableName}} placeholders"
                  value={promptForm.template}
                  onChange={(e) => setPromptForm({ ...promptForm, template: e.target.value })}
                />
              </label>
            </div>

            <footer>
              <button className="sys-button sys-button--quiet" onClick={() => setShowPromptModal(false)}>Cancel</button>
              <Button onClick={handleSavePrompt}>Save Prompt Version</Button>
            </footer>
          </div>
        </div>
      )}

      {/* Payload Inspection Modal */}
      {activeLogPayload && (
        <div className="sys-dialog-backdrop">
          <div className="sys-dialog" style={{ width: 'min(820px, 95%)' }}>
            <h2>Inspect AI Request Payload</h2>
            
            <div style={{ display: 'grid', gap: '15px', marginTop: '16px', maxHeight: '520px', overflowY: 'auto' }}>
              <div>
                <strong>Prompt Template Key:</strong> <span className="sys-mono">{activeLogPayload.promptKey || 'Raw String Input'}</span>
              </div>
              <div>
                <strong>Variables & Inputs Passed:</strong>
                <pre className="sys-mono" style={{ background: 'var(--color-surface-secondary)', padding: '12px', overflow: 'auto', border: '1px solid var(--color-border-default)' }}>
                  {JSON.stringify(activeLogPayload.requestPayload || {}, null, 2)}
                </pre>
              </div>

              <div>
                <strong>AI Provider Response Text:</strong>
                <pre className="sys-mono" style={{ background: 'var(--color-surface-secondary)', padding: '12px', overflow: 'auto', border: '1px solid var(--color-border-default)', whiteSpace: 'pre-wrap' }}>
                  {activeLogPayload.errorMessage ? `Error: ${activeLogPayload.errorMessage}` : activeLogPayload.responsePayload || ''}
                </pre>
              </div>
            </div>

            <footer>
              <button className="sys-button" onClick={() => setActiveLogPayload(null)}>Close Inspection</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
export default AIConsolePage;
