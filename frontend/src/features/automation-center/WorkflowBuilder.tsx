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
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'sans-serif', background: '#F7FAFC' }}>
      {/* Sidebar - Node Library */}
      <div style={{ width: '280px', borderRight: '1px solid #E2E8F0', background: '#FFF', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#2D3748' }}>Node Library</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div onClick={() => addNode('action')} style={{ padding: '12px', background: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#2B6CB0', fontWeight: 'bold' }}>
            + Add Action Node
          </div>
          <div onClick={() => addNode('branch')} style={{ padding: '12px', background: '#FEFCBF', border: '1px solid #FAF089', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#B7791F', fontWeight: 'bold' }}>
            + Add Condition Node
          </div>
        </div>
      </div>

      {/* Main Builder Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: '#FFF', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            style={{ border: 'none', fontSize: '20px', fontWeight: 'bold', color: '#2D3748', outline: 'none' }}
          />
          <button style={{ background: '#38A169', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Publish Workflow
          </button>
        </div>

        {/* Nodes Canvas Grid */}
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', position: 'relative' }}>
          {nodes.map((node, index) => (
            <React.Fragment key={node.id}>
              {index > 0 && (
                <div style={{ width: '2px', height: '30px', background: '#CBD5E0', position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '10px', height: '10px', borderLeft: '2px solid #CBD5E0', borderBottom: '2px solid #CBD5E0', transform: 'rotate(-45deg)' }} />
                </div>
              )}
              <div
                style={{
                  width: '260px',
                  background: '#FFF',
                  border: `2px solid ${node.type === 'trigger' ? '#3182CE' : node.type === 'action' ? '#48BB78' : '#D69E2E'}`,
                  borderRadius: '8px',
                  padding: '16px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#A0AEC0', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                    {node.type}
                  </span>
                  <span style={{ fontSize: '14px', color: '#2D3748', fontWeight: 'bold' }}>{node.label}</span>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
