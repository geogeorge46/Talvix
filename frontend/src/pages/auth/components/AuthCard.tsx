import { type ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto px-6 py-10 md:p-10 flex flex-col justify-center min-h-[500px] tvx-auth-card-content">
      {children}
    </div>
  );
}
