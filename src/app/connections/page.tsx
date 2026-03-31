'use client';

import { useState, useCallback } from 'react';
import { useProfiles, useBrowserConsent, useRetryEnabled } from '@/lib/state';
import { testConnection, fetchModels, isBrowserConsentGiven, chatStreamWithReasoning } from '@/lib/api/client';

export default function ConnectionsPage() {
  const { profiles, activeProfile, addProfile, updateProfile, deleteProfile, setActiveProfile } = useProfiles();
  const { browserConsent, setBrowserConsent } = useBrowserConsent();
  const { retryEnabled, setRetryEnabled } = useRetryEnabled();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    model?: string;
    latency?: number;
    streamReceived?: boolean;
    reasoningReceived?: boolean;
    sample?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string>('');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

  const TEST_PROMPT = 'This is a test message, respond with "It works!" if you have received this.';

  const [formData, setFormData] = useState({
    name: '',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: '',
  });

  const handleCreate = () => {
    setFormData({
      name: '',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: '',
    });
    setAvailableModels([]);
    setFetchStatus('');
    setEditingId('new');
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    if (editingId && editingId !== 'new') {
      updateProfile(editingId, {
        name: formData.name,
        baseUrl: formData.baseUrl,
        model: formData.model,
        apiKey: formData.apiKey,
      });
    } else {
      addProfile(formData.name, formData.baseUrl, formData.model, formData.apiKey);
    }
    setEditingId(null);
  };

  const handleTest = async (profile: typeof profiles[0]) => {
    setTesting(true);
    setTestResult(null);
    setStreamingContent('');
    setStreamingReasoning('');
    setReasoningCollapsed(false);

    if (!isBrowserConsentGiven()) {
      setTestResult({
        success: false,
        message: 'Browser consent required. Enable "Allow browser-based API calls" in Settings.',
      });
      setTesting(false);
      return;
    }

    const config = {
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
    };

    const startTime = Date.now();
    let streamReceived = false;
    let reasoningReceived = false;
    let fullResponse = '';

    try {
      for await (const chunk of chatStreamWithReasoning(config, TEST_PROMPT)) {
        if (chunk.content) {
          streamReceived = true;
          fullResponse += chunk.content;
          setStreamingContent(prev => prev + chunk.content);
        }
        if (chunk.reasoning) {
          reasoningReceived = true;
          setStreamingReasoning(prev => prev + chunk.reasoning);
        }
      }

      const latency = Date.now() - startTime;

      setTestResult({
        success: true,
        message: 'Stream completed',
        model: profile.model,
        latency,
        streamReceived,
        reasoningReceived,
        sample: fullResponse,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Stream failed',
      });
    }

    setTesting(false);
  };

  const handleFetchModels = async (profile: { baseUrl: string; apiKey: string; model: string }) => {
    setFetchingModels(true);
    setAvailableModels([]);
    setFetchStatus('Fetching models...');

    const config = {
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
    };

    const result = await fetchModels(config);

    if (result.success && result.models) {
      const models = result.models;
      setAvailableModels(models);
      setFetchStatus(`Found ${models.length} models`);
      if (models.length === 1 && !formData.model) {
        setFormData(prev => ({ ...prev, model: models[0] }));
      }
    } else {
      if (result.error === 'BROWSER_CONSENT_REQUIRED') {
        setFetchStatus('Browser consent required. Enable in Settings.');
      } else {
        setFetchStatus(result.error || 'Failed to fetch models');
      }
    }

    setFetchingModels(false);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Connections</h1>
      <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '2rem' }}>
        Manage API profiles and test connectivity.
      </p>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Profiles</h2>
            <button 
              onClick={handleCreate}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + New Profile
            </button>
          </div>

          {editingId && (
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                  Profile Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My API Profile"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                  Base URL
                </label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                  Model
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {availableModels.length > 0 ? (
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      style={{ flex: 1, padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem' }}
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="e.g., gpt-4, claude-3"
                      style={{ flex: 1, padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  )}
                  <button 
                    onClick={() => handleFetchModels({
                      baseUrl: formData.baseUrl,
                      apiKey: formData.apiKey,
                      model: formData.model,
                    })}
                    disabled={fetchingModels || !formData.apiKey}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#fff',
                      color: '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: fetchingModels || !formData.apiKey ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {fetchingModels ? '...' : 'Fetch'}
                  </button>
                </div>
                {fetchStatus && (
                  <div style={{ fontSize: '0.75rem', color: fetchStatus.includes('Failed') || fetchStatus.includes('required') ? '#ef4444' : '#64748b', marginTop: '0.25rem' }}>
                    {fetchStatus}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handleSave}
                  disabled={!formData.name.trim()}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: formData.name.trim() ? '#10b981' : '#cbd5e1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: formData.name.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setAvailableModels([]);
                    setFetchStatus('');
                    setEditingId(null);
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: '#fff',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {profiles.map((profile) => (
              <div 
                key={profile.id}
                style={{
                  padding: '1rem',
                  backgroundColor: activeProfile?.id === profile.id ? '#eff6ff' : '#fff',
                  border: activeProfile?.id === profile.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{profile.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{profile.baseUrl} • {profile.model}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setActiveProfile(profile.id)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: activeProfile?.id === profile.id ? '#3b82f6' : '#fff',
                      color: activeProfile?.id === profile.id ? '#fff' : '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {activeProfile?.id === profile.id ? 'Active' : 'Set Active'}
                  </button>
                  <button 
                    onClick={() => handleTest(profile)}
                    disabled={testing}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: '#fff',
                      color: '#10b981',
                      border: '1px solid #bbf7d0',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: testing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Test
                  </button>
                  <button 
                    onClick={() => {
                      setFormData({
                        name: profile.name,
                        baseUrl: profile.baseUrl,
                        apiKey: profile.apiKey,
                        model: profile.model,
                      });
                      setAvailableModels([]);
                      setFetchStatus('');
                      setEditingId(profile.id);
                    }}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: '#fff',
                      color: '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`Delete profile "${profile.name}"?`)) {
                        deleteProfile(profile.id);
                      }
                    }}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: '#fff',
                      color: '#ef4444',
                      border: '1px solid #fee2e2',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {profiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              No profiles yet. Create one to get started.
            </div>
          )}
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>Streaming Smoke Test</h2>
          
          {!activeProfile ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              Set an active profile to test connection.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>PROMPT</div>
                <div style={{ fontSize: '0.85rem', color: '#334155' }}>{TEST_PROMPT}</div>
              </div>

              {testing && (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  Streaming...
                </div>
              )}

              {streamingReasoning && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: '6px' }}>
                  <button
                    onClick={() => setReasoningCollapsed(!reasoningCollapsed)}
                    style={{
                      fontSize: '0.65rem',
                      color: '#b45309',
                      fontWeight: 600,
                      marginBottom: '0.25rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {reasoningCollapsed ? '▶' : '▼'} REASONING
                  </button>
                  {!reasoningCollapsed && (
                    <div style={{ fontSize: '0.8rem', color: '#92400e', fontStyle: 'italic' }}>{streamingReasoning}</div>
                  )}
                </div>
              )}

              <div style={{ padding: '0.75rem', backgroundColor: streamingContent ? '#f0fdf4' : '#f8fafc', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.65rem', color: streamingContent ? '#15803d' : '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {testing ? 'RECEIVING RESPONSE...' : 'RESPONSE'}
                </div>
                <div style={{ fontSize: '0.85rem', color: streamingContent ? '#166534' : '#94a3b8' }}>
                  {streamingContent || 'Click Test to start...'}
                </div>
              </div>

              {testResult && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: testResult.success ? '#dcfce7' : '#fee2e2', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>STATUS</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: testResult.success ? '#16a34a' : '#ef4444' }}>
                        {testResult.message}
                      </div>
                    </div>
                    <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>LATENCY</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{testResult.latency}ms</div>
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>MODEL</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{testResult.model}</div>
                  </div>
                </>
              )}

              <button 
                onClick={() => handleTest(activeProfile)}
                disabled={testing}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: testing ? '#94a3b8' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: testing ? 'not-allowed' : 'pointer',
                }}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>Settings</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={browserConsent}
                onChange={(e) => setBrowserConsent(e.target.checked)}
              />
              Allow browser-based API calls (CORS)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={retryEnabled}
                onChange={(e) => setRetryEnabled(e.target.checked)}
              />
              Retry on failure
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
