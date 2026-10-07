import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { applicationService } from '../../services/applicationService';
import { FileCheck2, Building2, Calendar, Search, Loader2, ArrowRight, CheckCircle2, Clock, XCircle, Users } from 'lucide-react';

const ApplicationsPage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await applicationService.getMyApplications();
      if (res.success) {
        setApplications(res.applications || []);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const drive = app.placementDrive;
    if (!drive) return false;
    const searchString = searchTerm.toLowerCase();
    return (
      drive.company?.name?.toLowerCase().includes(searchString) ||
      drive.jobRole?.toLowerCase().includes(searchString) ||
      app.status.toLowerCase().includes(searchString)
    );
  });

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Applied': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Shortlisted': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Interviewing': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Selected': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Applied': return <Clock className="w-4 h-4" />;
      case 'Shortlisted': return <FileCheck2 className="w-4 h-4" />;
      case 'Interviewing': return <Users className="w-4 h-4" />;
      case 'Selected': return <CheckCircle2 className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
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
          <h1 className="text-2xl font-bold text-slate-900">My Applications</h1>
          <p className="text-sm text-slate-500 mt-1">Track your placement drive applications and statuses</p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company, role or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full shadow-sm"
          />
        </div>
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm mt-6">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
            <FileCheck2 className="w-6 h-6 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            {searchTerm ? 'No matching applications found' : 'No applications yet'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm 
              ? 'Try adjusting your search criteria.' 
              : "You haven't applied to any placement drives yet. Explore available drives to start applying."}
          </p>
          {!searchTerm && (
            <Link to="/student/drives" className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition">
              Explore Drives <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Company & Role</th>
                  <th className="px-6 py-4 font-semibold">Applied On</th>
                  <th className="px-6 py-4 font-semibold">Drive Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplications.map((app) => {
                  const drive = app.placementDrive;
                  if (!drive) return null; // Safe guard
                  
                  return (
                    <tr key={app._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                            {drive.company?.logoUrl ? (
                              <img src={drive.company.logoUrl} alt={drive.company?.name} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{drive.company?.name}</div>
                            <div className="text-sm font-medium text-indigo-600">{drive.jobRole}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{formatDate(drive.driveDate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(app.status)}`}>
                          {getStatusIcon(app.status)}
                          <span>{app.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/student/drives/${drive._id}`}
                          className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition"
                        >
                          View Drive
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsPage;
