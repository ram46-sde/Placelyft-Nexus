import { Sparkles } from 'lucide-react';

/**
 * Welcome banner presentational component.
 * Features one subtle dark gradient (slate-900 -> indigo-950), extract first name, no emoji, no celebratory claims.
 */
const WelcomeBanner = ({ userName }) => {
  const firstName = userName ? userName.trim().split(' ')[0] : 'Student';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 rounded-xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5 text-indigo-300" aria-hidden="true" />
          <span>Student Workspace</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Hello, {firstName}!
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-2">
          Review your campus recruitment drives, monitor your application progress across interview stages, and track official verified placement outcomes.
        </p>
      </div>
    </div>
  );
};

export default WelcomeBanner;

