export function AuthFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full text-center text-xs text-slate-400 select-none mt-8 border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <span>&copy; {currentYear} Talvix. All rights reserved.</span>
      <div className="flex gap-2.5 text-[11px] text-slate-400 font-medium">
        <span>Privacy Policy</span>
        <span className="text-slate-200 select-none" aria-hidden="true">&bull;</span>
        <span>Terms of Service</span>
      </div>
    </footer>
  );
}
