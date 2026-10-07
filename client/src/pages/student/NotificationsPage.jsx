import { Bell } from 'lucide-react';

const NotificationsPage = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">Official updates regarding placement drives and interview schedules</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Bell className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">No notifications yet</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          You have no unread announcements or interview notifications at this moment.
        </p>
      </div>
    </div>
  );
};

export default NotificationsPage;
