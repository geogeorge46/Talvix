import React, { useState } from 'react';

export const AdminConsole: React.FC = () => {
  const [departments, setDepartments] = useState<string[]>(['Engineering', 'Marketing', 'Sales', 'Human Resources']);
  const [newDept, setNewDept] = useState('');
  const [quotas, setQuotas] = useState({
    aiTokens: 1000000,
    apiRequests: 50000,
    usersLimit: 50
  });

  const addDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept) return;
    setDepartments(prev => [...prev, newDept]);
    setNewDept('');
  };

  const handleQuotaChange = (field: string, val: number) => {
    setQuotas(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '8px' }}>Enterprise Administration Console</h2>
        <p style={{ color: '#718096', fontSize: '14px' }}>Configure multi-company hierarchies, custom roles permissions, and resource quotas.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Department Hierarchy */}
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#2D3748', fontSize: '18px' }}>Organization Hierarchy</h3>
          <form onSubmit={addDepartment} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <input
              type="text"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="e.g. Finance & Accounting"
              style={{ flex: 1, padding: '10px', border: '1px solid #CBD5E0', borderRadius: '6px', outline: 'none' }}
            />
            <button type="submit" style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '0 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              Add Unit
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {departments.map((dept, idx) => (
              <div key={idx} style={{ padding: '12px 16px', background: '#F7FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '14px', color: '#4A5568' }}>
                {dept}
              </div>
            ))}
          </div>
        </div>

        {/* Tenant Quotas */}
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#2D3748', fontSize: '18px' }}>Tenant Resources Quotas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: 'bold' }}>AI Monthly Token Limit</label>
              <input
                type="number"
                value={quotas.aiTokens}
                onChange={(e) => handleQuotaChange('aiTokens', parseInt(e.target.value))}
                style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E0', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: 'bold' }}>API Access Daily Quota</label>
              <input
                type="number"
                value={quotas.apiRequests}
                onChange={(e) => handleQuotaChange('apiRequests', parseInt(e.target.value))}
                style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E0', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: 'bold' }}>Max Active User Seats</label>
              <input
                type="number"
                value={quotas.usersLimit}
                onChange={(e) => handleQuotaChange('usersLimit', parseInt(e.target.value))}
                style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E0', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
