import { AppProviders } from './app/AppProviders';
import { AppRoutes } from './routing/AppRoutes';
export function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
