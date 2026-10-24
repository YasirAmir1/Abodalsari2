import React, { useMemo, useState, useEffect } from 'react';
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
import { jsPDF } from 'jspdf';
import { DeviceCode } from '../types';
import { excelService } from '../services/excelService';
import { useAppDialogs } from './AppDialogProvider';
import { useVirtualizedRows } from './useVirtualizedRows';

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
  const { showConfirm } = useAppDialogs();
  const [activeTab, setActiveTab] = useState<'registry' | 'new_barcodes'>('registry');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddSingleModal, setShowAddSingleModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCustomPrintModal, setShowCustomPrintModal] = useState(false);

  const [singleCodeInput, setSingleCodeInput] = useState('');
  const [batchCountInput, setBatchCountInput] = useState(10);
  const [scannedResult, setScannedResult] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Barcodes Tab State: list of entered code strings
  const [newBarcodesText, setNewBarcodesText] = useState(() => {
    return localStorage.getItem('alsari_pasted_barcodes') || '';
  });
  const [customBarcodes, setCustomBarcodes] = useState<string[]>(() => {
    const saved = localStorage.getItem('alsari_pasted_barcodes') || '';
    return saved.split(/[\r\n\t,]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  });

  const handleParseAndAddCustomBarcodes = (text: string) => {
    setNewBarcodesText(text);
    localStorage.setItem('alsari_pasted_barcodes', text);
    // Split by newlines, tabs, commas, or spaces if pasted from Excel/WhatsApp
    const lines = text
      .split(/[\r\n\t,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setCustomBarcodes(lines);
  };


  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const printableCodes = useMemo(() => {
    if (!showPrintModal) return [];
    return selectedIds.length > 0 ? codes.filter((code) => selectedIdSet.has(code.id)) : codes;
  }, [codes, selectedIdSet, selectedIds.length, showPrintModal]);
  const {
    scrollRef: codeTableRef,
    handleScroll: handleCodeTableScroll,
    visibleRows: visibleCodes,
    topSpacerHeight: codeTopSpacerHeight,
    bottomSpacerHeight: codeBottomSpacerHeight
  } = useVirtualizedRows(codes, 64);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(codes.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
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
    <div className="space-y-6" dir="rtl">
      {/* Title Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-blue-900 text-white p-6 rounded-2xl shadow-sm flex items-center justify-between">
        {/* Count Card */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center">
          <div className="text-2xl font-black font-mono">{activeTab === 'registry' ? codes.length : customBarcodes.length}</div>
          <div className="text-[11px] text-sky-200 font-semibold">{activeTab === 'registry' ? 'كود QR مسجل' : 'باركود جديد مدخل'}</div>
        </div>

        {/* Right Info */}
        <div className="text-right">
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>إدارة أكواد وأجهزة QR</span>
            <span>📱</span>
          </h2>
          <p className="text-xs text-sky-200 mt-1">
            توليد أرقام الأجهزة، طباعة بطاقات QR، وإدخال و لصق الباركودات الجديدة مباشرة
          </p>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('registry')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'registry'
              ? 'bg-sky-700 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>📋 السجل الرئيسي للأكواد ({codes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('new_barcodes')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'new_barcodes'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>✨ باركودات جديدة (لصق ولوليد سريع)</span>
        </button>
      </div>

      {activeTab === 'new_barcodes' ? (
        /* New Barcodes Tab View */
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <label className="block font-bold text-slate-800 text-xs mb-1.5">
                الصق أرقام الباركود والأجهزة هنا (من واتساب، رسالة، أو جدول إكسل):
              </label>
              <textarea
                rows={4}
                value={newBarcodesText}
                onChange={(e) => handleParseAndAddCustomBarcodes(e.target.value)}
                placeholder="الصق الأرقام هنا (كل رقم في سطر أو مفصولة بفواصل أو مسافات)..."
                className="w-full p-3 rounded-2xl border border-slate-300 text-xs font-mono text-slate-800 leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                سيقوم النظام تلقائياً بإنشاء عمود إكسل افتراضي يعرض الأرقام المقبولة وبجانب كل رقم مربع QR-Code خاص به مباشرة.
              </p>
            </div>

            {customBarcodes.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-700 text-xs">
                  تم رصد ومعالجة ({customBarcodes.length}) رقم ورسم رموز الـ QR الخاصة بها:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowCustomPrintModal(true);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>تصدير 9 بالصفحة (PDF)</span>
                  </button>
                  <button
                    onClick={() => {
                      customBarcodes.forEach((code) => onAddCode(code));
                      setCustomBarcodes([]);
                      setNewBarcodesText('');
                      localStorage.removeItem('alsari_pasted_barcodes');
                      setActiveTab('registry');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    حفظ وتصدير الكل إلى السجل الرئيسي ({customBarcodes.length})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Excel-like Table for New Barcodes */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
              <span>جدول باركودات جديدة (اكسل فارغ / معاينة)</span>
              <span className="font-mono text-[11px] text-slate-500">إجمالي السطور: {customBarcodes.length}</span>
            </div>

            {customBarcodes.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                لم يتم إدخال أو لصق أي بيانات بعد. الصق الأبيانات في المربع أعلاه لملء الجدول وتوليد رموز QR مباشرة.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="py-3 px-4 w-16 text-center">#</th>
                      <th className="py-3 px-4">رقم الباركود / الجهاز (عمود الإكسل)</th>
                      <th className="py-3 px-4 text-center">رمز الاستجابة السريعة (QR-Code)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customBarcodes.map((code, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors h-16">
                        <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">{index + 1}</td>
                        <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm select-all">
                          {code}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-block p-1.5 border border-slate-200 rounded-xl bg-white shadow-2xs">
                            <QRCodeSVG value={code} size={50} level="M" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Registry View */
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAddSingleModal(true)}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة رقم فردي</span>
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>توليد دفعة سيريال QR</span>
              </button>
              <button
                onClick={() => setShowScannerModal(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4 text-slate-500" />
                <span>مسح QR بالكاميرا / قارئ USB</span>
              </button>
              <button
                onClick={() => excelService.exportBarcodes(codes)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>تصدير Excel</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowPrintModal(true)}
                disabled={codes.length === 0}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 disabled:opacity-40"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة بطاقات QR ({selectedIds.length > 0 ? selectedIds.length : codes.length})</span>
              </button>
              <button
                onClick={async () => {
                  if (await showConfirm('هل أنت متأكد من حذف وتصفير كافة الأكواد للبدء من جديد؟', 'حذف جميع الأكواد')) {
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
            {codes.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-xs px-4">
                لا توجد أكواد مسجلة بعد. استخدم زر "إضافة رقم فردي" أو "توليد دفعة سيريال QR" لإضافة أجهزة جديدة.
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[70vh] overflow-auto">
                {codes.map((c) => (
                  <div
                    key={c.id}
                    className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center group"
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(c.id)}
                        onChange={() => toggleSelectOne(c.id)}
                        className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                        title="تحديد البطاعة"
                      />
                      <button
                        onClick={() => onDeleteCode(c.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200 cursor-pointer"
                        title="حذف البطاقة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-6 mb-3 flex flex-col items-center w-full">
                      <div className="font-mono font-black text-slate-900 text-xs sm:text-sm tracking-tight mb-1 select-all">
                        {c.code}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(c.code, c.id)}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center gap-1 transition-colors"
                          title="نسخ الكود"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === c.id ? 'تم النسخ!' : 'نسخ'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-inner flex items-center justify-center">
                      <QRCodeSVG value={c.code} size={100} level="M" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


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

            <style>{`
              @media print {
                body { visibility: hidden; }
                .print-section, .print-section * { visibility: visible; }
                .print-section {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                }
                .no-print { display: none !important; }
                .page-break { page-break-after: always; }
                @page { size: A4; margin: 10mm; }
              }
            `}</style>
            <div className="print-section mt-4 grid grid-cols-3 gap-3" id="printable-labels">
              {printableCodes.map((c, index) => (
                <div
                  key={c.id}
                  className={`p-3 border border-slate-300 rounded-xl flex flex-col items-center text-center bg-white ${index > 0 && index % 9 === 0 ? 'page-break' : ''}`}
                >
                  <div className="font-mono font-black text-[10px] text-slate-900 mb-1 tracking-tight">{c.code}</div>
                  
                  {/* Visual QR with real SVG */}
                  <div className="p-1 border border-slate-200 rounded-lg shadow-xs">
                    <QRCodeSVG value={c.code} size={80} level="M" />
                  </div>

                  {/* Empty box for manual writing */}
                  <div className="w-full h-4 mt-2 border border-slate-200 rounded-sm"></div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 no-print">
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
                <span>تحويل للطباعة (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Printable Custom QR Labels */}
      {showCustomPrintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 no-print">
              <h3 className="font-extrabold text-base text-slate-900">طباعة ملصقات الباركود الجديدة</h3>
              <button onClick={() => setShowCustomPrintModal(false)} className="text-slate-400 p-1">
                ✕
              </button>
            </div>

            <style>{`
              @media print {
                /* Hide everything by default */
                body > * { display: none !important; }
                /* Show ONLY the print container */
                #custom-print-container { 
                  display: block !important; 
                  background: white !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .no-print { display: none !important; }
                .page-break { page-break-after: always; }
                @page { size: A4; margin: 15mm 10mm; }
                table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; } /* Standard: repeat header on each page */
                th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: right; }
              }
            `}</style>
            
            <div id="custom-print-container" className="mt-4 bg-white border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between no-print">
                <span>معاينة جدول الطباعة (9 سطور لكل صفحة)</span>
                <span className="font-mono text-[11px] text-slate-500">الإجمالي: {customBarcodes.length}</span>
              </div>
              
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">#</th>
                    <th className="py-3 px-4">رقم الباركود / الجهاز (عمود الإكسل)</th>
                    <th className="py-3 px-4 text-center">رمز الاستجابة السريعة (QR-Code)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customBarcodes.map((code, index) => (
                    <React.Fragment key={index}>
                      <tr className="h-28">
                        <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">{index + 1}</td>
                        <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm">
                          {code}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-block p-2 border border-slate-200 rounded-xl bg-white shadow-2xs">
                            <QRCodeSVG value={code} size={64} level="M" />
                          </div>
                        </td>
                      </tr>
                      {(index + 1) % 9 === 0 && index !== customBarcodes.length - 1 && (
                        <tr className="page-break"><td colSpan={3} className="p-0 border-0 h-0"></td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 no-print">
              <button
                onClick={() => setShowCustomPrintModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                إغلاق
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>تحويل للطباعة (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
