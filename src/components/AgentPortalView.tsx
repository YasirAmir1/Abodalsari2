import React, { useState } from 'react';
import {
  Tv,
  Users,
  CreditCard,
  PlusCircle,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Send,
  Package,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Agent, PendingRenewalRequest, PricingRow, Product, Subscriber, SubscriptionDuration } from '../types';
import { getPriceByDuration } from '../utils/pricingUtils';

interface AgentPortalViewProps {
  currentAgent: Agent;
  subscribers: Subscriber[];
  products: Product[];
  pricing: PricingRow[];
  onSubmitRenewalOrder: (order: Omit<PendingRenewalRequest, 'id' | 'status'>) => void;
  onOpenWhatsApp: (sub: Subscriber) => void;
  onUpdateBranding: (agentId: string, branding: Partial<Agent>) => void;
  onSelectDeviceQr?: (deviceId: string, subscriberName?: string, agentName?: string) => void;
}

export const AgentPortalView: React.FC<AgentPortalViewProps> = ({
  currentAgent,
  subscribers,
  products,
  pricing,
  onSubmitRenewalOrder,
  onOpenWhatsApp,
  onUpdateBranding,
  onSelectDeviceQr
}) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderSentToast, setOrderSentToast] = useState(false);

  // Order form state
  const [selectedSubId, setSelectedSubId] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [showSubSuggestions, setShowSubSuggestions] = useState(false);
  const [orderDuration, setOrderDuration] = useState<SubscriptionDuration>('1 Ø´Ù‡Ø±');
  const [orderNotes, setOrderNotes] = useState('');

  // Agent's subscribers
  const agentSubs = subscribers.filter((s) => s.agentId === currentAgent.id);

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    let sub = agentSubs.find((s) => s.id === selectedSubId);
    if (!sub && subSearchQuery.trim()) {
      sub = agentSubs.find((s) => s.name.toLowerCase().includes(subSearchQuery.toLowerCase()) || s.deviceId === subSearchQuery);
    }
    if (!sub) {
      alert('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ø£Ùˆ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù… Ù…Ø´ØªØ±Ùƒ ØµØ­ÙŠØ­ Ø§Ù„ØªØ§Ø¨Ø¹ Ù„ÙˆÙƒØ§Ù„ØªÙƒ');
      return;
    }

    const price = getPriceByDuration(currentAgent.id, orderDuration, pricing);

    const rawDev = (sub.deviceId || '').trim();
    const finalDev = rawDev ? (rawDev.startsWith('00') ? rawDev : `00${rawDev}`) : '';

    onSubmitRenewalOrder({
      subscriberId: sub.id,
      subscriberName: sub.name,
      deviceId: finalDev,
      subscriberPhone: sub.phone,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      duration: orderDuration,
      amount: price,
      requestDate: new Date().toISOString().split('T')[0],
      notes: orderNotes
    });

    setShowOrderModal(false);
    setSelectedSubId('');
    setSubSearchQuery('');
    setOrderNotes('');
    setOrderSentToast(true);
    setTimeout(() => setOrderSentToast(false), 4000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Agent Brand Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-2xl flex items-center justify-center shadow-lg">
            {currentAgent.avatarInitials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-400 text-slate-900 font-extrabold px-2.5 py-0.5 rounded-full">
                ÙˆÙƒÙŠÙ„ Ø±Ø³Ù…ÙŠ Ù…Ø¹ØªÙ…Ø¯
              </span>
              <span className="text-xs text-sky-200 font-mono font-bold">{currentAgent.code}</span>
            </div>
            <h2 className="text-2xl font-black mt-1">
              {currentAgent.customShopName || currentAgent.name}
            </h2>
            <p className="text-xs text-sky-200 mt-0.5">
              ÙˆÙƒÙŠÙ„ Ù‚Ù†ÙˆØ§Øª Ø§Ù„Ø±Ø§Ø¨Ø¹Ø© Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ© - {currentAgent.region} | Ù‡Ø§ØªÙ: {currentAgent.phone}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowOrderModal(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Ø·Ù„Ø¨ ØªØ¬Ø¯ÙŠØ¯ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ ÙÙˆØ±ÙŠ</span>
          </button>
        </div>
      </div>

      {/* 4 Agent Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„ÙˆÙƒØ§Ù„Ø©</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {currentAgent.totalSales.toLocaleString()} <span className="text-xs font-bold text-slate-400">Ø¯.Ø¹</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ù…Ø¨ÙŠØ¹Ø§Øª ØªØ±Ø§ÙƒÙ…ÙŠØ© Ù…ÙˆØ«Ù‚Ø©</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø³Ø¯Ø¯ Ù„Ù„Ù…Ø±ÙƒØ²</div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-2 font-mono">
            {currentAgent.totalPaid.toLocaleString()} <span className="text-xs font-bold text-emerald-400">Ø¯.Ø¹</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">Ø­Ø³Ø§Ø¨Ø§Øª Ù…Ù‚Ø¨ÙˆØ¶Ø©</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ø¨Ø°Ù…ØªÙƒ (Ø§Ù„Ø¯ÙŠÙˆÙ†)</div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-2 font-mono">
            {currentAgent.totalDebt.toLocaleString()} <span className="text-xs font-bold text-red-400">Ø¯.Ø¹</span>
          </div>
          <div className="text-[11px] text-red-500 mt-1">
            {currentAgent.totalDebt > 0 ? 'Ù…Ø³ØªØ­Ù‚ Ø§Ù„Ø³Ø¯Ø§Ø¯ Ù„Ù„Ù…Ø±ÙƒØ²' : 'Ø§Ù„Ø­Ø³Ø§Ø¨ Ø®Ø§Ù„Øµ'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Ø§Ù„Ù…Ø´ØªØ±ÙƒÙˆÙ† Ø§Ù„ØªØ§Ø¨Ø¹ÙˆÙ† Ù„ÙˆÙƒØ§Ù„ØªÙƒ</div>
          <div className="text-2xl font-black text-sky-800 dark:text-sky-400 mt-2 font-mono">
            {agentSubs.length} <span className="text-xs font-bold text-slate-400">Ù…Ø´ØªØ±Ùƒ</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {agentSubs.filter((s) => s.status === 'active').length} ÙØ¹Ø§Ù„ Ø­Ø§Ù„ÙŠØ§Ù‹
          </div>
        </div>
      </div>

      {/* Agent's Subscribers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Ù…Ø´ØªØ±ÙƒÙˆ Ø¨Ø§Ù‚Ø§Øª Ø§Ù„Ø±Ø§Ø¨Ø¹Ø© Ø§Ù„ØªØ§Ø¨Ø¹ÙˆÙ† Ù„Ù…ÙƒØªØ¨Ùƒ</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ÙŠÙ…ÙƒÙ†Ùƒ Ø·Ù„Ø¨ ØªØ¬Ø¯ÙŠØ¯ ÙÙˆØ±ÙŠ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ§Ù‹ Ø£Ùˆ Ù…Ø±Ø§Ø³Ù„Ø© Ø§Ù„Ù…Ø´ØªØ±Ùƒ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨ Ø¨Ø¶ØºØ·Ø© Ø²Ø±
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3 px-4">Ø§Ø³Ù… Ø§Ù„Ù…Ø´ØªØ±Ùƒ</th>
                <th className="py-3 px-3">Ø±Ù‚Ù… Ø§Ù„Ø¬Ù‡Ø§Ø²</th>
                <th className="py-3 px-3">Ø§Ù„Ù‡Ø§ØªÙ</th>
                <th className="py-3 px-3">Ù†ÙˆØ¹ Ø§Ù„Ø¨Ø§Ù‚Ø©</th>
                <th className="py-3 px-3">Ø§Ù„Ù…Ø¨Ù„Øº</th>
                <th className="py-3 px-3">Ø­Ø§Ù„Ø© Ø§Ù„Ø¨Ø«</th>
                <th className="py-3 px-3">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡</th>
                <th className="py-3 px-4 text-center">Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø³Ø±ÙŠØ¹Ø©</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {agentSubs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø´ØªØ±ÙƒÙˆÙ† Ù…Ø³Ø¬Ù„ÙˆÙ† Ù„Ù‡Ø°Ø§ Ø§Ù„ÙˆÙƒÙŠÙ„ Ø­Ø§Ù„ÙŠØ§Ù‹.
                  </td>
                </tr>
              ) : (
                agentSubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{sub.name}</td>
                    <td className="py-3 px-3 font-mono">
                      <button
                        onClick={() => onSelectDeviceQr && onSelectDeviceQr(sub.deviceId, sub.name, currentAgent.name)}
                        className="font-bold text-sky-800 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                        title="Ø¹Ø±Ø¶ Ø±Ù…Ø² QR Ù„Ù„Ø¬Ù‡Ø§Ø²"
                      >
                        <span>ðŸ“± {sub.deviceId}</span>
                      </button>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{sub.phone}</td>
                    <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">{sub.status === 'active' && sub.subscriptionType !== '-' ? sub.subscriptionType : '-'}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {(sub.amount || 0).toLocaleString()} <span className="text-[10px] text-slate-400">Ø¯.Ø¹</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                        }`}
                      >
                        {sub.status === 'active' ? 'ÙØ¹Ø§Ù„' : 'ØºÙŠØ± ÙØ¹Ø§Ù„'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{sub.status === 'active' && sub.endDate ? sub.endDate : '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {sub.status !== 'active' && (
                          <button
                            onClick={() => {
                              setSelectedSubId(sub.id);
                              setSubSearchQuery(sub.name);
                              setShowOrderModal(true);
                            }}
                            className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Ø·Ù„Ø¨ ØªØ¬Ø¯ÙŠØ¯</span>
                          </button>
                        )}

                        <button
                          onClick={() => onOpenWhatsApp(sub)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
                          title="Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø© ÙˆØ§ØªØ³Ø§Ø¨"
                        >
                          <MessageSquare className="w-4 h-4 fill-emerald-100" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Submit Electronic Renewal Order */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Ø¥Ø±Ø³Ø§Ù„ Ø·Ù„Ø¨ ØªØ¬Ø¯ÙŠØ¯ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù„Ù„Ù…Ø±ÙƒØ²</h3>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 p-1 cursor-pointer">
                âœ•
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ø§Ø®ØªØ± Ø§Ù„Ù…Ø´ØªØ±Ùƒ Ø£Ùˆ Ø§ÙƒØªØ¨ Ø§Ø³Ù… Ø§Ù„Ù…Ø´ØªØ±Ùƒ *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={subSearchQuery}
                    onChange={(e) => {
                      setSubSearchQuery(e.target.value);
                      setShowSubSuggestions(true);
                      const found = agentSubs.find(
                        (s) => s.name.toLowerCase() === e.target.value.toLowerCase() || s.deviceId === e.target.value
                      );
                      if (found) setSelectedSubId(found.id);
                      else setSelectedSubId('');
                    }}
                    onFocus={() => setShowSubSuggestions(true)}
                    placeholder="Ø§Ø¨Ø­Ø« Ø¨Ø§Ù„Ø§Ø³Ù… Ø£Ùˆ Ø±Ù‚Ù… Ø§Ù„Ø¬Ù‡Ø§Ø² Ø£Ùˆ Ø§ÙƒØªØ¨ Ø§Ø³Ù… Ø§Ù„Ù…Ø´ØªØ±Ùƒ..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                    autoComplete="off"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showSubSuggestions && subSearchQuery.trim().length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {agentSubs
                        .filter((s) => s.name.toLowerCase().includes(subSearchQuery.toLowerCase()) || s.deviceId.includes(subSearchQuery))
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubId(s.id);
                              setSubSearchQuery(s.name);
                              setShowSubSuggestions(false);
                            }}
                            className="w-full px-3 py-2 text-right hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center justify-between transition-colors text-xs cursor-pointer"
                          >
                            <span className="font-bold text-slate-800 dark:text-slate-200">{s.name} - Ø¬Ù‡Ø§Ø²: {s.deviceId}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {s.status === 'active' ? 'ÙØ¹Ø§Ù„' : 'Ù…Ù†ØªÙ‡ÙŠ'}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ø¨Ø§Ù‚Ø© Ø§Ù„ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©</label>
                <select
                  value={orderDuration}
                  onChange={(e) => setOrderDuration(e.target.value as SubscriptionDuration)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value="1 Ø´Ù‡Ø±">1 Ø´Ù‡Ø± (Ø³Ø¹Ø± Ø§Ù„ÙˆÙƒÙŠÙ„: 22,000 Ø¯.Ø¹)</option>
                  <option value="Ø´Ù‡Ø±ÙŠÙ†">Ø´Ù‡Ø±ÙŠÙ† (Ø³Ø¹Ø± Ø§Ù„ÙˆÙƒÙŠÙ„: 36,000 Ø¯.Ø¹)</option>
                  <option value="3 Ø£Ø´Ù‡Ø±">3 Ø£Ø´Ù‡Ø± (Ø³Ø¹Ø± Ø§Ù„ÙˆÙƒÙŠÙ„: 54,000 Ø¯.Ø¹)</option>
                  <option value="6 Ø£Ø´Ù‡Ø±">6 Ø£Ø´Ù‡Ø± (Ø³Ø¹Ø± Ø§Ù„ÙˆÙƒÙŠÙ„: 100,000 Ø¯.Ø¹)</option>
                  <option value="Ø³Ù†Ø©">Ø³Ù†Ø© ÙƒØ§Ù…Ù„Ø© (Ø³Ø¹Ø± Ø§Ù„ÙˆÙƒÙŠÙ„: 190,000 Ø¯.Ø¹)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ù…Ù„Ø§Ø­Ø¸Ø© Ø¥Ø¶Ø§ÙÙŠØ© Ù„Ù„Ù…Ø±ÙƒØ²</label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Ù…Ø«Ø§Ù„: Ø§Ù„Ù…Ø´ØªØ±Ùƒ Ø¯ÙØ¹ ÙƒØ§Ø´ØŒ ÙŠØ±Ø¬Ù‰ ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø¬Ù‡Ø§Ø² ÙÙˆØ±Ø§Ù‹..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                ðŸ“¢ ÙÙˆØ± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨ØŒ Ø³ÙŠØµÙ„ ØªÙ†Ø¨ÙŠÙ‡ ØµÙˆØªÙŠ ÙÙˆØ±ÙŠ Ù„Ù„ÙˆØ­Ø© Ø§Ù„Ù…Ø±ÙƒØ² Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ ÙÙŠ ØµÙØ­Ø© "Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ø¹Ù„Ù‚Ø©" Ù„Ø§Ø¹ØªÙ…Ø§Ø¯Ù‡ ÙˆØªÙØ¹ÙŠÙ„Ù‡ Ù…Ø¨Ø§Ø´Ø±Ø©.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Ø¥Ù„ØºØ§Ø¡
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 disabled:opacity-40 shadow-sm cursor-pointer"
                >
                  Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨ Ù„Ù„Ù…Ø±ÙƒØ² Ø§Ù„Ø¢Ù†
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Sent Toast */}
      {orderSentToast && (
        <div className="fixed bottom-6 left-6 bg-sky-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in z-50 border border-sky-400" dir="rtl">
          <CheckCircle className="w-5 h-5 text-amber-400" />
          <span>ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø·Ù„Ø¨ Ø§Ù„ØªØ¬Ø¯ÙŠØ¯ Ø¨Ù†Ø¬Ø§Ø­ Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø±ÙƒØ² Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ Ù…Ø¹ Ø¥Ø´Ø¹Ø§Ø± ØµÙˆØªÙŠ ÙÙˆØ±ÙŠ!</span>
        </div>
      )}
    </div>
  );
};
