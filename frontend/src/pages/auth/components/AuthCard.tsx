import { type ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-start">
      {children}
    </div>
  );
}
