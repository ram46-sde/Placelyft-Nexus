import { useAuth } from '../../context/AuthContext';
import { User, Mail, ShieldCheck } from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Review your personal and account details</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-indigo-600/20">
            {user?.name?.charAt(0).toUpperCase() || 'S'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Student</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Full Name
            </span>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <User className="w-4 h-4 text-slate-400" />
              <span>{user?.name}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              College Email
            </span>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{user?.email}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
