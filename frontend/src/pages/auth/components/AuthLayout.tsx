import { type ReactNode } from 'react';
import { AuthIllustration } from './AuthIllustration';

interface AuthLayoutProps {
  type: 'login' | 'register';
  children: ReactNode;
}

export function AuthLayout({ type, children }: AuthLayoutProps) {
  return (
    <div className="auth-page-root flex min-h-screen w-full items-center justify-center p-3 sm:p-5 lg:p-8">
      <div className="auth-container-card relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[28px] lg:flex-row shadow-xl border border-slate-200/90 bg-white items-stretch">
        {/* Left Side: 44% Dual-Image Visual & Social Proof Panel */}
        <div className="auth-illustration-bg relative hidden h-auto w-full shrink-0 overflow-hidden lg:block lg:w-[44%]">
          <div className="relative z-10 h-full w-full">
            <AuthIllustration type={type} />
          </div>
        </div>

        {/* Right Side: 56% Auth Form Panel - Aligned from the Top */}
        <div className="relative z-10 flex w-full flex-col items-center justify-start bg-white p-6 sm:p-8 lg:w-[56%] lg:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
