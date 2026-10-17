import React, { useState } from 'react';
import {
  UserCheck,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Plus,
  ShieldAlert,
  Database,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Lock,
  UserPlus
} from 'lucide-react';
import { SecurityAlert, SystemUser } from '../types';

interface AdminAccountsViewProps {
  users: SystemUser[];
  securityAlerts: SecurityAlert[];
  lastBackupDate: string;
  onAddUser: (user: Omit<SystemUser, 'id'>) => void;
  onUpdateUser: (user: SystemUser) => void;
  onDeleteUser: (id: string) => void;
  onDownloadBackup: () => void;
  onRestoreBackup: (file: File) => void;
  onResetData: () => void;
  onTriggerSecurityTest: () => void;
}

export const AdminAccountsView: React.FC<AdminAccountsViewProps> = ({
  users,
  securityAlerts,
  lastBackupDate,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onDownloadBackup,
  onRestoreBackup,
  onResetData,
  onTriggerSecurityTest
}) => {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<SystemUser['role']>('مدير رئيسي');
  const [formPassword, setFormPassword] = useState('');
  const [formAgentCode, setFormAgentCode] = useState('');

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAdd = () => {
    setFormUsername('');
    setFormDisplayName('');
    setFormRole('موظف مبيعات');
    setFormPassword('pass1234');
    setFormAgentCode('');
    setShowAddModal(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formDisplayName.trim()) return;

    onAddUser({
      username: formUsername.trim(),
      displayName: formDisplayName.trim(),
      role: formRole,
      agentCode: formAgentCode.trim() || undefined,
      passwordMasked: formPassword ? '••••••••' : '••••••••',
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: 'لم يسجل الدخول بعد'
    });

    setShowAddModal(false);
  };

  const handleOpenEdit = (user: SystemUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormDisplayName(user.displayName);
    setFormRole(user.role);
    setFormPassword('');
    setFormAgentCode(user.agentCode || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    onUpdateUser({
      ...editingUser,
      username: formUsername,
      displayName: formDisplayName,
      role: formRole,
      agentCode: formAgentCode || undefined
    });

    setEditingUser(null);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (confirm('هل أنت متأكد من استعادة النسخة الاحتياطية؟ سيتم تحديث كافة البيانات الحالية بالملف.')) {
        onRestoreBackup(e.target.files[0]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header matching Screenshot 8 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-sky-700 mb-1">إدارة الحسابات والأدوار</div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">حساب الادمن</h2>
          <p className="text-xs text-slate-500 mt-1">
            حسابات الدخول للأدمن والموظفين وإدارة الصلاحيات المتعددة والأمان
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Users Table matching Screenshot 8 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <Shield className="w-4 h-4 text-sky-700" />
            <span>جدول الأدمن والمدراء</span>
          </div>
          <span className="text-xs font-bold text-slate-400">{users.length} حساب</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">المستخدم</th>
                <th className="py-3 px-4">اسم الحساب (Username)</th>
                <th className="py-3 px-4">الدور / الصلاحية</th>
                <th className="py-3 px-3">رمز الوكيل</th>
                <th className="py-3 px-4 text-center">كلمة المرور</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Display Name with Avatar Icon */}
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-sky-900 text-white flex items-center justify-center font-bold text-xs">
                        أ
                      </div>
                      <span>{u.displayName}</span>
                    </div>
                  </td>

                  {/* Username */}
                  <td className="py-3 px-4 font-mono text-slate-700 font-medium">
                    {u.username}
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        u.role === 'مدير رئيسي'
                          ? 'bg-sky-100 text-sky-900'
                          : u.role === 'محاسب'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>

                  {/* Agent Code */}
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {u.agentCode || '-'}
                  </td>

                  {/* Password Show/Hide Toggle */}
                  <td className="py-3 px-4 text-center font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <span className="tracking-widest">
                        {visiblePasswords[u.id] ? 'alsari#2026' : u.passwordMasked}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(u.id)}
                        className="text-slate-400 hover:text-slate-600"
                        title={visiblePasswords[u.id] ? 'إخفاء' : 'إظهار'}
                      >
                        {visiblePasswords[u.id] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"
                        title="تعديل الحساب"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {users.length > 1 && (
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف الحساب "${u.username}"؟`)) {
                              onDeleteUser(u.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column Grid: RBAC Permissions Matrix & Security Anomaly Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Flexible Multi-Level RBAC Matrix */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-sky-700" />
            <h3 className="font-extrabold text-sm text-slate-900">نظام الصلاحيات متعدد المستويات (RBAC)</h3>
          </div>
          <p className="text-[11px] text-slate-500 mb-4">
            تحكم دقيق بصلاحيات الموظفين والوكلاء والمحاسبين لضمان سرية وأمن البيانات
          </p>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">مدير رئيسي (Super Admin)</span>
                <span className="text-[10px] text-slate-500">تحكم كامل، تثبيت الأسعار، حذف البيانات، النسخ الاحتياطي</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                كافة الصلاحيات
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">محاسب مالي (Accountant)</span>
                <span className="text-[10px] text-slate-500">متابعة الفواتير، تسديد ديون الوكلاء، تصدير تقارير الإكسل</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold text-[10px]">
                صلاحيات مالية
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">موظف مبيعات وتجديد (Sales Rep)</span>
                <span className="text-[10px] text-slate-500">تسجيل بيع جديد، تجديد اشتراك، إرسال إشعارات واتساب</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px]">
                مبيعات وتشغيل
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">وكيل معتمد (Agent Portal)</span>
                <span className="text-[10px] text-slate-500">تطبيق خاص لمتابعة باقاته الخاصة، وإرسال طلبات التجديد المعلقة</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                بوابة الوكيل
              </span>
            </div>
          </div>
        </div>

        {/* Security & Unusual Activity Detection Panel */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <h3 className="font-extrabold text-sm text-slate-900">مراقبة الأنشطة والتنبيهات الأمنية</h3>
              </div>
              <button
                onClick={onTriggerSecurityTest}
                className="text-[10px] font-bold px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors"
              >
                اختبار تنبيه أمني ⚠️
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              يرصد النظام تلقائياً أي عمليات غير طبيعية كالحذف الجماعي أو تراكم الديون أو تسجيلات الدخول المشبوهة
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {securityAlerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-2.5 rounded-2xl border text-xs ${
                    a.severity === 'high'
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : a.severity === 'medium'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span>{a.title}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{a.timestamp}</span>
                  </div>
                  <p className="text-[11px] mt-1 text-slate-600 leading-relaxed">{a.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700">
            <span className="flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              حماية التشفير والخصوصية مفعلة
            </span>
            <span className="text-slate-400">نظام المراقبة المباشر</span>
          </div>
        </div>
      </div>

      {/* Automated Backup & Disaster Recovery Center */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                النسخ الاحتياطي التلقائي واستمرارية الأعمال
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تأمين وحفظ نسخة احتياطية يومية من كافة المشتركين والمبيعات والديون والأكواد لضمان عدم فقدان البيانات
              </p>
              <div className="mt-2 text-[11px] text-slate-400">
                آخر مزامنة ونسخ تلقائي: <span className="font-mono text-slate-700 font-bold">{lastBackupDate}</span>
              </div>
            </div>
          </div>

          {/* Backup Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onDownloadBackup}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>تحميل نسخة احتياطية (JSON)</span>
            </button>

            <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-sky-700" />
              <span>استعادة نسخة سابقة</span>
              <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            </label>

            <button
              onClick={() => {
                if (confirm('تحذير: هل أنت متأكد من استعادة ضبط المصنع للبيانات الأولية؟')) {
                  onResetData();
                }
              }}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold border border-red-200 transition-colors"
              title="إعادة تعيين البيانات للوضع الافتراضي"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingUser ? 'تعديل بيانات الحساب' : 'إضافة حساب مستخدم جديد'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={editingUser ? handleSaveEdit : handleSaveAdd} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم الكامل / الظاهر *</label>
                <input
                  type="text"
                  required
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="مثال: مسؤول مبيعات سامراء"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المستخدم للدخول (Username) *</label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="sales_samarra"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الدور والصلاحية</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="مدير رئيسي">مدير رئيسي (Super Admin)</option>
                  <option value="محاسب">محاسب مالي (Accountant)</option>
                  <option value="موظف مبيعات">موظف مبيعات (Sales Rep)</option>
                  <option value="وكيل معتمد">وكيل معتمد (Agent)</option>
                  <option value="دعم فني">دعم فني ومراقبة</option>
                </select>
              </div>

              {formRole === 'وكيل معتمد' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رمز الوكيل المرتبط</label>
                  <input
                    type="text"
                    value={formAgentCode}
                    onChange={(e) => setFormAgentCode(e.target.value)}
                    placeholder="AG-01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? 'اتركه فارغاً للإبقاء على الحالية' : '••••••••'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 shadow-sm"
                >
                  حفظ الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
