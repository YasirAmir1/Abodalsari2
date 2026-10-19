import React from 'react';
import {
  Calendar,
  Sun,
  Moon,
  RefreshCw,
  LogOut,
  Menu
} from 'lucide-react';

interface HeaderProps {
  pageTitle: string;
  currentTab?: string;
  onRefresh: () => void;
  isAgentMode: boolean;
  agentsList: { id: string; name: string }[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onLogout?: () => void;
  isDark?: boolean;
  onToggleDark?: () => void;
  onToggleSidebar?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  currentTab,
  onRefresh,
  isAgentMode,
  agentsList,
  selectedAgentId,
  onSelectAgent,
  onLogout,
  isDark = false,
  onToggleDark,
  onToggleSidebar,
  isRefreshing = false
}) => {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 select-none transition-colors">
      {/* Page Title / Breadcrumb (Right in RTL) */}
      <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
        {/* Mobile Hamburger Menu Button (3 lines) */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 shadow-xs"
          title="فتح القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-base md:text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate">{pageTitle}</h2>
        {isAgentMode && currentTab !== 'agents' && (
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-300 dark:border-amber-700">
              تطبيق الوكيل
            </span>
            <select
              value={selectedAgentId}
              onChange={(e) => onSelectAgent(e.target.value)}
              className="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
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

      {/* Control Tools (Left in RTL) */}
      <div className="flex items-center gap-2">
        {/* Date Display */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>{new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={onToggleDark}
          className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all shadow-xs active:scale-95 cursor-pointer"
          title={isDark ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 animate-in zoom-in spin-in-180 duration-500" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 animate-in zoom-in spin-in-180 duration-500" />
          )}
        </button>

        {/* Refresh Data */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer ${
            isRefreshing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
          }`}
          title="تحديث ومزامنة البيانات من قاعدة البيانات"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-600 dark:text-sky-400' : ''}`} />
        </button>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-9 h-9 rounded-full border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 transition-colors cursor-pointer"
            title="تسجيل الخروج والعودة لصفحة الدخول"
          >
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>
    </header>
  );
};
