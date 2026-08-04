import { useEffect, useState } from 'react';
import { Card, DataTable, Button, PageHeader, TextField } from '../../design-system';

export function BlueprintBuilder() {
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const fetchBlueprints = async () => {
    try {
      const res = await fetch('/api/v1/assessments/blueprints');
      const json = await res.json();
      if (json.success) {
        setBlueprints(json.data.blueprints);
      }
    } catch (err) {
      console.error('Failed to load blueprints', err);
    } finally {
      setLoading(false);
    }
  };

  const createBlueprint = async () => {
    if (!name) return;
    try {
      setLoading(true);
      await fetch('/api/v1/assessments/blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: desc,
          sections: [
            { name: 'Coding Evaluation', type: 'coding', questionCount: 1, difficulty: 'mixed' },
            { name: 'SQL Querying', type: 'sql', questionCount: 1, difficulty: 'mixed' }
          ],
          defaultDuration: 60,
          passingScore: 50
        })
      });
      setName('');
      setDesc('');
      await fetchBlueprints();
    } catch (err) {
      console.error('Failed to create blueprint', err);
      setLoading(false);
    }
  };

  const cloneBlueprint = async (id: string) => {
    try {
      setLoading(true);
      await fetch(`/api/v1/assessments/blueprints/${id}/clone`, { method: 'POST' });
      await fetchBlueprints();
    } catch (err) {
      console.error('Failed to clone blueprint', err);
      setLoading(false);
    }
  };

  const generateAssessment = async (id: string) => {
    try {
      setLoading(true);
      await fetch(`/api/v1/assessments/blueprints/${id}/generate`, { method: 'POST' });
      alert('Assessment successfully generated in Draft state from the blueprint sections!');
    } catch (err) {
      console.error('Failed to generate assessment', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlueprints();
  }, []);

  return (
    <div className="as-page">
      <PageHeader
        title="Assessment Blueprint Library"
        description="Design reusable structural blueprint templates and generate complete assessments from section criteria."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginTop: '20px' }}>
        <Card heading="New Blueprint Designer" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TextField
              label="Blueprint Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Backend Engineer Blueprint"
            />
            <TextField
              label="Description"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Structure specifications..."
            />
            <Button onClick={createBlueprint} disabled={loading || !name}>
              Create Blueprint Template
            </Button>
          </div>
        </Card>

        <Card heading="Templates & Blueprints" headingLevel={2}>
          {loading ? (
            <div>Loading blueprints...</div>
          ) : (
            <DataTable
              caption="Available blueprint definitions"
              rows={blueprints}
              rowKey={(row) => row._id}
              columns={[
                {
                  id: 'name',
                  header: 'Name',
                  render: (row) => (
                    <div>
                      <strong>{row.name}</strong>
                      <br />
                      <small>{row.description || 'No description'}</small>
                    </div>
                  )
                },
                {
                  id: 'duration',
                  header: 'Duration',
                  render: (row) => <span>{row.defaultDuration} min</span>
                },
                {
                  id: 'sections',
                  header: 'Section Count',
                  render: (row) => <span>{row.sections?.length || 0} sections</span>
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="secondary" onClick={() => cloneBlueprint(row._id)}>
                        Clone
                      </Button>
                      <Button onClick={() => generateAssessment(row._id)}>
                        Generate Assessment
                      </Button>
                    </div>
                  )
                }
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
