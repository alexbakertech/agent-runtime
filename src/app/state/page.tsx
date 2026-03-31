'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAppState } from '@/lib/state';
import { createExportOptions, getExportSummary } from '@/lib/state/export';
import type { ExportOptions, AppState } from '@/lib/state/types';

function maskApiKeys(state: AppState): AppState {
  return {
    ...state,
    profiles: state.profiles.map(p => ({
      ...p,
      apiKey: p.apiKey ? '••••••••' + p.apiKey.slice(-4) : '',
    })),
  };
}

export default function StatePage() {
  const { state, downloadExportFile, previewImportData, applyImportData, resetToDefaults } = useAppState();
  
  const [exportOptions, setExportOptions] = useState<ExportOptions>(createExportOptions());
  const [importJson, setImportJson] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  
  const maskedState = useMemo(() => maskApiKeys(state), [state]);
  
  const exportPreview = useMemo(() => {
    return getExportSummary(state, exportOptions);
  }, [state, exportOptions]);

  const handleExport = useCallback(() => {
    downloadExportFile(exportOptions);
  }, [downloadExportFile, exportOptions]);

  const handleImport = useCallback(() => {
    if (!importJson.trim()) return;
    
    const success = applyImportData(importJson);
    setImportStatus(success ? 'success' : 'error');
    if (success) {
      setImportJson('');
      setTimeout(() => setImportStatus('idle'), 2000);
    }
  }, [importJson, applyImportData]);

  const handleReset = useCallback(() => {
    resetToDefaults(true);
    setShowResetConfirm(false);
  }, [resetToDefaults]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
    };
    reader.readAsText(file);
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>State</h1>
      <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '2rem' }}>
        Export and import runtime bundles, tool bundles, and profiles.
      </p>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>Export Bundle</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportOptions.includeProfiles} onChange={(e) => setExportOptions(prev => ({ ...prev, includeProfiles: e.target.checked }))} />
              <span>Runtimes (runtime definitions)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportOptions.includeSandboxTools} onChange={(e) => setExportOptions(prev => ({ ...prev, includeSandboxTools: e.target.checked }))} />
              <span>Tools (tool definitions)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportOptions.includeProfiles} onChange={(e) => setExportOptions(prev => ({ ...prev, includeProfiles: e.target.checked }))} />
              <span>Profiles (API configurations)</span>
            </label>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>{exportPreview}</p>
          
          <button 
            onClick={handleExport}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Download Bundle
          </button>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>Import Bundle</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileUpload} 
              style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }} 
            />
          </div>

          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Or paste JSON bundle here..."
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              resize: 'vertical',
              marginBottom: '1rem',
            }}
          />

          <button 
            onClick={handleImport}
            disabled={!importJson.trim()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: importJson.trim() ? '#10b981' : '#cbd5e1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: importJson.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {importStatus === 'success' ? 'Imported!' : importStatus === 'error' ? 'Invalid JSON' : 'Import Bundle'}
          </button>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>Raw Inspector</h2>
          
          <button 
            onClick={() => setShowRaw(!showRaw)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#fff',
              color: '#1e293b',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showRaw ? 'Hide Raw State' : 'Show Raw State'}
          </button>

          {showRaw && (
            <pre style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: '#1e293b', 
              color: '#e2e8f0', 
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: '300px',
              whiteSpace: 'pre-wrap',
            }}>
              {JSON.stringify(maskedState, null, 2)}
            </pre>
          )}
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #fecaca', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem', color: '#ef4444' }}>Reset</h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
            Reset runtime definitions, tools, and state while keeping profiles.
          </p>
          
          {!showResetConfirm ? (
            <button 
              onClick={() => setShowResetConfirm(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset to Defaults
            </button>
          ) : (
            <div>
              <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Are you sure?</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handleReset}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Confirm Reset
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
