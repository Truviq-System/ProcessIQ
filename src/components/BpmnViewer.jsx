import { useEffect, useRef, useState } from 'react';

function BpmnViewer({ xml, fileName }) {
  const containerRef = useRef(null);
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

        if (viewerRef.current) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }

        const viewer = new BpmnJsViewer({ container: containerRef.current });
        viewerRef.current = viewer;

        return viewer.importXML(xml);
      })
      .then((result) => {
        if (cancelled) return;
        if (result?.warnings?.length) {
          console.warn('BPMN import warnings:', result.warnings);
        }
        setLoading(false);
        setReady(true);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('BPMN render error:', err);
        setError(`Failed to render diagram: ${err.message || err}`);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [xml]);

  // Zoom only after the container is visible in the DOM
  useEffect(() => {
    if (!ready) return;
    const canvas = viewerRef.current?.get('canvas');
    if (canvas) canvas.zoom('fit-viewport', 'auto');
  }, [ready]);

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
    <div className="bpmn-viewer-wrapper">
      <div className="bpmn-viewer-toolbar">
        <h4>BPMN Diagram{fileName ? ` — ${fileName}` : ''}</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const canvas = viewerRef.current?.get('canvas');
              if (canvas) canvas.zoom('fit-viewport', 'auto');
            }}
          >
            Fit View
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const canvas = viewerRef.current?.get('canvas');
              if (canvas) {
                const current = canvas.zoom();
                canvas.zoom(current * 1.25);
              }
            }}
          >
            + Zoom
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const canvas = viewerRef.current?.get('canvas');
              if (canvas) {
                const current = canvas.zoom();
                canvas.zoom(current * 0.8);
              }
            }}
          >
            − Zoom
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
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
      </div>
    </div>
  );
}

export default BpmnViewer;
