import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { driveService } from '../../services/driveService';
import { 
  Briefcase, Building2, Calendar, Clock, MapPin, 
  CheckCircle2, XCircle, ArrowLeft, Loader2, Info, ChevronRight, GraduationCap
} from 'lucide-react';

const DriveDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [drive, setDrive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDriveDetails();
  }, [id]);

  const fetchDriveDetails = async () => {
    try {
      setLoading(true);
      const res = await driveService.getDriveById(id);
      if (res.success) {
        setDrive(res.drive);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drive details.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !drive) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Error Loading Drive</h2>
        <p className="text-slate-500 mt-2">{error || 'Drive not found'}</p>
        <button onClick={() => navigate('/drives')} className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Drives
        </button>
      </div>
    );
  }

  const { eligibility, company, eligibilityCriteria } = drive;
  const isEligible = eligibility?.isEligible;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Back Navigation */}
      <Link to="/drives" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition">
        <ArrowLeft className="w-4 h-4" /> Back to all drives
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="h-32 bg-gradient-to-r from-indigo-900 to-slate-800"></div>
        <div className="px-6 sm:px-10 pb-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-12 mb-6">
            <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
              {company?.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{company?.name || 'Company Name'}</h1>
              <p className="text-lg font-medium text-indigo-600 mt-1">{drive.jobRole}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <span><strong>Drive Date:</strong> {formatDate(drive.driveDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              <span><strong>Registration Deadline:</strong> {formatDate(drive.registrationDeadline)}</span>
            </div>
            {drive.packageDetails && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-slate-400" />
                <span><strong>Package:</strong> {drive.packageDetails}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main Details) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Job Description</h2>
            <div className="prose prose-slate max-w-none text-slate-600">
              <p className="whitespace-pre-wrap">{drive.jobDescription}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Company Overview</h2>
            <div className="text-slate-600">
              <p className="mb-4">{company?.description || 'No description available for this company.'}</p>
              {company?.industry && <p><strong>Industry:</strong> {company.industry}</p>}
              {company?.website && (
                <p className="mt-2">
                  <strong>Website:</strong> <a href={company.website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{company.website}</a>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Eligibility & Action) */}
        <div className="space-y-6">
          {/* Eligibility Engine Box */}
          <div className={`rounded-2xl border p-6 shadow-sm ${isEligible ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              {isEligible ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-500" />
              )}
              <h2 className={`text-lg font-bold ${isEligible ? 'text-emerald-900' : 'text-slate-900'}`}>
                {isEligible ? 'You are Eligible' : 'Not Eligible'}
              </h2>
            </div>
            
            <ul className="space-y-3 mb-6">
              {eligibility?.reasons?.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${isEligible ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <span className={isEligible ? 'text-emerald-800' : 'text-slate-700'}>{reason}</span>
                </li>
              ))}
            </ul>

            {/* Application Button (Placeholder for Phase 6) */}
            <button 
              disabled={!isEligible}
              className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-sm ${
                isEligible 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20' 
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              <span>{isEligible ? 'Apply Now' : 'Cannot Apply'}</span>
            </button>
            {!isEligible && (
              <p className="text-xs text-center text-slate-500 mt-3">
                Update your <Link to="/profile" className="text-indigo-600 hover:underline">Student Profile</Link> if you believe this is incorrect.
              </p>
            )}
          </div>

          {/* Criteria Summary Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-indigo-500" /> Drive Criteria Summary
            </h3>
            <ul className="space-y-4 text-sm text-slate-600">
              <li className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="font-medium text-slate-700">Minimum CGPA</span>
                <span className="font-semibold text-slate-900">{eligibilityCriteria?.minCgpa || 'No minimum'}</span>
              </li>
              <li className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="font-medium text-slate-700">Max Active Backlogs</span>
                <span className="font-semibold text-slate-900">{eligibilityCriteria?.maxBacklogs ?? 'Any'}</span>
              </li>
              {eligibilityCriteria?.requiredCourses?.length > 0 && (
                <li className="flex flex-col gap-1 pb-3 border-b border-slate-100">
                  <span className="font-medium text-slate-700">Eligible Courses</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {eligibilityCriteria.requiredCourses.map(c => (
                      <span key={c} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-700">{c}</span>
                    ))}
                  </div>
                </li>
              )}
              {eligibilityCriteria?.requiredSkills?.length > 0 && (
                <li className="flex flex-col gap-1">
                  <span className="font-medium text-slate-700">Required Skills</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {eligibilityCriteria.requiredSkills.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{s}</span>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveDetailsPage;
