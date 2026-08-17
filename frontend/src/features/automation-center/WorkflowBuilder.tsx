import React, { useState } from 'react';

export const WorkflowBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<any[]>([
    { id: '1', label: 'Resume Uploaded', type: 'trigger' },
    { id: '2', label: 'Resume Intelligence Parser', type: 'action' },
    { id: '3', label: 'Advance Stage', type: 'action' }
  ]);
  const [workflowName, setWorkflowName] = useState('Campus Technical Screening');

  const addNode = (type: string) => {
    const label = type === 'action' ? 'New Action Node' : 'New Branch Node';
    setNodes(prev => [...prev, { id: String(prev.length + 1), label, type }]);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'sans-serif', background: 'var(--color-canvas)' }}>
      {/* Sidebar - Node Library */}
      <div style={{ width: '280px', borderRight: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-1)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-text-strong)' }}>Node Library</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div onClick={() => addNode('action')} style={{ padding: '12px', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-info-fg)', fontWeight: 'bold' }}>
            + Add Action Node
          </div>
          <div onClick={() => addNode('branch')} style={{ padding: '12px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-warning-fg)', fontWeight: 'bold' }}>
            + Add Condition Node
          </div>
        </div>
      </div>

      {/* Main Builder Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: 'var(--color-surface-1)', padding: '16px 24px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            style={{ border: 'none', fontSize: '20px', fontWeight: 'bold', color: 'var(--color-text-strong)', outline: 'none' }}
          />
          <button style={{ background: 'var(--color-success-fg)', color: 'var(--color-text-inverse)', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Publish Workflow
          </button>
        </div>

        {/* Nodes Canvas Grid */}
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', position: 'relative' }}>
          {nodes.map((node, index) => (
            <React.Fragment key={node.id}>
              {index > 0 && (
                <div style={{ width: '2px', height: '30px', background: 'var(--color-border-default)', position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '10px', height: '10px', borderLeft: '2px solid var(--color-border-default)', borderBottom: '2px solid var(--color-border-default)', transform: 'rotate(-45deg)' }} />
                </div>
              )}
              <div
                style={{
                  width: '260px',
                  background: 'var(--color-surface-1)',
                  border: `2px solid ${node.type === 'trigger' ? 'var(--color-action-primary)' : node.type === 'action' ? 'var(--color-success-fg)' : 'var(--color-warning-fg)'}`,
                  borderRadius: '8px',
                  padding: '16px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                    {node.type}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-strong)', fontWeight: 'bold' }}>{node.label}</span>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
