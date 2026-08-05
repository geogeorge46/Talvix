import React, { useState, useEffect } from 'react';

export const ResumeIntelligenceDashboard: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Mock loading profile data for UI validation
    setTimeout(() => {
      setProfile({
        personalInfo: { fullName: 'Jane Doe', email: 'jane.doe@example.com', phone: '+1-555-0199' },
        professionalSummary: { headline: 'Senior React Developer' },
        skills: { technical: ['React', 'Node.js', 'TypeScript', 'Docker', 'GraphQL'] },
        metrics: { resumeScore: 88, technicalScore: 92, atsScore: 85 }
      });
      setVersions([
        { version: 2, createdAt: '2026-08-05T12:00:00Z' },
        { version: 1, createdAt: '2026-08-04T09:30:00Z' }
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    // Simulate upload response
    setTimeout(() => {
      setUploading(false);
      alert('Resume uploaded and parsing initiated in background!');
    }, 1000);
  };

  if (loading) {
    return <div style={{ padding: '24px', color: '#888' }}>Loading resume intelligence profile...</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>Resume Intelligence Dashboard</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        {/* Main Details Panel */}
        <div>
          {/* Upload Card */}
          <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Upload New Resume Version</h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <button
                type="submit"
                disabled={uploading}
                style={{
                  background: '#3182CE',
                  color: '#FFF',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {uploading ? 'Processing...' : 'Upload & Parse'}
              </button>
            </form>
          </div>

          {/* Profile Details */}
          {profile && (
            <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', color: '#2D3748' }}>{profile.personalInfo.fullName}</h3>
                  <p style={{ margin: '4px 0 0', color: '#718096' }}>{profile.professionalSummary.headline}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: '#718096' }}>{profile.personalInfo.email}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#718096' }}>{profile.personalInfo.phone}</p>
                </div>
              </div>

              <h4 style={{ fontSize: '16px', color: '#4A5568', marginBottom: '10px' }}>Technical Skills</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                {profile.skills.technical.map((sk: string) => (
                  <span key={sk} style={{ background: '#EBF8FF', color: '#2B6CB0', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500 }}>
                    {sk}
                  </span>
                ))}
              </div>

              <h4 style={{ fontSize: '16px', color: '#4A5568', marginBottom: '10px' }}>AI Match Scores</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ background: '#F7FAFC', padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3182CE' }}>{profile.metrics.resumeScore}</div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>Overall Score</div>
                </div>
                <div style={{ background: '#F7FAFC', padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38A169' }}>{profile.metrics.technicalScore}</div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>Technical Fit</div>
                </div>
                <div style={{ background: '#F7FAFC', padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#DD6B20' }}>{profile.metrics.atsScore}</div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>ATS Parser Score</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Versions Timeline */}
        <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Version Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {versions.map((ver) => (
              <div key={ver.version} style={{ borderLeft: '3px solid #3182CE', paddingLeft: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Version {ver.version}</div>
                <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '2px' }}>
                  {new Date(ver.createdAt).toLocaleString()}
                </div>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3182CE',
                    padding: 0,
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginTop: '6px',
                    textDecoration: 'underline'
                  }}
                  onClick={() => alert(`Restoring to Version ${ver.version}...`)}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
