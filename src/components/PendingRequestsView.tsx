import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  CheckCircle,
  XCircle,
  Check,
  X,
  PlusCircle,
  Play,
  User,
  Radio,
  Clock,
  Sparkles,
  Music,
  Upload
} from 'lucide-react';
import { Agent, PaymentStatus, PendingRenewalRequest, Subscriber, SubscriptionDuration } from '../types';
import { soundService } from '../services/soundService';
import { CustomModal } from './CustomModal';

interface PendingRequestsViewProps {
  pendingRequests: PendingRenewalRequest[];
  agents: Agent[];
  subscribers: Subscriber[];
  onApproveRequest: (
    requestId: string,
    overrides?: {
      status?: 'active' | 'inactive';
      amount?: number;
      startDate?: string;
      duration?: SubscriptionDuration;
      paymentStatus?: PaymentStatus;
    }
  ) => void;
  onRejectRequest: (requestId: string) => void;
  onSimulateIncomingRequest: () => void;
}

export const PendingRequestsView: React.FC<PendingRequestsViewProps> = ({
  pendingRequests,
  agents,
  subscribers,
  onApproveRequest,
  onRejectRequest,
  onSimulateIncomingRequest
}) => {
  const [isMuted, setIsMuted] = useState(soundService.getMuted());
  const [repeatAlert, setRepeatAlert] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState('20');
  const [toneType, setToneType] = useState(soundService.getToneType());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activatingRequest, setActivatingRequest] = useState<PendingRenewalRequest | null>(null);
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editAmount, setEditAmount] = useState<number>(22000);
  const [editStartDate, setEditStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [editDuration, setEditDuration] = useState<SubscriptionDuration>('1 شهر');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const [modalInfo, setModalInfo] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  // Manage repeat sound alert when there are pending requests
  useEffect(() => {
    if (pendingRequests.length > 0 && repeatAlert && !isMuted) {
      soundService.startRepeatAlert(10);
    } else {
      soundService.stopRepeat();
    }
    return () => {
      soundService.stopRepeat();
    };
  }, [pendingRequests.length, repeatAlert, isMuted]);

  const handleToggleMute = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  const handleTestSound = () => {
    soundService.playTestBeep();
  };

  const handleToneChange = (type: any) => {
    setToneType(type);
    soundService.setToneType(type);
    soundService.playPendingAlert();
  };

  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        await soundService.setCustomAudio(e.target.files[0]);
        setToneType('custom');
        soundService.playPendingAlert();
      } catch {
        setModalInfo({ isOpen: true, title: 'خطأ', message: 'تعذر تشغيل الملف الصوتي', type: 'error' });
      }
    }
  };

  const handleOpenActivate = (req: PendingRenewalRequest) => {
    setActivatingRequest(req);
    setEditStatus('active');
    setEditAmount(req.amount || 22000);
    setEditStartDate(new Date().toISOString().split('T')[0]);
    setEditDuration(req.duration || '1 شهر');
    setEditPaymentStatus('paid');
  };

  const handleConfirmActivation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activatingRequest) return;
    onApproveRequest(activatingRequest.id, {
      status: editStatus,
      amount: editAmount,
      startDate: editStartDate,
      duration: editDuration,
      paymentStatus: editPaymentStatus
    });
    setActivatingRequest(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header matching Screenshot 3 */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="text-xs font-semibold text-sky-700 dark:text-sky-400 mb-1">إدارة طلبات الوكلاء</div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          الطلبات المعلقة (طلبات التجديد الواردة من الوكلاء)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          مراجعة والاعتماد الفوري لطلبات تجديد الاشتراكات الواردة من كافة الوكلاء باستخدام بطاقات المعالجة مع التنبيه الفوري
        </p>

        {/* Audio and Controls Bar matching Screenshot */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pending count badge */}
            <span className="px-3.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/80 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>الطلبات المعلقة: {pendingRequests.length}</span>
            </span>

            {/* Test sound button */}
            <button
              onClick={handleTestSound}
              className="px-3.5 py-1.5 rounded-xl bg-amber-950/30 hover:bg-amber-900/40 border border-amber-600/70 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="تشغيل وتجربة نغمة التنبيه"
            >
              <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>تجربة الصوت</span>
            </button>

            {/* Volume selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-700/80 text-xs font-semibold text-slate-200">
              <span className="text-slate-400">مستوى الصوت:</span>
              <select
                value={volumeLevel}
                onChange={(e) => {
                  setVolumeLevel(e.target.value);
                  soundService.setVolume(Number(e.target.value) / 100);
                }}
                className="bg-transparent font-mono font-bold text-sky-400 focus:outline-none cursor-pointer"
              >
                <option value="10">X 10</option>
                <option value="20">X 20</option>
                <option value="50">X 50</option>
                <option value="80">X 80</option>
                <option value="100">X 100</option>
              </select>
            </div>

            {/* Repeat alert toggle */}
            <button
              onClick={() => setRepeatAlert(!repeatAlert)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                repeatAlert
                  ? 'bg-teal-950/50 border-teal-500/70 text-teal-300'
                  : 'bg-slate-900/60 border-slate-700 text-slate-400'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>التنبيه المتكرر: {repeatAlert ? 'مفعل' : 'معطل'}</span>
            </button>

            {/* Mute toggle */}
            <button
              onClick={handleToggleMute}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isMuted
                  ? 'bg-slate-900/60 border-slate-700 text-slate-300'
                  : 'bg-emerald-950/50 border-emerald-500/70 text-emerald-300'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span>صوت التنبيه: {isMuted ? 'مكتوم' : 'رنين'}</span>
            </button>

            {/* Chime Melody Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-950/30 border border-sky-800/60 text-xs font-semibold text-sky-300">
              <Music className="w-3.5 h-3.5 text-sky-400" />
              <span>النغمة:</span>
              <select
                value={toneType}
                onChange={(e) => handleToneChange(e.target.value)}
                className="bg-transparent font-bold focus:outline-none cursor-pointer"
              >
                <option value="westminster">رنين الأجراس الرسمي</option>
                <option value="dingdong">رنين كلاسيكي (Ding-Dong)</option>
                <option value="digital">تنبيه رقمي</option>
                <option value="custom">ملف مخصص</option>
              </select>
            </div>

            {/* Upload Custom Audio File */}
            <label
              className="p-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer text-xs font-semibold flex items-center gap-1 transition-colors"
              title="رفع ملف نغمة تنبيه مخصصة (MP3/WAV)"
            >
              <Upload className="w-3.5 h-3.5" />
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleCustomFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Main Container matching Screenshot */}
      <div className="bg-slate-900 rounded-3xl border border-amber-500/50 p-8 min-h-[380px] flex flex-col justify-center items-center shadow-lg">
        <div className="w-full text-right mb-4">
          <span className="text-xs font-extrabold text-amber-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            قائمة طلبات التجديد الواردة من الوكلاء ({pendingRequests.length})
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          /* Empty State exactly matching the screenshot */
          <div className="py-12 flex flex-col items-center justify-center text-center max-w-md animate-in fade-in">
            <div className="w-14 h-14 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg mb-4 ring-4 ring-emerald-500/20 border-2 border-black/40">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>

            <h3 className="text-lg font-black text-slate-100 mb-2">لا توجد طلبات معلقة حالياً</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              جميع طلبات التجديد الواردة من الوكلاء تم اعتمادها أو رفضها بنجاح، وسينبهك النظام فور وصول أي طلب جديد.
            </p>
          </div>
        ) : (
          /* Incoming Request Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-bold text-[11px] border border-amber-200 dark:border-amber-700">
                      طلب من: {req.agentName}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{req.requestDate}</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">اسم المشترك:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{req.subscriberName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">رقم الجهاز:</span>
                      <span className="font-mono font-bold text-sky-700 dark:text-sky-300">{req.deviceId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">الهاتف:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{req.subscriberPhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">نوع الباقة المطلوبة:</span>
                      <span className="font-bold text-teal-700 dark:text-teal-300">{req.duration}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">المبلغ المحتسب:</span>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">{req.amount.toLocaleString()} د.ع</span>
                    </div>
                    {req.notes && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-[11px] text-slate-600 dark:text-slate-400">
                        ملاحظة الوكيل: {req.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenActivate(req)}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>اعتماد وتفعيل</span>
                  </button>
                  <button
                    onClick={() => onRejectRequest(req.id)}
                    className="py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>رفض الطلب</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activation / Approval Modal matching edit subscriber modal */}
      {activatingRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                اعتماد وتفعيل طلب المشترك: {activatingRequest.subscriberName}
              </h3>
              <button onClick={() => setActivatingRequest(null)} className="text-slate-400 p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmActivation} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">حالة المشترك</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value="active">فعال</option>
                  <option value="inactive">غير فعال</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المبلغ (د.ع)</label>
                <input
                  type="number"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ بدء الاشتراك</label>
                <input
                  type="date"
                  required
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نوع الاشتراك / المدة</label>
                <select
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value="1 شهر">1 شهر (30 يوماً)</option>
                  <option value="شهرين">شهرين (60 يوماً)</option>
                  <option value="3 أشهر">3 أشهر (90 يوماً)</option>
                  <option value="6 أشهر">6 أشهر (نصف سنوي)</option>
                  <option value="سنة">سنة كاملة (12 شهر)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">طريقة السداد *</label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                  className={`w-full px-3 py-2 rounded-xl border-2 bg-white dark:bg-slate-800 font-bold focus:ring-2 ${
                    editPaymentStatus === 'paid'
                      ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 focus:ring-emerald-500'
                      : 'border-red-400 text-red-600 dark:text-red-300 focus:ring-red-500'
                  }`}
                >
                  <option value="paid" className="text-emerald-700 font-bold">نقد (مسدد نقدياً)</option>
                  <option value="debt" className="text-red-600 font-bold">دين (تسجيل كـ دين)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActivatingRequest(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm cursor-pointer"
                >
                  تأكيد الاعتماد والتفعيل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Info / Warning Notification Modal */}
      <CustomModal
        isOpen={modalInfo.isOpen}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type || 'info'}
        onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}
      />
    </div>
  );
};
