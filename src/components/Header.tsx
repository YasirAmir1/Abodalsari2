import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  Download,
  Contrast,
  RefreshCw,
  ShieldAlert,
  CheckCircle,
  Clock,
  ArrowRightLeft,
  X,
  LogOut
} from 'lucide-react';
import { SecurityAlert } from '../types';

interface HeaderProps {
  pageTitle: string;
  securityAlerts: SecurityAlert[];
  pendingCount: number;
  onRefresh: () => void;
  onDownloadBackup: () => void;
  isAgentMode: boolean;
  onToggleAgentMode: () => void;
  agentsList: { id: string; name: string }[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onLogout?: () => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  securityAlerts,
  pendingCount,
  onRefresh,
  onDownloadBackup,
  isAgentMode,
  onToggleAgentMode,
  agentsList,
  selectedAgentId,
  onSelectAgent,
  onLogout,
  isDark = false,
  onToggleDark
}) => {
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  const unreadAlerts = securityAlerts.filter((a) => !a.read);
  const totalNotifications = unreadAlerts.length + pendingCount;

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20 select-none transition-colors">
      {/* Page Title / Breadcrumb (Right in RTL) */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{pageTitle}</h2>
        {isAgentMode && (
          <div className="flex items-center gap-2 mr-2">
            <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold border border-amber-300">
              تطبيق الوكيل
            </span>
            <select
              value={selectedAgentId}
              onChange={(e) => onSelectAgent(e.target.value)}
              className="text-xs font-bold bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {agentsList.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Control Tools (Left in RTL, matching Screenshot 1 & 3) */}
      <div className="flex items-center gap-2">
        {/* Switch Mode Button */}
        <button
          onClick={onToggleAgentMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
            isAgentMode
              ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
          }`}
          title="التبديل بين تطبيق المركز الرئيسي وتطبيق الوكلاء"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>{isAgentMode ? 'العودة للمركز الرئيسي' : 'فتح تطبيق الوكيل'}</span>
        </button>

        {/* Date Display (Matching Screenshot 1 & 3) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 border border-slate-200 rounded-full text-xs font-medium text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span dir="ltr">Saturday, Oct 17, 2026</span>
        </div>

        {/* Notification Bell with Badge */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 relative transition-colors"
            title="الإشعارات والتنبيهات الأمنية"
          >
            <Bell className="w-4 h-4" />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-bounce">
                {totalNotifications}
              </span>
            )}
          </button>

          {/* Alerts Dropdown Modal */}
          {showAlertsDropdown && (
            <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-sm text-slate-800">التنبيهات والأنشطة الأمنية</span>
                </div>
                <button
                  onClick={() => setShowAlertsDropdown(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
                {pendingCount > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{pendingCount} طلب تجديد معلق من الوكلاء</span>
                    </div>
                    <p className="mt-1 text-amber-700 text-[11px]">
                      يرجى مراجعة صفحة الطلبات المعلقة لاعتماد أو رفض الاشتراكات.
                    </p>
                  </div>
                )}

                {securityAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-2.5 rounded-xl border text-xs ${
                      alert.severity === 'high'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : alert.severity === 'medium'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{alert.title}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{alert.timestamp}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{alert.description}</p>
                  </div>
                ))}

                {totalNotifications === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500 opacity-60" />
                    <span>كافة الأنشطة طبيعية ولا توجد تنبيهات حالياً</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Toggle with Contrast icon matching the screenshot */}
        <button
          onClick={onToggleDark}
          className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-xs active:scale-95"
          title={isDark ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
        >
          <Contrast className={`w-4 h-4 ${isDark ? 'text-sky-400 rotate-180' : 'text-slate-600'}`} />
        </button>

        {/* Refresh Data */}
        <button
          onClick={onRefresh}
          className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Download Backup */}
        <button
          onClick={onDownloadBackup}
          className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
          title="تحميل نسخة احتياطية فورية (JSON)"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Logout Button (matching Screenshot 1 far left icon) */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-9 h-9 rounded-full border border-red-200 bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-600 transition-colors"
            title="تسجيل الخروج والعودة لصفحة الدخول"
          >
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>
    </header>
  );
};
