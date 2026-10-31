import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { driveService } from '../../services/driveService';
import { Briefcase, Building2, Calendar, Search, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import CompanyLocation from '../../components/common/CompanyLocation';

const DrivesPage = () => {
  const { user } = useAuth();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, eligible, ineligible

  useEffect(() => {
    fetchDrives();
  }, []);

  const fetchDrives = async () => {
    try {
      setLoading(true);
      const res = await driveService.getAvailableDrives();
      if (res.success) {
        setDrives(res.drives || []);

        // Update student watermark in localStorage to clear new-drive navigation badge
        if (user?._id) {
          const watermark = res.latestDriveCreatedAt || new Date().toISOString();
          localStorage.setItem(`cpms_drives_watermark_${user._id}`, watermark);
          window.dispatchEvent(
            new CustomEvent('cpms_drives_watermark_updated', {
              detail: { watermark, hasNewDrives: false },
            })
          );
        }
      }
    } catch (error) {
      console.error('Error fetching drives:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDrives = drives.filter((drive) => {
    // Search by company name or job role
    const matchesSearch =
      drive.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drive.jobRole?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by eligibility
    if (filter === 'eligible') {
      return matchesSearch && drive.eligibility?.isEligible;
    }
    if (filter === 'ineligible') {
      return matchesSearch && !drive.eligibility?.isEligible;
    }
    return matchesSearch;
  });

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Placement Drives</h1>
          <p className="text-sm text-slate-500 mt-1">Explore and apply for upcoming campus recruitment drives</p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies or roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
          >
            <option value="all">All Drives</option>
            <option value="eligible">Eligible Only</option>
            <option value="ineligible">Not Eligible</option>
          </select>
        </div>
      </div>

      {/* Drives Grid */}
      {filteredDrives.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm mt-6">
          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Briefcase className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No placement drives found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm || filter !== 'all'
              ? 'Try adjusting your search or filters to find more opportunities.'
              : 'Currently there are no active recruitment drives announced. Check back later.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredDrives.map((drive) => {
            const isEligible = drive.eligibility?.isEligible;

            return (
              <div key={drive._id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                {/* Card Header (Company Info) */}
                <div className="p-5 border-b border-slate-100 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {drive.company?.logoUrl ? (
                      <img src={drive.company.logoUrl} alt={drive.company?.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate" title={drive.company?.name}>
                      {drive.company?.name || 'Unknown Company'}
                    </h3>
                    <p className="text-sm font-medium text-indigo-600 truncate">{drive.jobRole}</p>
                  </div>
                </div>

                {/* Card Body (Drive Details) */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">Drive Date: <span className="font-medium text-slate-800">{formatDate(drive.driveDate)}</span></span>
                  </div>
                  
                  {drive.packageDetails && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Briefcase className="w-4 h-4 shrink-0 text-slate-400" />
                      <span className="truncate">Package: <span className="font-medium text-slate-800">{drive.packageDetails}</span></span>
                    </div>
                  )}

                  <CompanyLocation location={drive.companyLocation} className="flex items-center gap-2 text-sm text-slate-600 min-w-0" iconClassName="w-4 h-4 shrink-0 text-slate-400" />

                  {/* Eligibility Badge */}
                  <div className={`mt-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-fit border ${
                    isEligible 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {isEligible ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{isEligible ? 'Eligible to Apply' : 'Not Eligible'}</span>
                  </div>
                </div>

                {/* Card Footer (Action) */}
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <Link
                    to={`/student/drives/${drive._id}`}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    <span>View Full Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DrivesPage;
