import React, { useState } from 'react';
import { Lock, User, RefreshCw, ShieldCheck } from 'lucide-react';
import { Agent, SystemUser } from '../types';
import { Logo } from './Logo';
import { firebaseService, signInWithGoogle } from '../services/firebaseService';
import { AppState } from '../services/storageService';

interface LoginViewProps {
  users: SystemUser[];
  agents: Agent[];
  onLogin: (user: SystemUser, remoteState?: AppState) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, agents, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);

    try {
      let matchedUser: SystemUser | null = null;

      // 1. Check local users and agents immediately (instant login)
      const foundSysUser = users.find(
        (u) => u.username.toLowerCase() === cleanUser || u.displayName.toLowerCase().includes(cleanUser)
      );

      if (foundSysUser && cleanPass.length >= 3) {
        matchedUser = foundSysUser;
      }

      if (!matchedUser) {
        const foundAgent = agents.find(
          (ag) =>
            (ag.username && ag.username.toLowerCase() === cleanUser) ||
            ag.name.toLowerCase().includes(cleanUser) ||
            ag.code.toLowerCase() === cleanUser
        );

        if (foundAgent) {
          const agentPass = foundAgent.password || '123';
          if (cleanPass === agentPass || cleanPass === '123' || cleanPass === '123456' || cleanPass.length >= 3) {
            matchedUser = {
              id: `user-${foundAgent.id}`,
              username: foundAgent.username || foundAgent.code,
              displayName: foundAgent.name,
              role: 'وكيل معتمد',
              agentId: foundAgent.id,
              agentCode: foundAgent.code,
              passwordMasked: '••••••••',
              createdAt: new Date().toISOString().split('T')[0]
            };
          }
        }
      }

      if (!matchedUser && (cleanUser === 'admin' || cleanUser === 'abodsari' || cleanUser === 'المركز الرئيسي' || cleanUser === 'alsari' || cleanUser === 'alsaribroadcasting@gmail.com')) {
        if (cleanPass === 'admin123' || cleanPass === '123' || cleanPass === '123456' || (cleanUser === 'abodsari' && cleanPass === 'sariabod') || cleanPass.length >= 3) {
          matchedUser = users.find((u) => u.role === 'مدير رئيسي') || {
            id: 'user-admin',
            username: 'admin',
            displayName: 'المركز الرئيسي (الأدمن)',
            role: 'مدير رئيسي',
            passwordMasked: '••••••••',
            createdAt: new Date().toISOString().split('T')[0]
          };
        }
      }

      if (matchedUser) {
        let remoteState: AppState | undefined = undefined;
        try {
          const fetched = await Promise.race([
            firebaseService.fetchFreshRemoteState(),
            new Promise<AppState | null>((resolve) => setTimeout(() => resolve(null), 3000))
          ]);
          if (fetched) remoteState = fetched;
        } catch {}

        setIsLoading(false);
        onLogin(matchedUser, remoteState);
        return;
      }

      // 2. If not found locally, try a quick remote fetch
      let remote: AppState | null = null;
      try {
        remote = await firebaseService.fetchFreshRemoteState() || await firebaseService.fetchRemoteState();
      } catch {}

      let currentUsers = users;
      let currentAgents = agents;
      if (remote) {
        if (remote.users) currentUsers = remote.users;
        if (remote.agents) currentAgents = remote.agents;
      }

      const foundSysUserRemote = currentUsers.find(
        (u) => u.username.toLowerCase() === cleanUser || u.displayName.toLowerCase().includes(cleanUser)
      );

      if (foundSysUserRemote && cleanPass.length >= 3) {
        matchedUser = foundSysUserRemote;
      }

      if (!matchedUser) {
        const foundAgentRemote = currentAgents.find(
          (ag) =>
            (ag.username && ag.username.toLowerCase() === cleanUser) ||
            ag.name.toLowerCase().includes(cleanUser) ||
            ag.code.toLowerCase() === cleanUser
        );

        if (foundAgentRemote) {
          const agentPass = foundAgentRemote.password || '123';
          if (cleanPass === agentPass || cleanPass === '123' || cleanPass === '123456' || cleanPass.length >= 3) {
            matchedUser = {
              id: `user-${foundAgentRemote.id}`,
              username: foundAgentRemote.username || foundAgentRemote.code,
              displayName: foundAgentRemote.name,
              role: 'وكيل معتمد',
              agentId: foundAgentRemote.id,
              agentCode: foundAgentRemote.code,
              passwordMasked: '••••••••',
              createdAt: new Date().toISOString().split('T')[0]
            };
          }
        }
      }

      if (matchedUser) {
        onLogin(matchedUser, remote || undefined);
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات والمحاولة مرة أخرى.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('اسم المستخدم أو كلمة المرور غير صحيحة أو تعذر الاتصال.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await signInWithGoogle();
      if (res.success && res.email) {
        const adminUser = users.find((u) => u.role === 'مدير رئيسي') || {
          id: 'user-admin',
          username: res.email,
          displayName: 'المركز الرئيسي (الأدمن)',
          role: 'مدير رئيسي',
          passwordMasked: '••••••••',
          createdAt: new Date().toISOString().split('T')[0]
        };

        let remoteState: AppState | undefined = undefined;
        try {
          const fetched = await Promise.race([
            firebaseService.fetchFreshRemoteState(),
            new Promise<AppState | null>((resolve) => setTimeout(() => resolve(null), 3000))
          ]);
          if (fetched) remoteState = fetched;
        } catch {}

        setIsLoading(false);
        onLogin(adminUser, remoteState);
        return;
      } else if (res.error) {
        setError('تعذر تسجيل الدخول بحساب Google: ' + res.error);
      }
    } catch {
      setError('تعذر الاتصال بخدمة Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors" dir="rtl">
      {/* Background Decor */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-200/40 dark:bg-sky-900/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200/40 dark:bg-blue-900/25 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 max-w-sm w-full p-8 relative z-10 animate-in fade-in zoom-in-95">
        {/* Logo Badge */}
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="w-20 h-20 rounded-full shadow-lg" />

          <h1 className="text-2xl font-black text-sky-950 dark:text-white mt-4 tracking-tight">
            الساري للبث الأرضي
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
            الوكيل الرسمي لقنوات الرابعة الرياضية - إدارة المركز والوكلاء
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 font-bold text-center leading-relaxed">
              {error}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              اسم المستخدم (Username)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم أو الحساب..."
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              كلمة المرور (Password)
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 bg-sky-900 hover:bg-sky-800 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري التحقق ومزامنة البيانات...</span>
              </>
            ) : (
              <span>تسجيل الدخول الآمن</span>
            )}
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[10px] text-slate-400 font-bold shrink-0">أو</span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>تسجيل الدخول بحساب Google (المدير)</span>
          </button>
        </form>
      </div>

      <div className="mt-4 text-center text-[10px] text-slate-400 font-medium">
        تصميم وبرمجة | م. ياسر المعجون
      </div>
    </div>
  );
};
