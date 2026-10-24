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
import { QRCodeSVG } from 'qrcode.react';

interface PendingRequestsViewProps {
  pendingRequests: PendingRenewalRequest[];
  agents: Agent[];
  subscribers: Subscriber[];
  onApproveRequest: (
    requestId: string,
    overrides?: {
      amount?: number;
      startDate?: string;
      duration?: SubscriptionDuration;
      paymentStatus?: PaymentStatus;
    }
  ) => void;
  onRejectRequest: (requestId: string) => void;
  onSimulateIncomingRequest: () => void;
}

const isDeviceSaleRequest = (request: PendingRenewalRequest) =>
  request.requestType === 'new_device' || (!request.requestType && (request.subscriberId.startsWith('new-sub-') || request.duration === '-'));

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
  const [editAmount, setEditAmount] = useState<number>(22000);
  const [editStartDate, setEditStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [editDuration, setEditDuration] = useState<SubscriptionDuration>('1 شهر');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'debt'>('paid');
  const activatingDeviceSale = activatingRequest ? isDeviceSaleRequest(activatingRequest) : false;
  const [modalInfo, setModalInfo] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  const visiblePendingRequests = pendingRequests.filter((request) => request.status === 'pending');

  useEffect(() => {
    if (activatingRequest && !visiblePendingRequests.some((request) => request.id === activatingRequest.id)) {
      setActivatingRequest(null);
    }
  }, [activatingRequest, visiblePendingRequests]);

  // Manage repeat sound alert when there are pending requests
  useEffect(() => {
    if (visiblePendingRequests.length > 0 && repeatAlert && !isMuted) {
      soundService.startRepeatAlert(10);
    } else {
      soundService.stopRepeat();
    }
    return () => {
      soundService.stopRepeat();
    };
  }, [visiblePendingRequests.length, repeatAlert, isMuted]);

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
    const isDeviceSale = isDeviceSaleRequest(req);
    setActivatingRequest(req);
    setEditAmount(req.amount || 22000);
    setEditStartDate(new Date().toISOString().split('T')[0]);
    const supportedDurations: SubscriptionDuration[] = ['1 شهر', 'شهرين', '3 أشهر'];
    setEditDuration(isDeviceSale ? '-' : supportedDurations.includes(req.duration) ? req.duration : '1 شهر');
    setEditPaymentStatus('debt');
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activatingRequest || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onApproveRequest(activatingRequest.id, {
        amount: editAmount,
        startDate: editStartDate,
        duration: editDuration,
        paymentStatus: editPaymentStatus
      });
      setActivatingRequest(null);
    } catch (err) {
      console.error('Activation error:', err);
    } finally {
      setIsSubmitting(false);
    }
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

        {/* Audio and Controls Bar matching clean layout */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pending count badge */}
            <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>الطلبات المعلقة: {visiblePendingRequests.length}</span>
            </span>

            {/* Test sound button */}
            <button
              onClick={handleTestSound}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="تشغيل وتجربة نغمة التنبيه"
            >
              <Play className="w-3.5 h-3.5 fill-white text-white" />
              <span>تجربة الصوت</span>
            </button>

            {/* Volume selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400">مستوى الصوت:</span>
              <select
                value={volumeLevel}
                onChange={(e) => {
                  setVolumeLevel(e.target.value);
                  soundService.setVolume(Number(e.target.value) / 100);
                }}
                className="bg-transparent font-mono font-bold text-sky-700 dark:text-sky-400 focus:outline-none cursor-pointer"
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
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
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
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
              <span>صوت التنبيه: {isMuted ? 'مكتوم' : 'رنين'}</span>
            </button>

            {/* Chime Melody Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs font-semibold text-sky-800 dark:text-sky-200">
              <Music className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>النغمة:</span>
              <select
                value={toneType}
                onChange={(e) => handleToneChange(e.target.value)}
                className="bg-transparent font-bold focus:outline-none cursor-pointer text-sky-900 dark:text-sky-100"
              >
                <option value="westminster">رنين الأجراس الرسمي</option>
                <option value="dingdong">رنين كلاسيكي (Ding-Dong)</option>
                <option value="digital">تنبيه رقمي</option>
                <option value="custom">ملف مخصص</option>
              </select>
            </div>

            {/* Upload Custom Audio File */}
            <label
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer text-xs font-semibold flex items-center gap-1 transition-colors"
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

      {/* Main Container - Clean modern theme */}
      <div className="bg-gradient-to-b from-sky-50/50 via-white to-slate-50/70 dark:from-slate-850 dark:via-slate-900 dark:to-slate-900 rounded-3xl border border-sky-100 dark:border-slate-800 p-6 sm:p-8 min-h-[380px] flex flex-col justify-center items-center shadow-xs">
        <div className="w-full text-right mb-5 pb-3 border-b border-sky-100/80 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>قائمة طلبات التجديد الواردة من الوكلاء</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold">
              {visiblePendingRequests.length}
            </span>
          </span>
        </div>

        {visiblePendingRequests.length === 0 ? (
          /* Empty State */
          <div className="py-12 flex flex-col items-center justify-center text-center max-w-md animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs mb-4 ring-8 ring-emerald-50 dark:ring-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>

            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1.5">لا توجد طلبات معلقة حالياً</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              جميع طلبات التجديد الواردة من الوكلاء تم اعتمادها أو رفضها بنجاح، وسينبهك النظام فور وصول أي طلب جديد.
            </p>
          </div>
        ) : (
          /* Incoming Request Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {visiblePendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-xs hover:shadow-md hover:border-sky-300 dark:hover:border-sky-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 font-bold text-[11px] border border-sky-200 dark:border-sky-800">
                      طلب من: {req.agentName}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400 font-mono">{req.requestDate}</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">اسم المشترك:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{req.subscriberName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">رقم الجهاز:</span>
                      <span className="font-mono font-bold text-sky-700 dark:text-sky-300">{req.deviceId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">الهاتف:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{req.subscriberPhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">نوع الطلب / الباقة:</span>
                      <span className="font-bold text-teal-700 dark:text-teal-300">
                        {isDeviceSaleRequest(req) ? 'بيع جهاز جديد فقط' : req.duration}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">المبلغ المحتسب:</span>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">{req.amount.toLocaleString()} د.ع</span>
                    </div>
                    {req.notes && (
                      <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/30">
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
                    <span>{isDeviceSaleRequest(req) ? 'اعتماد بيع الجهاز' : 'اعتماد وتفعيل'}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (activatingRequest?.id === req.id) setActivatingRequest(null);
                      onRejectRequest(req.id);
                    }}
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
                {activatingDeviceSale ? 'اعتماد بيع الجهاز' : 'اعتماد وتفعيل الاشتراك'}: {activatingRequest.subscriberName}
              </h3>
              <button onClick={() => setActivatingRequest(null)} className="text-slate-400 p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmActivation} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">حالة المشترك</label>
                <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  {activatingDeviceSale ? 'غير فعال — بيع جهاز بدون اشتراك' : 'فعال — تجديد معتمد'}
                </div>
              </div>

              {/* Device ID and QR Code */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px]">رقم الجهاز:</span>
                  <span className="font-mono font-black text-sky-700 dark:text-sky-300 text-sm">{activatingRequest.deviceId}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center">
                  <QRCodeSVG value={activatingRequest.deviceId} size={48} />
                </div>
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
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {activatingDeviceSale ? 'تاريخ البيع' : 'تاريخ بدء الاشتراك'}
                </label>
                <input
                  type="date"
                  required
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              {!activatingDeviceSale && <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نوع الاشتراك / المدة</label>
                <select
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value="1 شهر">1 شهر (30 يوماً)</option>
                  <option value="شهرين">شهرين (60 يوماً)</option>
                  <option value="3 أشهر">3 أشهر (90 يوماً)</option>
                </select>
              </div>}

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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>جاري المعالجة...</span>
                    </>
                  ) : (
                    <span>{activatingDeviceSale ? 'تأكيد اعتماد البيع' : 'تأكيد الاعتماد والتفعيل'}</span>
                  )}
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
