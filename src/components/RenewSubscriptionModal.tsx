import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Save, MessageSquare, X } from 'lucide-react';
import { Agent, PricingRow, Subscriber, SubscriptionDuration } from '../types';

interface RenewSubscriptionModalProps {
  subscriber: Subscriber;
  agents: Agent[];
  pricing: PricingRow[];
  onClose: () => void;
  onSaveAndActivate: (
    updatedSubscriber: Subscriber,
    isDebt: boolean,
    amount: number
  ) => void;
  onWhatsApp: (sub: Subscriber) => void;
}

export const RenewSubscriptionModal: React.FC<RenewSubscriptionModalProps> = ({
  subscriber,
  agents,
  pricing,
  onClose,
  onSaveAndActivate,
  onWhatsApp
}) => {
  const [name, setName] = useState(subscriber.name);
  const [phone, setPhone] = useState(subscriber.phone);
  const [agentId, setAgentId] = useState(subscriber.agentId || 'agent-main');

  const [duration, setDuration] = useState<SubscriptionDuration>('1 شهر');
  const [paymentMethod, setPaymentMethod] = useState<'دين (تسجيل دين)' | 'نقد (مسدد)'>('دين (تسجيل دين)');

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);

  const calculateEndDate = (start: string, dur: SubscriptionDuration): string => {
    const d = new Date(start);
    if (dur === '1 شهر') d.setMonth(d.getMonth() + 1);
    else if (dur === 'شهرين') d.setMonth(d.getMonth() + 2);
    else if (dur === '3 أشهر') d.setMonth(d.getMonth() + 3);
    else d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  };

  const [endDate, setEndDate] = useState(() => calculateEndDate(todayStr, '1 شهر'));

  // Calculate price based on selected agent and duration with fallback
  const agentPricing = pricing.find((p) => p.agentId === agentId)
    || pricing.find((p) => p.agentName?.trim().toLowerCase() === subscriber.agentName?.trim().toLowerCase())
    || pricing.find((p) => p.isReference)
    || pricing[0];

  const defaultPrice =
    duration === '1 شهر'
      ? agentPricing?.oneMonthPrice || 22000
      : duration === 'شهرين'
      ? agentPricing?.twoMonthsPrice || 44000
      : duration === '3 أشهر'
      ? agentPricing?.threeMonthsPrice || 60000
      : 22000;

  const [price, setPrice] = useState<number>(defaultPrice);

  const handleDurationChange = (newDur: SubscriptionDuration) => {
    setDuration(newDur);
    setEndDate(calculateEndDate(startDate, newDur));

    const newPrice =
      newDur === '1 شهر'
        ? agentPricing?.oneMonthPrice || 25000
        : newDur === 'شهرين'
        ? agentPricing?.twoMonthsPrice || 50000
        : newDur === '3 أشهر'
        ? agentPricing?.threeMonthsPrice || 75000
        : agentPricing?.threeMonthsPrice || 75000;
    setPrice(newPrice);
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    setEndDate(calculateEndDate(newStart, duration));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedAgent = agents.find((a) => a.id === agentId)
      || agents.find((a) => a.name === subscriber.agentName)
      || agents[0]
      || { id: subscriber.agentId || 'agent-main', name: subscriber.agentName || 'المركز الرئيسي' };
    const isDebt = paymentMethod === 'دين (تسجيل دين)';

    const rawDev = (subscriber.deviceId || '').trim();
    const cleanDeviceId = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';

    const updated: Subscriber = {
      ...subscriber,
      deviceId: cleanDeviceId,
      name,
      phone,
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      subscriptionType: duration,
      status: 'active',
      paymentStatus: isDebt ? 'debt' : 'paid',
      amount: price,
      startDate,
      endDate
    };

    onSaveAndActivate(updated, isDebt, price);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Screenshot 3 */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-sky-950">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
              <RefreshCw className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base">
              تجديد اشتراك وتعديل بيانات المشترك: {subscriber.name}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {/* Top Row: Name, Phone, Agent */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم المشترك *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0770xxxxxxx"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">المالك / الوكيل *</label>
              <div className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>{subscriber.agentName || 'المركز الرئيسي'}</span>
                <span className="text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md font-bold">المركز الرئيسي</span>
              </div>
            </div>
          </div>

          {/* Inner Card matching Screenshot 3 with QR code and duration/pricing controls */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Left 2 Columns: Pricing, Dates, Duration */}
            <div className="md:col-span-2 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع الاشتراك *</label>
                  <select
                    value={duration}
                    onChange={(e) => handleDurationChange(e.target.value as SubscriptionDuration)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="1 شهر">1 شهر (شهر واحد)</option>
                    <option value="شهرين">شهرين (شهرين اثنين)</option>
                    <option value="3 أشهر">3 أشهر (3 أشهر)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الدفع *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl border-2 bg-white font-bold focus:ring-2 ${
                      paymentMethod === 'نقد (مسدد)'
                        ? 'border-emerald-500 text-emerald-700 focus:ring-emerald-500'
                        : 'border-red-400 text-red-600 focus:ring-red-500'
                    }`}
                  >
                    <option value="دين (تسجيل دين)" className="text-red-600 font-bold">دين (تسجيل دين)</option>
                    <option value="نقد (مسدد)" className="text-emerald-700 font-bold">نقد (مسدد نقدياً)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ البدء (التفعيل) *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الانتهاء *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Price Row */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">السعر الإجمالي (د.ع) *</label>
                  <span className="text-[10px] text-slate-400">محتسب تلقائياً حسب فترة الاشتراك (قابل للتعديل)</span>
                </div>
                <input
                  type="number"
                  step={500}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-center font-black text-sky-800 text-base font-mono focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Right Column: Device ID & QR Code matching Screenshot 3 */}
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="text-[11px] font-bold text-slate-600 mb-1">رقم الجهاز *</div>
              <div className="w-full py-1.5 px-3 rounded-xl bg-sky-50 text-sky-900 font-mono font-black text-sm tracking-wider mb-3 border border-sky-100">
                {subscriber.deviceId}
              </div>

              {/* Real QR Code */}
              <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-xs">
                <QRCodeSVG
                  value={subscriber.deviceId}
                  size={120}
                  level="M"
                />
              </div>
              <span className="text-[10px] text-slate-500 font-bold mt-2">📱 QR كود الجهاز</span>
            </div>
          </div>

          {/* Bottom Action Bar matching Screenshot 3 */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {/* Left buttons in RTL */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-sky-800 hover:bg-sky-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-colors"
              >
                <span>💾 حفظ وتفعيل الاشتراك</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>

            {/* Right button in RTL: WhatsApp share */}
            <button
              type="button"
              onClick={() => onWhatsApp(subscriber)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <MessageSquare className="w-4 h-4 fill-emerald-100" />
              <span>مشاركة واتساب</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
