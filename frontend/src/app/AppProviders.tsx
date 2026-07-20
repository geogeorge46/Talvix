import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastProvider } from '../design-system';
import { AuthProvider } from '../auth/AuthProvider';
import { AppErrorBoundary } from './AppErrorBoundary';
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) =>
              !(
                typeof error === 'object' &&
                error !== null &&
                'status' in error &&
                (error as { status: number }).status === 401
              ) && count < 1,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: false },
        },
      }),
  );
  const [router] = useState(() =>
    createBrowserRouter([
      {
        path: '*',
        element: (
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        ),
      },
    ]),
  );
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
