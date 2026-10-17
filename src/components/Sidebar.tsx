import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Clock,
  BellRing,
  Users2,
  QrCode,
  FileText,
  Package,
  DollarSign,
  UserCheck,
  LogOut
} from 'lucide-react';
import { Logo } from './Logo';

export type NavTab =
  | 'dashboard'
  | 'sales'
  | 'subscribers'
  | 'debts'
  | 'pending'
  | 'agents'
  | 'barcodes'
  | 'reports'
  | 'products'
  | 'pricing'
  | 'admin'
  | 'agent_portal';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingCount: number;
  subscribersCount: number;
  isAgentMode: boolean;
  onToggleAgentMode: () => void;
  selectedAgentName?: string;
  onLogout?: () => void;
  isDark?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  subscribersCount,
  isAgentMode,
  onToggleAgentMode,
  selectedAgentName,
  onLogout,
  isDark = false
}) => {
  const menuItems = [
    { id: 'dashboard' as NavTab, label: 'الداشبورد', icon: LayoutDashboard },
    { id: 'sales' as NavTab, label: 'المبيعات', icon: ShoppingCart },
    { id: 'subscribers' as NavTab, label: 'المشتركون', icon: Users, badge: String(subscribersCount) },
    { id: 'debts' as NavTab, label: 'الديون', icon: Clock },
    { id: 'pending' as NavTab, label: 'الطلبات المعلقة', icon: BellRing, badge: pendingCount > 0 ? String(pendingCount) : undefined, badgeColor: 'bg-amber-500' },
    { id: 'agents' as NavTab, label: 'الوكلاء', icon: Users2 },
    { id: 'barcodes' as NavTab, label: 'أكواد وأجهزة QR', icon: QrCode },
    { id: 'reports' as NavTab, label: 'التقارير والاهداف', icon: FileText },
    { id: 'products' as NavTab, label: 'المنتجات', icon: Package },
    { id: 'pricing' as NavTab, label: 'الأسعار', icon: DollarSign },
    { id: 'admin' as NavTab, label: 'حساب الادمن', icon: UserCheck }
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#070D1E] border-l border-slate-200 dark:border-[#141D34] flex flex-col shrink-0 select-none shadow-sm z-20 h-screen sticky top-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden transition-colors">
      {/* Brand Header */}
      <div className="px-3.5 py-3 border-b border-slate-100 dark:border-[#141D34] flex flex-col items-center text-center shrink-0">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <div className="text-right">
            <h1 className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              الساري
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">للبث الأرضي</span>
            </h1>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">وكيل قنوات الرابعة الرياضية</p>
          </div>
        </div>

        {/* Mode Pill */}
        <div className="mt-2 w-full">
          <button
            onClick={onToggleAgentMode}
            className={`w-full py-1 px-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-between border ${
              isAgentMode
                ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300 shadow-xs'
                : 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-[#0E1A38] dark:border-sky-800/60 dark:text-sky-300 hover:bg-sky-100'
            }`}
            title="انقر للتبديل بين إدارة المركز وتطبيق الوكلاء"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isAgentMode ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className="truncate">{isAgentMode ? `بوابة (${selectedAgentName || 'الوكيل'})` : 'نظام إدارة المركز - رئيسي'}</span>
            </span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 bg-white/90 dark:bg-sky-950/80 px-1.5 py-0.2 rounded-full border border-sky-200 dark:border-sky-800 shrink-0">
              تبديل
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Links - Spacious distance between page names */}
      <nav className="p-3 space-y-2 flex-1">
        {isAgentMode ? (
          <div className="space-y-2">
            <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400">قائمة تطبيق الوكيل</div>
            <button
              onClick={() => onSelectTab('agent_portal')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'agent_portal'
                  ? 'bg-sky-100/90 text-sky-950 font-bold shadow-xs border border-sky-200/60 dark:bg-[#132A55] dark:text-sky-300 dark:border-sky-500/30'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#0D1836] dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>لوحة تحكم الوكيل</span>
              </div>
            </button>
            <button
              onClick={() => onSelectTab('subscribers')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'subscribers'
                  ? 'bg-sky-100/90 text-sky-950 font-bold shadow-xs border border-sky-200/60 dark:bg-[#132A55] dark:text-sky-300 dark:border-sky-500/30'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#0D1836] dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>مشتركي الوكالة</span>
              </div>
            </button>
            <button
              onClick={() => onSelectTab('products')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'products'
                  ? 'bg-sky-100/90 text-sky-950 font-bold shadow-xs border border-sky-200/60 dark:bg-[#132A55] dark:text-sky-300 dark:border-sky-500/30'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#0D1836] dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>طلب أجهزة ومعدات</span>
              </div>
            </button>
            <button
              onClick={() => onSelectTab('sales')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'sales'
                  ? 'bg-sky-100/90 text-sky-950 font-bold shadow-xs border border-sky-200/60 dark:bg-[#132A55] dark:text-sky-300 dark:border-sky-500/30'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#0D1836] dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>سجل المبيعات والتجديد</span>
              </div>
            </button>
            <button
              onClick={() => onSelectTab('debts')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'debts'
                  ? 'bg-sky-100/90 text-sky-950 font-bold shadow-xs border border-sky-200/60 dark:bg-[#132A55] dark:text-sky-300 dark:border-sky-500/30'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#0D1836] dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>حساباتي والديون</span>
              </div>
            </button>
          </div>
        ) : (
          menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-sky-100/90 text-sky-950 font-bold shadow-xs border border-sky-200/60 dark:bg-[#132A55] dark:text-sky-300 dark:border-sky-500/30'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#0D1836] dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white shrink-0 ${
                      item.badgeColor || 'bg-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })
        )}
      </nav>

      {/* Admin Profile Bottom Card (Matching Screenshot 1) */}
      <div className="p-3 border-t border-slate-100 dark:border-[#141D34] shrink-0">
        <div className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100/90 dark:bg-[#0D1836] dark:border-[#1E2C52] transition-colors border border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sky-900 dark:bg-sky-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
              أ
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {isAgentMode ? selectedAgentName || 'وكيل معتمد' : 'أدمن المركز (dsari...)'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{isAgentMode ? 'وكالة معتمدة' : 'أدمن رئيسي'}</div>
            </div>
          </div>
          <button
            onClick={onLogout || onToggleAgentMode}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
            title="تسجيل الخروج أو تبديل الحساب"
          >
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* Footer signature from Screenshot 1 */}
        <div className="mt-1.5 text-center text-[10px] text-slate-400 font-medium">
          تصميم وبرمجة | م. ياسر المعجون
        </div>
      </div>
    </aside>
  );
};
