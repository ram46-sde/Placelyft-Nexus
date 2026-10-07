import { Link } from 'react-router-dom';
import { GraduationCap, Briefcase, Building2, ChevronRight } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 mb-6 shadow-lg shadow-indigo-500/10 backdrop-blur-md">
          <GraduationCap className="w-10 h-10 text-indigo-400" />
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
          College Placement Management System
        </h1>
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
          Manage placements. Track progress. Connect students, placement officers, and recruiters seamlessly.
        </p>
      </div>

      <div className="max-w-4xl w-full">
        <h2 className="text-sm font-semibold text-indigo-400 uppercase tracking-widest text-center mb-8">
          Select Your Role to Continue
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Student Role Card */}
          <Link
            to="/student/login"
            className="group relative bg-slate-800/60 backdrop-blur-md border border-slate-700/60 p-8 rounded-2xl hover:bg-slate-800 hover:border-indigo-500/50 transition-all duration-300 shadow-xl shadow-black/20 overflow-hidden flex flex-col items-center text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-6 group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-colors text-slate-300">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Student</h3>
            <p className="text-sm text-slate-400 mb-6 flex-1">
              Apply for drives, track applications, and manage your academic profile.
            </p>
            <div className="w-full py-2.5 rounded-lg bg-slate-700/30 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <span>Student Portal</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Placement Officer Role Card */}
          <Link
            to="/placement-officer/login"
            className="group relative bg-slate-800/60 backdrop-blur-md border border-slate-700/60 p-8 rounded-2xl hover:bg-slate-800 hover:border-emerald-500/50 transition-all duration-300 shadow-xl shadow-black/20 overflow-hidden flex flex-col items-center text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-6 group-hover:bg-emerald-600/20 group-hover:text-emerald-400 transition-colors text-slate-300">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Placement Officer</h3>
            <p className="text-sm text-slate-400 mb-6 flex-1">
              Manage drives, review students, and coordinate recruitment workflows.
            </p>
            <div className="w-full py-2.5 rounded-lg bg-slate-700/30 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <span>Officer Portal</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Recruiter Role Card */}
          <Link
            to="/recruiter/login"
            className="group relative bg-slate-800/60 backdrop-blur-md border border-slate-700/60 p-8 rounded-2xl hover:bg-slate-800 hover:border-amber-500/50 transition-all duration-300 shadow-xl shadow-black/20 overflow-hidden flex flex-col items-center text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-6 group-hover:bg-amber-600/20 group-hover:text-amber-400 transition-colors text-slate-300">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Recruiter</h3>
            <p className="text-sm text-slate-400 mb-6 flex-1">
              Post job roles, shortlist candidates, and manage interview rounds.
            </p>
            <div className="w-full py-2.5 rounded-lg bg-slate-700/30 group-hover:bg-amber-600 text-slate-300 group-hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <span>Recruiter Portal</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </div>
      
      <div className="mt-16 text-center text-slate-500 text-sm">
        <p>Already an existing user? Select your role above to sign in securely.</p>
      </div>
    </div>
  );
};

export default LandingPage;
