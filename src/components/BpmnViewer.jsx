import { useEffect, useRef, useState } from 'react';

function useBpmnViewer(xml, containerRef) {
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!xml || !containerRef.current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReady(false);

    Promise.all([
      import('bpmn-js/lib/Viewer'),
      import('bpmn-js/dist/assets/diagram-js.css'),
      import('bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'),
    ])
      .then(([{ default: BpmnJsViewer }]) => {
        if (cancelled || !containerRef.current) return;
        if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null; }
        const viewer = new BpmnJsViewer({ container: containerRef.current });
        viewerRef.current = viewer;
        return viewer.importXML(xml);
      })
      .then((result) => {
        if (cancelled) return;
        if (result?.warnings?.length) console.warn('BPMN import warnings:', result.warnings);
        setLoading(false);
        setReady(true);
      })
      .catch(err => {
        if (cancelled) return;
        setError(`Failed to render diagram: ${err.message || err}`);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null; }
    };
  }, [xml]);

  useEffect(() => {
    if (!ready) return;
    const canvas = viewerRef.current?.get('canvas');
    if (canvas) canvas.zoom('fit-viewport', 'auto');
  }, [ready]);

  const zoomIn = () => {
    const canvas = viewerRef.current?.get('canvas');
    if (canvas) canvas.zoom(canvas.zoom() * 1.25);
  };
  const zoomOut = () => {
    const canvas = viewerRef.current?.get('canvas');
    if (canvas) canvas.zoom(canvas.zoom() * 0.8);
  };
  const fitView = () => {
    const canvas = viewerRef.current?.get('canvas');
    if (canvas) canvas.zoom('fit-viewport', 'auto');
  };

  return { viewerRef, error, loading, ready, zoomIn, zoomOut, fitView };
}

function BpmnLightbox({ xml, fileName, onClose }) {
  const containerRef = useRef(null);
  const { error, loading, zoomIn, zoomOut, fitView } = useBpmnViewer(xml, containerRef);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bpmn-lightbox-overlay" onClick={onClose}>
      <div className="bpmn-lightbox-modal" onClick={e => e.stopPropagation()}>
        <div className="bpmn-lightbox-header">
          <span className="bpmn-lightbox-title">
            {fileName ? fileName : 'BPMN Diagram'}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={fitView}>Fit View</button>
            <button className="btn btn-secondary btn-sm" onClick={zoomOut}>− Zoom</button>
            <button className="btn btn-secondary btn-sm" onClick={zoomIn}>+ Zoom</button>
            <button className="bpmn-lightbox-close" onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <div ref={containerRef} className="bpmn-lightbox-canvas" />
          {(loading || error) && (
            <div className="bpmn-viewer-overlay">
              {loading && <p style={{ color: 'var(--text-muted)' }}>Rendering diagram...</p>}
              {error && (
                <>
                  <div className="bpmn-empty-icon">⚠</div>
                  <p style={{ color: 'var(--danger)' }}>{error}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bpmn-lightbox-footer">
          Scroll to zoom · Drag to pan · Press Esc to close
        </div>
      </div>
    </div>
  );
}

function BpmnViewer({ xml, fileName }) {
  const containerRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const { error, loading, zoomIn, zoomOut, fitView } = useBpmnViewer(xml, containerRef);

  if (!xml) {
    return (
      <div className="bpmn-viewer-wrapper">
        <div className="bpmn-empty">
          <div className="bpmn-empty-icon">◈</div>
          <p>No BPMN diagram attached to this process.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bpmn-viewer-wrapper">
        <div className="bpmn-viewer-toolbar">
          <h4>BPMN Diagram{fileName ? ` — ${fileName}` : ''}</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={fitView}>Fit View</button>
            <button className="btn btn-secondary btn-sm" onClick={zoomOut}>− Zoom</button>
            <button className="btn btn-secondary btn-sm" onClick={zoomIn}>+ Zoom</button>
            <button className="btn btn-primary btn-sm" onClick={() => setExpanded(true)} title="Open fullscreen">⛶ Expand</button>
          </div>
        </div>

        <div className="bpmn-viewer-preview-wrap" onClick={() => setExpanded(true)}>
          <div ref={containerRef} className="bpmn-viewer-container" />

          {(loading || error) && (
            <div className="bpmn-viewer-overlay">
              {loading && <p style={{ color: 'var(--text-muted)' }}>Rendering diagram...</p>}
              {error && (
                <>
                  <div className="bpmn-empty-icon">⚠</div>
                  <p style={{ color: 'var(--danger)' }}>{error}</p>
                </>
              )}
            </div>
          )}

          {!loading && !error && (
            <div className="bpmn-expand-hint">
              <span>⛶ Click to expand</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <BpmnLightbox xml={xml} fileName={fileName} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

export default BpmnViewer;
