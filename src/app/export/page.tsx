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
  const { state, downloadExportFile, previewImportData, applyImportData, resetToDefaults, exportCurrentForRecovery } = useAppState();
  
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
      // Applying edits
      try {
        JSON.parse(editedJson);
        setImportJson(editedJson);
        setIsEditing(false);
      } catch {
        setImportError('Invalid JSON');
      }
    } else {
      // Start editing
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
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Export / Import / State Viewer</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>Configure export options, preview imports, and view the current application state.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
        {/* Left Column: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Export Options */}
          <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Export Options</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportOptions.includeProfiles}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeProfiles: e.target.checked }))}
                />
                <span>Include profiles (API keys excluded)</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportOptions.includeGlobalSettings}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeGlobalSettings: e.target.checked }))}
                />
                <span>Include global settings</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportOptions.includeContextEngine}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeContextEngine: e.target.checked }))}
                />
                <span>Include context engine state</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exportOptions.includeSandboxTools}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeSandboxTools: e.target.checked }))}
                />
                <span>Include sandbox tool definitions</span>
              </label>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', marginBottom: '1rem' }}>
              {exportPreview}
            </p>
            
            <button
              onClick={handleExport}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0f172a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Download Export
            </button>
          </div>
          
          {/* Import Section */}
          <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Import</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
            
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Or paste JSON here..."
              style={{
                width: '100%',
                height: '100px',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            
            {importError && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.5rem' }}>{importError}</p>
            )}
            
            {importPreview && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '8px', fontSize: '0.75rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Import Preview:</p>
                {importPreview.newProfiles.length > 0 && <p>New profiles: {importPreview.newProfiles.map(p => p.name).join(', ')}</p>}
                {importPreview.updatedProfiles.length > 0 && <p>Updated profiles: {importPreview.updatedProfiles.map(p => p.name).join(', ')}</p>}
                {importPreview.globalSettingsChanged && <p>Global settings will be updated</p>}
                {importPreview.contextEngineChanged && <p>Context engine state will be updated</p>}
                {importPreview.sandboxChanged && <p>Sandbox state will be updated</p>}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={handlePreviewImport}
                disabled={!importJson.trim()}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: importJson.trim() ? '#fff' : '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: importJson.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem',
                }}
              >
                Preview
              </button>
              <button
                onClick={handleApplyImport}
                disabled={!importPreview?.valid}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: importPreview?.valid ? '#0f172a' : '#f1f5f9',
                  color: importPreview?.valid ? 'white' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: importPreview?.valid ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem',
                }}
              >
                Apply
              </button>
            </div>
          </div>
          
          {/* Reset */}
          <div style={{ backgroundColor: '#fef2f2', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fecaca' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Reset</h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
              Reset page states to defaults while keeping your profiles.
            </p>
            
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Reset to Defaults
              </button>
            ) : (
              <div>
                <p style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Are you sure? This cannot be undone.</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleReset}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
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
        
        {/* Right Column: JSON Viewer */}
        <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>Current State (JSON)</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleEditToggle}
                style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: isEditing ? '#22c55e' : '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                {isEditing ? 'Apply' : 'Edit'}
              </button>
              <button
                onClick={handleCopy}
                style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: '#334155',
                  color: copied ? '#22c55e' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          
          {isEditing ? (
            <textarea
              value={editedJson}
              onChange={(e) => setEditedJson(e.target.value)}
              style={{
                width: '100%',
                height: 'calc(100vh - 300px)',
                padding: '1rem',
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <pre style={{
              margin: 0,
              padding: '1rem',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: 'calc(100vh - 250px)',
            }}>
              {JSON.stringify(maskedState, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
