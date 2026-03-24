import { useEffect, useRef, useState } from 'react';

const DEFAULT_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

function BpmnEditor({ xml, fileName, onSave, onClose }) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [showSaveWarning, setShowSaveWarning] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    Promise.all([
      import('bpmn-js/lib/Modeler'),
      import('bpmn-js/dist/assets/diagram-js.css'),
      import('bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'),
      import('bpmn-js/dist/assets/bpmn-js.css'),
    ])
      .then(([{ default: BpmnModeler }]) => {
        if (cancelled) return;
        const modeler = new BpmnModeler({ container: containerRef.current });
        modelerRef.current = modeler;
        return modeler.importXML(xml || DEFAULT_BPMN);
      })
      .then(() => {
        if (cancelled) return;
        setLoading(false);
        setReady(true);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('BPMN modeler error:', err);
        setError('Failed to load diagram in editor.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = modelerRef.current?.get('canvas');
    if (canvas) canvas.zoom('fit-viewport', 'auto');
  }, [ready]);

  const handleSaveClick = () => {
    setShowSaveWarning(true);
  };

  const handleSaveConfirm = async () => {
    setShowSaveWarning(false);
    if (!modelerRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const { xml: exportedXml } = await modelerRef.current.saveXML({ format: true });
      await onSave(exportedXml, changeNotes.trim() || null);
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCancel = () => {
    setShowSaveWarning(false);
  };

  const handleFitView = () => {
    const canvas = modelerRef.current?.get('canvas');
    if (canvas) canvas.zoom('fit-viewport', 'auto');
  };

  return (
    <div className="bpmn-editor-overlay">
      <div className="bpmn-editor-modal">
        <div className="bpmn-editor-header">
          <h3>Edit BPMN Diagram{fileName ? ` — ${fileName}` : ''}</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleFitView}
              disabled={loading}
            >
              Fit View
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveClick}
              disabled={saving || loading}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 16px', color: 'var(--danger)', background: 'var(--danger-light)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)' }}>
          <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>What changed?</label>
          <input
            type="text"
            value={changeNotes}
            onChange={e => setChangeNotes(e.target.value)}
            placeholder="Describe your changes (optional)"
            style={{ flex: 1, fontSize: '13px', padding: '4px 8px' }}
          />
        </div>

        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div ref={containerRef} className="bpmn-editor-canvas" />
          {loading && (
            <div className="bpmn-viewer-overlay">
              <p>Loading editor...</p>
            </div>
          )}
        </div>
      </div>

      {showSaveWarning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '10px', padding: '28px 32px',
            maxWidth: '420px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Save Diagram Changes?</h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              You are about to overwrite the existing diagram. This action cannot be undone. Are you sure you want to save?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={handleSaveCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveConfirm}>Yes, Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BpmnEditor;
