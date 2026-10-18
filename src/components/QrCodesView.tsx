import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Camera,
  FileSpreadsheet,
  Plus,
  Printer,
  Trash2,
  Copy,
  Scan,
  Sparkles,
  Download
} from 'lucide-react';
import { DeviceCode } from '../types';
import { excelService } from '../services/excelService';

interface QrCodesViewProps {
  codes: DeviceCode[];
  onAddCode: (codeStr: string) => void;
  onBatchGenerate: (count: number) => void;
  onDeleteCode: (id: string) => void;
  onClearAllCodes: () => void;
}

export const QrCodesView: React.FC<QrCodesViewProps> = ({
  codes,
  onAddCode,
  onBatchGenerate,
  onDeleteCode,
  onClearAllCodes
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddSingleModal, setShowAddSingleModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [singleCodeInput, setSingleCodeInput] = useState('');
  const [batchCountInput, setBatchCountInput] = useState(10);
  const [scannedResult, setScannedResult] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(codes.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSaveSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleCodeInput.trim()) return;
    onAddCode(singleCodeInput.trim());
    setSingleCodeInput('');
    setShowAddSingleModal(false);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Title Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-blue-900 text-white p-6 rounded-2xl shadow-sm flex items-center justify-between">
        {/* Count Card */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center">
          <div className="text-2xl font-black font-mono">{codes.length}</div>
          <div className="text-[11px] text-sky-200 font-semibold">كود QR مسجل</div>
        </div>

        {/* Right Info */}
        <div className="text-right">
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>إدارة أكواد وأجهزة QR</span>
            <span>📱</span>
          </h2>
          <p className="text-xs text-sky-200 mt-1">
            توليد أرقام الأجهزة المكونة من 16 رقماً، طباعة بطاقات QR، والمسح عبر الكاميرا
          </p>
        </div>
      </div>

      {/* Actions Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Single Code */}
          <button
            onClick={() => setShowAddSingleModal(true)}
            className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة رقم فردي</span>
          </button>

          {/* Batch Generate */}
          <button
            onClick={() => setShowBatchModal(true)}
            className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>توليد دفعة سيريال QR</span>
          </button>

          {/* Camera / USB Scanner */}
          <button
            onClick={() => setShowScannerModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4 text-slate-500" />
            <span>مسح QR بالكاميرا / قارئ USB</span>
          </button>

          {/* Export to Excel */}
          <button
            onClick={() => excelService.exportBarcodes(codes)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير Excel</span>
          </button>
        </div>

        {/* Left Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print PDF / Labels */}
          <button
            onClick={() => setShowPrintModal(true)}
            disabled={codes.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة بطاقات QR ({selectedIds.length > 0 ? selectedIds.length : codes.length})</span>
          </button>

          {/* Reset / Delete All */}
          <button
            onClick={() => {
              if (confirm('هل أنت متأكد من حذف وتصفير كافة الأكواد للبدء من جديد؟')) {
                onClearAllCodes();
                setSelectedIds([]);
              }
            }}
            disabled={codes.length === 0}
            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all border border-red-200 flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف وتصفير الأكواد (للبدء من جديد)</span>
          </button>
        </div>
      </div>

      {/* Select All Checkbox Row */}
      <div className="flex items-center justify-between px-2 text-xs">
        <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={codes.length > 0 && selectedIds.length === codes.length}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="w-4 h-4 text-sky-600 rounded"
          />
          <span>تحديد كافة الأكواد ({codes.length})</span>
        </label>

        <span className="text-slate-400">تم تحديد: {selectedIds.length} كود</span>
      </div>

      {/* Table / Empty State */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
        {codes.length === 0 ? (
          <div className="py-24 text-center text-slate-400 text-xs px-4">
            لا توجد أكواد مسجلة بعد. استخدم زر "إضافة رقم فردي" أو "توليد دفعة سيريال QR" لإضافة أجهزة جديدة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4 w-12 text-center">اختيار</th>
                  <th className="py-3 px-3 w-16 text-center">QR Code</th>
                  <th className="py-3 px-4">كود الجهاز / السيريال (16 رقم)</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3">المشترك المخصص</th>
                  <th className="py-3 px-3">تاريخ التوليد</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelectOne(c.id)}
                        className="w-4 h-4 text-sky-600 rounded"
                      />
                    </td>

                    {/* QR Code thumbnail */}
                    <td className="py-2 px-3 text-center">
                      <div className="p-1 border border-slate-200 rounded-lg inline-block bg-white shadow-xs">
                        <QRCodeSVG value={c.code} size={36} level="L" />
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>{c.code}</span>
                        <button
                          onClick={() => handleCopy(c.code, c.id)}
                          className="p-1 text-slate-400 hover:text-sky-600"
                          title="نسخ الكود"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {copiedId === c.id && (
                          <span className="text-[10px] text-emerald-600 font-bold">تم النسخ!</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          c.status === 'available'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}
                      >
                        {c.status === 'available' ? 'متاح للتركيب' : 'مخصص لمشترك'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {c.assignedToSubscriber || '-'}
                    </td>

                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {c.generatedDate}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onDeleteCode(c.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="حذف الكود"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Single Code */}
      {showAddSingleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">إضافة رقم فردي للجهاز</h3>
              <button onClick={() => setShowAddSingleModal(false)} className="text-slate-400 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingle} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  رقم السيريال (16 رقماً أو 8 أرقام) *
                </label>
                <input
                  type="text"
                  required
                  value={singleCodeInput}
                  onChange={(e) => setSingleCodeInput(e.target.value)}
                  placeholder="مثال: 8492019483019487"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm tracking-wider"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSingleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 shadow-sm"
                >
                  إضافة وحفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Batch Generate */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">توليد دفعة سيريال QR</h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 p-1">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">عدد الأكواد المراد توليدها</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={batchCountInput}
                  onChange={(e) => setBatchCountInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                />
              </div>

              <p className="text-slate-500 text-[11px] leading-relaxed">
                يقوم النظام تلقائياً بتوليد أرقام متسلسلة مشفرة مكونة من 16 رقماً معتمدة لأجهزة الساري والرابعة الرياضية وتوليد بطاقات QR لها.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onBatchGenerate(batchCountInput);
                    setShowBatchModal(false);
                  }}
                  className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800"
                >
                  توليد الآن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR Scanner Simulator */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-right">
              <h3 className="font-extrabold text-base text-slate-900">مسح رمز QR عبر الكاميرا أو قارئ USB</h3>
              <button onClick={() => setShowScannerModal(false)} className="text-slate-400 p-1">
                ✕
              </button>
            </div>

            <div className="my-6 flex flex-col items-center">
              <div className="w-48 h-48 rounded-2xl border-4 border-dashed border-sky-400 bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden shadow-inner">
                <Scan className="w-16 h-16 text-sky-400 animate-pulse" />
                <div className="absolute inset-x-0 h-1 bg-emerald-500 shadow-lg top-1/2 -translate-y-1/2 animate-bounce" />
                <span className="text-[10px] text-slate-400 mt-2 font-mono">QR Camera Scanner</span>
              </div>

              <div className="mt-4 w-full">
                <input
                  type="text"
                  placeholder="امسح رمز QR أو أدخل رقم السيريال..."
                  value={scannedResult}
                  onChange={(e) => setScannedResult(e.target.value)}
                  className="w-full px-3 py-2 text-center rounded-xl border border-slate-300 font-mono text-sm tracking-wider"
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  if (scannedResult) {
                    onAddCode(scannedResult);
                    setScannedResult('');
                    setShowScannerModal(false);
                  }
                }}
                disabled={!scannedResult}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40"
              >
                تأكيد وإضافة الكود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Printable QR Labels */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">طباعة ملصقات وبطاقات QR الرسمية</h3>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-400 p-1">
                ✕
              </button>
            </div>

            {/* Printable Cards Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3" id="printable-labels">
              {(selectedIds.length > 0 ? codes.filter((c) => selectedIds.includes(c.id)) : codes).map((c) => (
                <div
                  key={c.id}
                  className="p-4 border-2 border-slate-800 rounded-2xl flex flex-col items-center text-center bg-white"
                >
                  <div className="text-[12px] font-black text-slate-900">شركة الساري للبث الأرضي</div>
                  <div className="text-[10px] text-slate-600 font-bold">وكيل قنوات الرابعة الرياضية - صلاح الدين</div>

                  {/* Visual QR with real SVG */}
                  <div className="my-3 p-2 bg-white border border-slate-300 rounded-xl shadow-xs">
                    <QRCodeSVG value={c.code} size={110} level="M" />
                  </div>

                  <div className="font-mono font-black text-xs text-slate-900 tracking-wider">{c.code}</div>
                  <div className="text-[9px] text-slate-400 mt-1 font-semibold">ضمان وتشغيل رسمي معتمد</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                إغلاق
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                title="تحويل وحفظ بطاقات QR كملف PDF"
              >
                <Download className="w-4 h-4" />
                <span>تحويل الى PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
