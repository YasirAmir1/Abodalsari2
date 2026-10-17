import React, { useState } from 'react';
import { Lock, User, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { SystemUser } from '../types';
import { Logo } from './Logo';

interface LoginViewProps {
  users: SystemUser[];
  onLogin: (user: SystemUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim().toLowerCase();
    const found = users.find(
      (u) => u.username.toLowerCase() === cleanUser
    );

    if (found) {
      onLogin(found);
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleQuickLogin = (uname: string) => {
    const found = users.find((u) => u.username.toLowerCase() === uname.toLowerCase());
    if (found) {
      onLogin(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Background Decor */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card matching Screenshot 1 */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 max-w-sm w-full p-8 relative z-10 animate-in fade-in zoom-in-95">
        {/* Logo Badge matching Screenshot 1 */}
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="w-20 h-20 rounded-full shadow-lg" />

          <h1 className="text-2xl font-black text-sky-950 mt-4 tracking-tight">
            الساري للبث الأرضي
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            الوكيل الرسمي لقنوات الرابعة الرياضية - إدارة المركز والوكلاء
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              اسم الحساب / المستخدم
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: ahmed أو admin"
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all text-xs font-semibold text-slate-800 placeholder:text-slate-400"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all text-xs font-semibold text-slate-800 placeholder:text-slate-400"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-sky-900 hover:bg-sky-800 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all"
          >
            تسجيل الدخول
          </button>
        </form>

        {/* Quick Demo Login Picker */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <div className="text-[11px] font-bold text-slate-400 mb-2">الدخول السريع للحسابات:</div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
            <button
              onClick={() => handleQuickLogin('abodsari')}
              className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold border border-sky-200 transition-colors"
            >
              أدمن المركز
            </button>
            <button
              onClick={() => handleQuickLogin('sahir')}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
              وكيل ابو ساهر
            </button>
            <button
              onClick={() => handleQuickLogin('laith')}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
              وكيل ليث جاسم
            </button>
            <button
              onClick={() => handleQuickLogin('abdullah')}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
              وكيل عبدالله
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
        تصميم وبرمجة | م. ياسر المعجون
      </div>
    </div>
  );
};
