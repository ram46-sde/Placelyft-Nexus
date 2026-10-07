import { Link } from 'react-router-dom';
import { Briefcase, ArrowLeft } from 'lucide-react';

const OfficerLoginPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Briefcase className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Placement Officer Portal</h1>
        <p className="text-slate-500 mb-8">
          The Placement Officer portal is currently under construction and will be available in the next phase.
        </p>
        <Link 
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Home</span>
        </Link>
      </div>
    </div>
  );
};

export default OfficerLoginPage;
