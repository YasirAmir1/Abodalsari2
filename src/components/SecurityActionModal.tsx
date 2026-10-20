/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, AlertOctagon, Lock, Key, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { auditService, AdministrativeAuditLog } from '../services/auditService';

export interface SecurityActionModalProps {
  isOpen: boolean;
  actionType: AdministrativeAuditLog['action'];
  actionName: string;
  targetDescription: string;
  targetId?: string;
  details?: Array<{ label: string; value: string | number; isHighlight?: boolean }>;
  confirmButtonText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const SecurityActionModal: React.FC<SecurityActionModalProps> = ({
  isOpen,
  actionType,
  actionName,
  targetDescription,
  targetId,
  details = [],
  confirmButtonText = 'تأكيد وتنفيذ الإجراء النهائي',
  onConfirm,
  onClose
}) => {
  // Generate a random 4-digit security PIN each time modal opens
  const securityPin = useMemo(() => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }, [isOpen]);

  const [inputConfirmation, setInputConfirmation] = useState('');
  const [errorShake, setErrorShake] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputConfirmation('');
      setErrorShake(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Check if input matches PIN or accepted Arabic/English confirmation words
  const isCodeMatched =
    inputConfirmation.trim() === securityPin ||
    inputConfirmation.trim().toLowerCase() === 'تأكيد' ||
    inputConfirmation.trim().toLowerCase() === 'confirm';

  const handleExecute = () => {
    if (!isCodeMatched) {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
      return;
    }

    // Convert details array to object for audit record
    const detailsMap: Record<string, unknown> = {};
    details.forEach((d) => {
      detailsMap[d.label] = d.value;
    });

    // Record high-security audit log entry
    auditService.logAction({
      action: actionType,
      title: actionName,
      description: targetDescription,
      targetId,
      details: detailsMap
    });

    onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in duration-200"
      dir="rtl"
      // Explicitly un-dismissible: clicks on backdrop do NOT close modal
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white dark:bg-slate-900 border-2 border-red-600 dark:border-red-500/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl shadow-red-950/50 text-right animate-in zoom-in-95 duration-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Urgent diagonal stripes indicator in top header */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        {/* Header with Shield Alert */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-red-100 dark:border-red-950/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/80 border-2 border-red-300 dark:border-red-700/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs">
                  إجراء أمني حرج
                </span>
                <span className="text-[11px] font-mono font-bold text-red-600 dark:text-red-400">
                  {actionType}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                تنبيه أمني عالي الخطورة - إجراء إداري نهائي
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="إلغاء والتراجع"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Description Box */}
        <div className="my-4 space-y-3">
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-900 dark:text-red-200 font-semibold leading-relaxed">
              <p className="font-black text-red-950 dark:text-red-100 text-[13px] mb-1">
                {actionName}
              </p>
              <p>{targetDescription}</p>
              <p className="mt-1.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                ⚠️ تنبيه: هذا الإجراء الإداري نهائي ولا يمكن الرجوع فيه أو استعادة البيانات بعد تأكيده.
              </p>
            </div>
          </div>

          {/* Details Summary Table */}
          {details.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                بيانات العملية الإدارية:
              </div>
              {details.map((d, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80 last:border-0">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{d.label}:</span>
                  <span className={`font-mono font-bold ${d.isHighlight ? 'text-red-600 dark:text-red-400 text-sm' : 'text-slate-900 dark:text-slate-100'}`}>
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Active Confirmation Step */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                <Key className="w-4 h-4 text-amber-600" />
                <span>رمز الأمان المطلوب لإلغاء القفل:</span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 font-mono text-base font-black tracking-widest border border-amber-400 select-all">
                {securityPin}
              </div>
            </div>

            <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              لحماية البيانات من الضغط الخاطئ، يرجى كتابة رمز الأمان (<strong className="font-mono text-amber-950 dark:text-white font-bold">{securityPin}</strong>) أو كلمة <strong className="font-bold text-amber-950 dark:text-white">تأكيد</strong> في الحقل أدناه لتفعيل زر الإجراء:
            </div>

            <div className={`relative ${errorShake ? 'animate-shake' : ''}`}>
              <input
                type="text"
                autoFocus
                value={inputConfirmation}
                onChange={(e) => setInputConfirmation(e.target.value)}
                placeholder={`أدخل ${securityPin} أو كلمة تأكيد هنا...`}
                className={`w-full px-4 py-2.5 text-sm font-mono font-bold rounded-xl border text-center transition-all outline-none ${
                  isCodeMatched
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-300'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-red-500 focus:ring-2 focus:ring-red-200'
                }`}
              />
              {isCodeMatched && (
                <div className="absolute left-3 top-3 text-emerald-600 flex items-center gap-1 text-xs font-bold animate-in zoom-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم التحقق</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            إلغاء والتراجع
          </button>

          <button
            type="button"
            disabled={!isCodeMatched}
            onClick={handleExecute}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md ${
              isCodeMatched
                ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95 shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
            }`}
          >
            <Lock className={`w-3.5 h-3.5 ${isCodeMatched ? 'hidden' : 'inline'}`} />
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
