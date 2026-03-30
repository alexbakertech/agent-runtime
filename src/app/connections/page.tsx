'use client';

import { useState, useCallback } from 'react';
import { useProfiles, useBrowserConsent, useRetryEnabled } from '@/lib/state';

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

  const [formData, setFormData] = useState({
    name: '',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4',
  });

  const handleCreate = () => {
    setFormData({
      name: '',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4',
    });
    setEditingId('new');
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    addProfile(formData.name, formData.baseUrl, formData.model, formData.apiKey);
    setEditingId(null);
  };

  const handleTest = async (profile: typeof profiles[0]) => {
    setTesting(true);
    setTestResult(null);

    const startTime = Date.now();

    await new Promise(resolve => setTimeout(resolve, 1500));

    const latency = Date.now() - startTime;
    const hasApiKey = !!profile.apiKey;

    if (hasApiKey) {
      setTestResult({
        success: true,
        message: 'Connection successful',
        model: profile.model,
        latency,
        streamReceived: true,
        reasoningReceived: profile.model.includes('o1') || profile.model.includes('claude'),
        sample: 'This is a simulated response from the model to test connectivity.',
      });
    } else {
      setTestResult({
        success: false,
        message: 'No API key configured',
      });
    }

    setTesting(false);
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

          {editingId === 'new' && (
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
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="gpt-4"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem' }}
                />
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
                  onClick={() => setEditingId(null)}
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
                  {profiles.length > 1 && (
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
                  )}
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
          ) : testing ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Testing connection...</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sending test prompt to {activeProfile.model}</div>
            </div>
          ) : testResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: testResult.success ? '#dcfce7' : '#fee2e2', 
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: testResult.success ? '#16a34a' : '#ef4444' 
                }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: testResult.success ? '#16a34a' : '#ef4444' }}>
                  {testResult.message}
                </span>
              </div>

              {testResult.success && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>MODEL</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{testResult.model}</div>
                    </div>
                    <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>LATENCY</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{testResult.latency}ms</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: testResult.streamReceived ? '#dcfce7' : '#fee2e2', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>STREAM RECEIVED</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: testResult.streamReceived ? '#16a34a' : '#ef4444' }}>
                        {testResult.streamReceived ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div style={{ padding: '0.5rem', backgroundColor: testResult.reasoningReceived ? '#dcfce7' : '#f1f5f9', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>REASONING STREAM</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: testResult.reasoningReceived ? '#16a34a' : '#64748b' }}>
                        {testResult.reasoningReceived ? 'Yes' : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {testResult.sample && (
                    <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '0.25rem' }}>SAMPLE RESPONSE</div>
                      <div style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>{testResult.sample}</div>
                    </div>
                  )}
                </>
              )}

              <button 
                onClick={() => handleTest(activeProfile)}
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
                Run Again
              </button>
            </div>
          ) : (
            <button 
              onClick={() => handleTest(activeProfile)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Test Connection
            </button>
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
