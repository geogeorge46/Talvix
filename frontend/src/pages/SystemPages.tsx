import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, PermissionState } from '../design-system';
export function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <div className="tvx-system-page">
      <PermissionState
        title="Wrong workspace"
        description="Your account does not have access to this workspace."
        action={
          <Button onClick={() => navigate('/')}>Go to my workspace</Button>
        }
      />
    </div>
  );
}
export function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <div className="tvx-system-page">
      <PermissionState
        title="Permission required"
        description="You do not have the required organization permission."
        action={<Button onClick={() => navigate(-1)}>Go back</Button>}
      />
    </div>
  );
}
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="tvx-system-page">
      <EmptyState
        title="Page not found"
        description="The page may have moved or the address may be incorrect."
        action={<Button onClick={() => navigate('/')}>Return home</Button>}
      />
    </div>
  );
}
export function WorkspacePlaceholder({
  title = 'Workspace ready',
}: {
  title?: string;
}) {
  return (
    <section className="tvx-workspace-placeholder">
      <p className="tvx-eyebrow">Talvix workspace</p>
      <h1>{title}</h1>
      <p>Feature content will be added in a later implementation phase.</p>
    </section>
  );
}
