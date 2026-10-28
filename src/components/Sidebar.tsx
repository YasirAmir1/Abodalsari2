import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Clock,
  BellRing,
  QrCode,
  Package,
  DollarSign,
  LogOut,
  UserCheck,
  Store,
  X,
  ShieldCheck,
  Sparkles,
  Layers,
  Trophy
} from 'lucide-react';
import { Logo } from './Logo';

export type NavTab =
  | 'dashboard'
  | 'sales'
  | 'subscribers'
  | 'active_subscribers'
  | 'debts'
  | 'pending'
  | 'agents'
  | 'barcodes'
  | 'products'
  | 'pricing'
  | 'agent_portal';

import { SystemUser } from '../types';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingCount: number;
  subscribersCount: number;
  isAgentMode: boolean;
  onToggleAgentMode: () => void;
  selectedAgentName?: string;
  currentUser?: SystemUser | null;
  onLogout?: () => void;
  isDark?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onPrefetchTab?: (tab: NavTab) => void;
}

interface NavSection {
  title: string;
  items: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeVariant?: 'neutral' | 'warning' | 'primary';
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  subscribersCount,
  isAgentMode,
  onToggleAgentMode,
  selectedAgentName,
  currentUser,
  onLogout,
  isOpen = false,
  onClose,
  onPrefetchTab
}) => {
  // Categorized navigation groups for maximum clarity and effortless scanning
  const navSections: NavSection[] = [
    {
      title: 'الرئيسية والعمليات',
      items: [
        { id: 'dashboard', label: 'الداشبورد العام', icon: LayoutDashboard },
        { id: 'sales', label: 'سجل المبيعات', icon: ShoppingCart }
      ]
    },
    {
      title: 'إدارة المشتركين',
      items: [
        { id: 'active_subscribers', label: 'المشتركون الفعالون', icon: UserCheck },
        {
          id: 'subscribers',
          label: 'سجل المشتركين',
          icon: Users,
          badge: subscribersCount > 0 ? subscribersCount.toLocaleString('en-US') : undefined,
          badgeVariant: 'neutral'
        },
        { id: 'debts', label: 'الديون والمستحقات', icon: Clock },
        {
          id: 'pending',
          label: 'الطلبات المعلقة',
          icon: BellRing,
          badge: pendingCount > 0 ? String(pendingCount) : undefined,
          badgeVariant: 'warning'
        }
      ]
    },
    {
      title: 'الشبكة والتجهيزات',
      items: [
        { id: 'agents', label: 'الوكلاء ومنافذ البيع', icon: Store },
        { id: 'barcodes', label: 'أكواد وأجهزة QR', icon: QrCode },
        { id: 'products', label: 'المنتجات والمعدات', icon: Package },
        { id: 'pricing', label: 'جدول الأسعار', icon: DollarSign }
      ]
    },

  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 z-40 md:hidden backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 inset-y-0 right-0 z-50 w-68 bg-gradient-to-b from-white via-slate-50/70 to-slate-100/50 dark:from-[#080E21] dark:via-[#070D1E] dark:to-[#050916] border-l border-slate-200/80 dark:border-[#141D34] flex flex-col shrink-0 select-none shadow-2xl md:shadow-none h-screen overflow-hidden transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        {/* ========================================================================= */}
        {/* Top Header Section (الهدر الجانبي)                                       */}
        {/* ========================================================================= */}
        <div className="relative px-4 pt-4 pb-3.5 border-b border-slate-200/80 dark:border-[#141D34]/80 shrink-0 bg-white/70 dark:bg-[#080E21]/80 backdrop-blur-md">
          {/* Subtle top ambient glow */}
          <div className="absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />

          {/* Close button on mobile */}
          {isOpen && (
            <button
              onClick={onClose}
              className="absolute left-3 top-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
              title="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <Logo size="md" showGlow className="shadow-md group-hover:scale-105 transition-transform" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#080E21]" />
            </div>

            <div className="text-right min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-[15px] tracking-tight text-slate-900 dark:text-white truncate">
                  الساري للبث الأرضي
                </h1>
              </div>
              <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 truncate mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-500 shrink-0" />
                <span>وكيل قنوات الرابعة الرياضية</span>
              </p>
            </div>
          </div>

          {/* Environment / System Mode Badge */}
          <div className="mt-3">
            <div
              className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                isAgentMode
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-100/80 dark:bg-[#0E1A38]/70 border-slate-200/80 dark:border-sky-900/40 text-slate-700 dark:text-sky-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isAgentMode ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isAgentMode ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                </span>
                <span className="text-[11.5px] font-bold truncate">
                  {isAgentMode ? `بوابة الوكيل (${selectedAgentName || 'معتمد'})` : 'مركز التحكم الرئيسي'}
                </span>
              </div>

              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/60 dark:bg-black/20 text-slate-500 dark:text-slate-400 shrink-0">
                {isAgentMode ? 'وكالة' : 'رئيسي'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Page Names Navigation List (اسماء الصفحات)                                */}
        {/* ========================================================================= */}
        <nav className="p-3 flex-1 overflow-y-auto space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {isAgentMode ? (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 uppercase">
                <Layers className="w-3.5 h-3.5" />
                <span>لوحة الوكيل</span>
              </div>
              <button
                onClick={() => {
                  onSelectTab('agent_portal');
                  if (onClose) onClose();
                }}
                onMouseEnter={() => onPrefetchTab?.('agent_portal')}
                className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all group overflow-hidden ${
                  currentTab === 'agent_portal'
                    ? 'bg-gradient-to-l from-amber-500/15 via-amber-500/8 to-transparent text-amber-950 dark:text-amber-200 border border-amber-500/30 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'
                }`}
              >
                {currentTab === 'agent_portal' && (
                  <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-gradient-to-b from-amber-400 to-amber-600 shadow-sm shadow-amber-500/50" />
                )}
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      currentTab === 'agent_portal'
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs'
                        : 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 group-hover:text-amber-600'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="text-[13.5px]">لوحة تحكم الوكيل</span>
                </div>
              </button>


            </div>
          ) : (
            navSections.map((section, idx) => (
              <div key={idx} className="space-y-1">
                {/* Section Header with subtle title */}
                <div className="px-3 pt-1 pb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 tracking-normal">
                    {section.title}
                  </span>
                  <div className="h-[1px] flex-1 mr-3 bg-slate-200/50 dark:bg-slate-800/60" />
                </div>

                {/* Page Items */}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          if (onClose) onClose();
                        }}
                        onMouseEnter={() => onPrefetchTab?.(item.id)}
                        className={`relative w-full flex items-center justify-between px-3 py-2.2 rounded-xl text-sm font-semibold transition-all group overflow-hidden ${
                          isActive
                            ? 'bg-gradient-to-l from-sky-500/15 via-sky-500/8 to-transparent text-sky-950 dark:text-sky-100 font-bold border border-sky-500/30 dark:border-sky-400/30 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'
                        }`}
                      >
                        {/* Active Indicator Bar on right edge */}
                        {isActive && (
                          <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-gradient-to-b from-sky-500 to-blue-600 shadow-sm shadow-sky-500/50" />
                        )}

                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`p-1.5 rounded-lg transition-all ${
                              isActive
                                ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/30'
                                : 'bg-slate-100/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 group-hover:bg-sky-50 dark:group-hover:bg-sky-950/40 group-hover:text-sky-600 dark:group-hover:text-sky-400'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
                          </div>
                          <span className="text-[13.5px] truncate font-medium group-hover:font-semibold">
                            {item.label}
                          </span>
                        </div>

                        {/* Distinctive count badges */}
                        {item.badge && (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 font-mono transition-transform ${
                              item.badgeVariant === 'warning'
                                ? 'bg-amber-500 text-white shadow-xs animate-pulse ring-2 ring-amber-500/30'
                                : isActive
                                ? 'bg-sky-500 text-white shadow-xs'
                                : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* ========================================================================= */}
        {/* Bottom Profile & System Info Card                                        */}
        {/* ========================================================================= */}
        <div className="p-3 border-t border-slate-200/80 dark:border-[#141D34]/80 shrink-0 bg-white/60 dark:bg-[#070D1E]/60 backdrop-blur-sm">
          <div className="p-2 rounded-xl bg-slate-100/70 hover:bg-slate-100 dark:bg-[#0D1836] dark:hover:bg-[#112046] transition-all border border-slate-200/70 dark:border-[#1E2C52] flex items-center justify-between group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 dark:from-sky-500 dark:to-blue-600 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0 ring-1 ring-sky-300/40 dark:ring-sky-400/30">
                  {currentUser?.displayName ? currentUser.displayName.substring(0, 1) : 'أ'}
                </div>
                <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-[#0D1836]" />
              </div>

              <div className="text-right min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate flex items-center gap-1">
                  <span>{isAgentMode ? selectedAgentName || 'وكيل معتمد' : (currentUser?.displayName || 'أدمن المركز')}</span>
                  <ShieldCheck className="w-3 h-3 text-sky-500 shrink-0" />
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {isAgentMode ? 'وكالة معتمدة' : (currentUser?.role || 'إدارة النظام')}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout ? onLogout : onToggleAgentMode}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors shrink-0 shadow-2xs"
              title={onLogout ? 'تسجيل الخروج' : 'تبديل الوضع'}
            >
              <LogOut className="w-4 h-4 rotate-180" />
            </button>
          </div>

          {/* Footer signature */}
          <div className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-400 font-medium tracking-tight">
            الساري للبث الارضي • م. ياسر المعجون
          </div>
        </div>
      </aside>
    </>
  );
};
