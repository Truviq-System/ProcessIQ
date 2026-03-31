import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

const CSS_IMPORTS = [
  import('bpmn-js/dist/assets/diagram-js.css'),
  import('bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'),
  import('bpmn-js/dist/assets/bpmn-js.css'),
];

const BpmnEditor = forwardRef(function BpmnEditor({ xml }, ref) {
  const containerRef = useRef(null);
  const modelerRef   = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useImperativeHandle(ref, () => ({
    async getXml() {
      if (!modelerRef.current) return xml;
      const { xml: exported } = await modelerRef.current.saveXML({ format: true });
      return exported;
    },
  }));

  useEffect(() => {
    if (!xml || !containerRef.current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([import('bpmn-js/lib/Modeler'), ...CSS_IMPORTS])
      .then(([{ default: BpmnModeler }]) => {
        if (cancelled || !containerRef.current) return;
        if (modelerRef.current) { modelerRef.current.destroy(); modelerRef.current = null; }
        const modeler = new BpmnModeler({ container: containerRef.current });
        modelerRef.current = modeler;
        return modeler.importXML(xml);
      })
      .then(() => {
        if (cancelled) return;
        const canvas = modelerRef.current?.get('canvas');
        if (canvas) canvas.zoom('fit-viewport', 'auto');
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(`Failed to load editor: ${err.message}`);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (modelerRef.current) { modelerRef.current.destroy(); modelerRef.current = null; }
    };
  }, [xml]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '520px' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {(loading || error) && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-raised)',
        }}>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading editor…</p>}
          {error   && <p style={{ color: 'var(--danger)' }}>⚠ {error}</p>}
        </div>
      )}
    </div>
  );
});

export default BpmnEditor;
