'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAppState } from '@/lib/state';
import { createExportOptions, getExportSummary } from '@/lib/state/export';
import type { ExportOptions, ImportPreview, AppState } from '@/lib/state/types';

function maskApiKeys(state: AppState): AppState {
  return {
    ...state,
    profiles: state.profiles.map(p => ({
      ...p,
      apiKey: p.apiKey ? '••••••••' + p.apiKey.slice(-4) : '',
    })),
  };
}

export default function ExportPage() {
  const { state, downloadExportFile, previewImportData, applyImportData, resetToDefaults } = useAppState();
  
  const [exportOptions, setExportOptions] = useState<ExportOptions>(createExportOptions());
  const [importJson, setImportJson] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  
  const maskedState = useMemo(() => maskApiKeys(state), [state]);
  
  const exportPreview = useMemo(() => {
    return getExportSummary(state, exportOptions);
  }, [state, exportOptions]);

  const handleExport = useCallback(() => {
    downloadExportFile(exportOptions);
  }, [downloadExportFile, exportOptions]);

  const handlePreviewImport = useCallback(() => {
    const preview = previewImportData(importJson);
    if (preview) {
      setImportPreview(preview);
      setImportError(null);
    } else {
      setImportPreview(null);
      setImportError('Invalid JSON or missing required fields');
    }
  }, [importJson, previewImportData]);

  const handleApplyImport = useCallback(() => {
    if (applyImportData(importJson)) {
      setImportJson('');
      setImportPreview(null);
      setImportError(null);
    } else {
      setImportError('Failed to apply import');
    }
  }, [importJson, applyImportData]);

  const handleCopy = useCallback(() => {
    const dataToCopy = editedJson || JSON.stringify(maskedState, null, 2);
    navigator.clipboard.writeText(dataToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedJson, maskedState]);

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      try {
        JSON.parse(editedJson);
        setImportJson(editedJson);
        setIsEditing(false);
      } catch {
        setImportError('Invalid JSON');
      }
    } else {
      setEditedJson(JSON.stringify(maskedState, null, 2));
      setIsEditing(true);
    }
  }, [isEditing, editedJson, maskedState]);

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
      setEditedJson(content);
    };
    reader.readAsText(file);
  }, []);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '320px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem', color: '#64748b' }}>EXPORT OPTIONS</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportOptions.includeProfiles} onChange={(e) => setExportOptions(prev => ({ ...prev, includeProfiles: e.target.checked }))} />
              <span style={{ fontSize: '0.85rem' }}>Include profiles (API keys excluded)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportOptions.includeGlobalSettings} onChange={(e) => setExportOptions(prev => ({ ...prev, includeGlobalSettings: e.target.checked }))} />
              <span style={{ fontSize: '0.85rem' }}>Include global settings</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportOptions.includeContextEngine} onChange={(e) => setExportOptions(prev => ({ ...prev, includeContextEngine: e.target.checked }))} />
              <span style={{ fontSize: '0.85rem' }}>Include context engine state</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportOptions.includeSandboxTools} onChange={(e) => setExportOptions(prev => ({ ...prev, includeSandboxTools: e.target.checked }))} />
              <span style={{ fontSize: '0.85rem' }}>Include sandbox tool definitions</span>
            </label>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', marginBottom: '1rem' }}>{exportPreview}</p>
          <button onClick={handleExport} style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Export to File</button>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem', color: '#64748b' }}>IMPORT</h2>
          <div style={{ marginBottom: '0.75rem' }}>
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ fontSize: '0.85rem' }} />
          </div>
          <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder="Or paste JSON here..." style={{ width: '100%', height: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.75rem', resize: 'vertical', boxSizing: 'border-box' }} />
          {importError && <p style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '0.5rem' }}>{importError}</p>}
          {importPreview && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '6px', fontSize: '0.7rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Import Preview:</p>
              {importPreview.newProfiles.length > 0 && <p>New profiles: {importPreview.newProfiles.map(p => p.name).join(', ')}</p>}
              {importPreview.updatedProfiles.length > 0 && <p>Updated profiles: {importPreview.updatedProfiles.map(p => p.name).join(', ')}</p>}
              {importPreview.globalSettingsChanged && <p>Global settings will be updated</p>}
              {importPreview.contextEngineChanged && <p>Context engine state will be updated</p>}
              {importPreview.sandboxChanged && <p>Sandbox state will be updated</p>}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button onClick={handlePreviewImport} disabled={!importJson.trim()} style={{ flex: 1, padding: '0.4rem', backgroundColor: importJson.trim() ? '#fff' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: importJson.trim() ? 'pointer' : 'not-allowed', fontSize: '0.75rem' }}>Preview</button>
            <button onClick={handleApplyImport} disabled={!importPreview?.valid} style={{ flex: 1, padding: '0.4rem', backgroundColor: importPreview?.valid ? '#0f172a' : '#f1f5f9', color: importPreview?.valid ? 'white' : '#94a3b8', border: 'none', borderRadius: '4px', cursor: importPreview?.valid ? 'pointer' : 'not-allowed', fontSize: '0.75rem' }}>Apply</button>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: '#64748b' }}>RESET</h2>
          <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.75rem' }}>Reset page states to defaults while keeping your profiles.</p>
          {!showResetConfirm ? (
            <button onClick={() => setShowResetConfirm(true)} style={{ width: '100%', padding: '0.4rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Reset to Defaults</button>
          ) : (
            <div>
              <p style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>Are you sure? This cannot be undone.</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleReset} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Confirm</button>
                <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>CURRENT STATE</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleEditToggle} style={{ padding: '0.3rem 0.5rem', backgroundColor: isEditing ? '#22c55e' : '#0f172a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>{isEditing ? 'Apply' : 'Edit'}</button>
              <button onClick={handleCopy} style={{ padding: '0.3rem 0.5rem', backgroundColor: '#0f172a', color: copied ? '#22c55e' : 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
          {isEditing ? (
            <textarea value={editedJson} onChange={(e) => setEditedJson(e.target.value)} style={{ width: '100%', height: 'calc(100vh - 280px)', padding: '0.5rem', backgroundColor: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.75rem', resize: 'none', boxSizing: 'border-box' }} />
          ) : (
            <pre style={{ margin: 0, padding: '0.5rem', backgroundColor: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'monospace', overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
              {JSON.stringify(maskedState, null, 2)}
            </pre>
          )}
        </div>
      </main>
    </div>
  );
}
