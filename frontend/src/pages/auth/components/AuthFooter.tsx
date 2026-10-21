export function AuthFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full text-center text-xs text-slate-500 select-none mt-4 border-t border-slate-200 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
      <span>&copy; {currentYear} Talvix. All rights reserved.</span>
      <div className="flex gap-2.5 text-[11px] text-slate-500 font-medium">
        <span>Privacy Policy</span>
        <span className="text-slate-300 select-none" aria-hidden="true">&bull;</span>
        <span>Terms of Service</span>
      </div>
    </footer>
  );
}
