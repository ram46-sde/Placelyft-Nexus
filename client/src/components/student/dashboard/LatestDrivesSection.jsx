import { Link } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Calendar,
  IndianRupee,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import SectionHeader from '../../common/SectionHeader';
import EmptyState from '../../common/EmptyState';
import Skeleton from '../../common/Skeleton';
import CompanyLocation from '../../common/CompanyLocation';

/**
 * Latest Placement Drives section.
 * Renders active non-archived recruitment drives available to the student's college.
 */
const LatestDrivesSection = ({
  drives = [],
  loading = false,
}) => {
  const viewAllAction = (
    <Link
      to="/student/drives"
      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition min-h-[44px] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
    >
      <span>View all</span>
      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
    </Link>
  );

  return (
    <Card className="flex flex-col justify-between h-full">
      <div className="space-y-4">
        <SectionHeader
          title="Latest Placement Drives"
          description="Campus recruitment opportunities scheduled for your institution"
          icon={Briefcase}
          action={viewAllAction}
        />

        {loading ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : drives.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No active placement drives"
            description="Recruitment drives announced by your placement cell will appear here."
            action={
              <Link
                to="/student/drives"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <span>Browse Drives</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <div className="space-y-3 pt-1">
            {drives.map((drive) => {
              const isEligible = drive.eligibility?.isEligible;
              return (
                <div
                  key={drive._id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/20 transition duration-150 ease-in-out flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden mt-0.5"
                      aria-hidden="true"
                    >
                      {drive.company?.logoUrl ? (
                        <img
                          src={drive.company.logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-500 truncate max-w-[200px]">
                          {drive.company?.name || 'Company'}
                        </span>
                        {drive.hasApplied && (
                          <Badge variant="sky" icon={CheckCircle2}>
                            Applied
                          </Badge>
                        )}
                        {isEligible ? (
                          <Badge variant="emerald">Eligible</Badge>
                        ) : (
                          <Badge variant="slate">Not Eligible</Badge>
                        )}
                      </div>
                      <h3
                        className="text-sm font-semibold text-slate-900 mt-0.5 truncate"
                        title={drive.jobRole}
                      >
                        {drive.jobRole}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                          <span>
                            {drive.driveDate
                              ? new Date(drive.driveDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'TBD'}
                          </span>
                        </div>
                        {drive.packageDetails && (
                          <div className="flex items-center gap-0.5 font-medium text-slate-700 shrink-0">
                            <IndianRupee className="w-3 h-3 text-slate-400" aria-hidden="true" />
                            <span>{drive.packageDetails}</span>
                          </div>
                        )}
                        <CompanyLocation
                          location={drive.companyLocation}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 min-w-0 shrink-0"
                          iconClassName="w-3.5 h-3.5 text-slate-400 shrink-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    <Link
                      to={`/student/drives/${drive._id}`}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                      <span>View Drive</span>
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

export default LatestDrivesSection;

