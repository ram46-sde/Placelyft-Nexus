import { Briefcase } from 'lucide-react';

const DrivesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Placement Drives</h1>
        <p className="text-sm text-slate-500 mt-1">Explore campus recruitment opportunities and apply based on eligibility</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Briefcase className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">No placement drives available</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          Currently there are no active recruitment drives announced. Check back later for new opportunities.
        </p>
      </div>
    </div>
  );
};

export default DrivesPage;
