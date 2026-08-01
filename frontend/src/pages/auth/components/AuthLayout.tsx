import { type ReactNode } from 'react';
import { AuthIllustration } from './AuthIllustration';

interface AuthLayoutProps {
  type: 'login' | 'register';
  children: ReactNode;
}

export function AuthLayout({ type, children }: AuthLayoutProps) {
  return (
    <div className="auth-page-root p-4 sm:p-6 lg:p-10 w-full min-h-screen flex items-center justify-center bg-slate-50">
      <div className="auth-container-card w-full max-w-5xl bg-white rounded-[32px] overflow-hidden flex flex-col lg:flex-row shadow-2xl relative">
        
        {/* Left Side: 40% Illustration Panel */}
        <div className="relative w-full lg:w-[40%] h-[200px] sm:h-[240px] lg:h-auto lg:min-h-[780px] shrink-0 auth-illustration-bg overflow-hidden">
          
          {/* Render Vector Graphics Content */}
          <div className="relative z-10 h-full w-full">
            <AuthIllustration type={type} />
          </div>

          {/* Organic Curved Wave Divider Overlay (SVG) - Desktop (Right Edge) */}
          <div className="absolute top-0 bottom-0 -right-[1px] w-24 h-full pointer-events-none hidden lg:block text-white z-20">
            <svg viewBox="0 0 100 1000" preserveAspectRatio="none" className="h-full w-full fill-current">
              <path d="M 45 0 C 75 150, 100 350, 100 500 C 100 650, 75 850, 45 1000 L 100 1000 L 100 0 Z" />
            </svg>
          </div>

          {/* Organic Curved Wave Divider Overlay (SVG) - Mobile/Tablet (Bottom Edge) */}
          <div className="absolute left-0 right-0 -bottom-[1px] w-full h-10 pointer-events-none lg:hidden text-white z-20">
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="h-full w-full fill-current">
              <path d="M 0 45 C 300 45, 450 100, 500 100 C 550 100, 700 45, 1000 45 L 1000 100 L 0 100 Z" />
            </svg>
          </div>
        </div>

        {/* Right Side: 60% Auth Card Content */}
        <div className="w-full lg:w-[60%] flex items-center justify-center bg-white relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
