import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
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
import { useAppDialogs } from './AppDialogProvider';

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
      {/* 1. Visible UI (Hidden during print) */}
      <div className="no-print space-y-6">
        {/* Title Header Banner */}
        <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-blue-900 text-white p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-black font-mono">{activeTab === 'registry' ? codes.length : customBarcodes.length}</div>
            <div className="text-[11px] text-sky-200 font-semibold">{activeTab === 'registry' ? 'كود QR مسجل' : 'باركود جديد مدخل'}</div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <span>إدارة أكواد وأجهزة QR</span>
              <span>📱</span>
            </h2>
            <p className="text-xs text-sky-200 mt-1">توليد أرقام الأجهزة، طباعة بطاقات QR، وإدخال و لصق الباركودات الجديدة مباشرة</p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('registry')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'registry' ? 'bg-sky-700 text-white shadow-md' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>📋 السجل الرئيسي للأكواد ({codes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('new_barcodes')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'new_barcodes' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>✨ باركودات جديدة (لصق ولوليد سريع)</span>
          </button>
        </div>

        {activeTab === 'new_barcodes' ? (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <label className="block font-bold text-slate-800 text-xs mb-1.5">الصق أرقام الباركود والأجهزة هنا:</label>
                <textarea
                  rows={4}
                  value={newBarcodesText}
                  onChange={(e) => handleParseAndAddCustomBarcodes(e.target.value)}
                  placeholder="الصق الأرقام هنا (كل رقم في سطر أو مفصولة بفواصل)..."
                  className="w-full p-3 rounded-2xl border border-slate-300 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              {customBarcodes.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-700 text-xs text-right">تم رصد ({customBarcodes.length}) رقم:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCustomPrintModal(true)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>تصدير (PDF)</span>
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-sky-200"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة مباشرة</span>
                    </button>
                    <button
                      onClick={() => {
                        customBarcodes.forEach((code) => onAddCode(code));
                        setCustomBarcodes([]);
                        setNewBarcodesText('');
                        localStorage.removeItem('alsari_pasted_barcodes');
                        setActiveTab('registry');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
                    >
                      حفظ للكل ({customBarcodes.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
                <span>شبكة الباركودات الجديدة (معاينة عمودين)</span>
                <span className="font-mono text-[11px] text-slate-500">إجمالي: {customBarcodes.length}</span>
              </div>
              <div className="max-h-[60vh] overflow-auto p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {customBarcodes.map((code, index) => (
                    <div 
                      key={index} 
                      className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col items-center gap-2 hover:bg-white hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="bg-slate-200 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">#{index + 1}</span>
                        <button 
                          onClick={() => handleCopy(code, `custom-${index}`)}
                          className="text-slate-400 hover:text-sky-600 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <QRCodeSVG
                          value={code}
                          size={70}
                          level="M"
                        />
                      </div>
                      
                      <div className="text-[11px] font-mono font-black text-slate-800 text-center break-all select-all leading-tight">
                        {code}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowAddSingleModal(true)} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  <span>إضافة رقم فردي</span>
                </button>
                <button onClick={() => setShowBatchModal(true)} className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>توليد دفعة سيريال</span>
                </button>
                <button onClick={() => setShowScannerModal(true)} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-slate-500" />
                  <span>مسح QR</span>
                </button>
                <button onClick={() => excelService.exportBarcodes(codes)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>تصدير Excel</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowPrintModal(true)} disabled={codes.length === 0} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 disabled:opacity-40">
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقات ({selectedIds.length > 0 ? selectedIds.length : codes.length})</span>
                </button>
                <button
                  onClick={async () => {
                    if (await showConfirm('هل أنت متأكد من حذف وتصفير كافة الأكواد؟', 'حذف جميع الأكواد')) {
                      onClearAllCodes();
                      setSelectedIds([]);
                    }
                  }}
                  disabled={codes.length === 0}
                  className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف وتصفير</span>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 text-xs">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={codes.length > 0 && selectedIds.length === codes.length} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4 text-sky-600 rounded" />
                <span>تحديد كافة الأكواد ({codes.length})</span>
              </label>
              <span className="text-slate-400">تم تحديد: {selectedIds.length}</span>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
              {codes.length === 0 ? (
                <div className="py-24 text-center text-slate-400 text-xs px-4">لا توجد أكواد مسجلة بعد.</div>
              ) : (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[70vh] overflow-auto">
                  {codes.map((c) => (
                    <div key={c.id} className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center">
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <input type="checkbox" checked={selectedIdSet.has(c.id)} onChange={() => toggleSelectOne(c.id)} className="w-4 h-4 text-sky-600 rounded cursor-pointer" />
                        <button onClick={() => onDeleteCode(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="mt-6 mb-3 flex flex-col items-center w-full">
                        <div className="font-mono font-black text-slate-900 text-xs sm:text-sm tracking-tight mb-1 select-all">{c.code}</div>
                        <button onClick={() => handleCopy(c.code, c.id)} className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center gap-1 transition-colors">
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === c.id ? 'تم النسخ!' : 'نسخ'}</span>
                        </button>
                      </div>
                      <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-inner flex items-center justify-center">
                        <QRCodeSVG
                          value={c.code}
                          size={100}
                          level="M"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        {showAddSingleModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-base text-slate-900 text-right">إضافة رقم فردي</h3>
                <button onClick={() => setShowAddSingleModal(false)} className="text-slate-400 p-1">✕</button>
              </div>
              <form onSubmit={handleSaveSingle} className="mt-4 space-y-4 text-xs text-right">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم السيريال *</label>
                  <input type="text" required value={singleCodeInput} onChange={(e) => setSingleCodeInput(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm" />
                </div>
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setShowAddSingleModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">إلغاء</button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 shadow-sm">إضافة وحفظ</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showBatchModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-base text-slate-900 text-right">توليد دفعة سيريال</h3>
                <button onClick={() => setShowBatchModal(false)} className="text-slate-400 p-1">✕</button>
              </div>
              <div className="mt-4 space-y-4 text-xs text-right">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عدد الأكواد</label>
                  <input type="number" min={1} max={50} value={batchCountInput} onChange={(e) => setBatchCountInput(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm" />
                </div>
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold">إلغاء</button>
                  <button type="button" onClick={() => { onBatchGenerate(batchCountInput); setShowBatchModal(false); }} className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800">توليد الآن</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showScannerModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-right">
                <h3 className="font-extrabold text-base text-slate-900">مسح رمز QR</h3>
                <button onClick={() => setShowScannerModal(false)} className="text-slate-400 p-1">✕</button>
              </div>
              <div className="my-6 flex flex-col items-center">
                <div className="w-48 h-48 rounded-2xl border-4 border-dashed border-sky-400 bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden shadow-inner">
                  <Scan className="w-16 h-16 text-sky-400 animate-pulse" />
                  <div className="absolute inset-x-0 h-1 bg-emerald-500 shadow-lg top-1/2 -translate-y-1/2 animate-bounce" />
                </div>
                <div className="mt-4 w-full">
                  <input type="text" placeholder="امسح رمز QR..." value={scannedResult} onChange={(e) => setScannedResult(e.target.value)} className="w-full px-3 py-2 text-center rounded-xl border border-slate-300 font-mono text-sm" />
                </div>
              </div>
              <button onClick={() => { if (scannedResult) { onAddCode(scannedResult); setScannedResult(''); setShowScannerModal(false); } }} disabled={!scannedResult} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40">تأكيد وإضافة</button>
            </div>
          </div>
        )}

        {showPrintModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 text-right">معاينة طباعة بطاقات الضمان وأكواد الأجهزة</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">تم تضمين الشعار الرسمي داخل مركز كود الاستجابة السريعة (QR) وإزالته من الترويسة</p>
                </div>
                <button onClick={() => setShowPrintModal(false)} className="text-slate-400 p-1">✕</button>
              </div>

              {/* Preview Cards Grid */}
              <div className="my-4 max-h-[50vh] overflow-y-auto p-2 border border-slate-100 rounded-2xl bg-slate-50">
                <div className="text-center font-bold text-xs text-slate-700 mb-3 pb-2 border-b border-slate-200">
                  شركة الساري للبث الأرضي - الوكيل الرسمي لقنوات الرابعة الرياضية
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {printableCodes.map((c) => (
                    <div key={c.id} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col items-center text-center shadow-xs">
                      <div className="font-mono font-black text-xs text-slate-900 mb-1">{c.code}</div>
                      <div className="p-2 border border-slate-200 rounded-lg bg-white my-1">
                        <QRCodeSVG
                          value={c.code}
                          size={90}
                          level="M"
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold mt-1">بطاقة ضمان وتشغيل رسمي معتمد</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">إغلاق</button>
                <button onClick={() => window.print()} className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs"><Printer className="w-4 h-4" /><span>طباعة الآن</span></button>
              </div>
            </div>
          </div>
        )}

        {showCustomPrintModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 no-print">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 text-right">معاينة طباعة الباركودات وبطاقات الضمان</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">الشعار مضمن وسط كود QR وبدون شعار في الترويسة</p>
                </div>
                <button onClick={() => setShowCustomPrintModal(false)} className="text-slate-400 p-1 cursor-pointer">✕</button>
              </div>

              {/* Preview Grid */}
              <div className="my-4 max-h-[50vh] overflow-y-auto p-2 border border-slate-100 rounded-2xl bg-slate-50">
                <div className="text-center font-bold text-xs text-slate-700 mb-3 pb-2 border-b border-slate-200">
                  شركة الساري للبث الأرضي - جدول باركودات وأجهزة الرابعة الرياضية
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {customBarcodes.map((code, index) => (
                    <div key={index} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col items-center text-center shadow-xs">
                      <span className="text-[10px] text-slate-400 font-bold mb-1">#{index + 1}</span>
                      <div className="p-2 border border-slate-200 rounded-lg bg-white my-1">
                        <QRCodeSVG
                          value={code}
                          size={90}
                          level="M"
                        />
                      </div>
                      <div className="font-mono font-black text-xs text-slate-900 mt-1">{code}</div>
                      <div className="text-[10px] text-slate-500 font-bold mt-0.5">بطاقة ضمان معتمدة</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 no-print">
                <button onClick={() => setShowCustomPrintModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs">إغلاق المعاينة</button>
                <button onClick={() => window.print()} className="px-5 py-2 rounded-xl bg-sky-700 text-white font-bold hover:bg-sky-800 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs"><Printer className="w-4 h-4" /><span>بدء الطباعة الآن</span></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div id="registry-print-section">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: '900', fontSize: '18px' }}>شركة الساري للبث الأرضي</div>
          <div style={{ fontSize: '12px', color: '#475569' }}>الوكيل الرسمي لقنوات الرابعة الرياضية - بطاقات الضمان وأكواد الأجهزة الرسمية</div>
        </div>
        {printableCodes.map((c, index) => (
          <div key={c.id} className={`print-card ${index > 0 && (index + 1) % 8 === 1 ? 'page-break' : ''}`}>
            <div className="code-text">{c.code}</div>
            <div className="qr-box">
              <QRCodeSVG
                value={c.code}
                size={100}
                level="M"
              />
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', fontWeight: 'bold' }}>بطاقة ضمان وتشغيل معتمد</div>
          </div>
        ))}
      </div>

      {/* Custom Table/Grid Print Container (4 columns) */}
      <div id="custom-print-section">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: '900', fontSize: '18px' }}>شركة الساري للبث الأرضي</div>
          <div style={{ fontSize: '12px', color: '#475569' }}>جدول باركودات وبطاقات ضمان أجهزة الرابعة الرياضية</div>
        </div>
        <div className="print-grid">
          {customBarcodes.map((code, index) => (
            <div 
              key={index} 
              className={`print-grid-item ${(index + 1) % 8 === 0 ? 'page-break-after' : ''}`}
            >
              <div className="print-item-index">#{index + 1}</div>
              <div className="print-item-qr">
                <QRCodeSVG
                  value={code}
                  size={100}
                  level="M"
                />
              </div>
              <div className="print-item-code">{code}</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', fontWeight: 'bold' }}>بطاقة ضمان معتمدة</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .no-print { display: none !important; }

          #registry-print-section, #registry-print-section *,
          #custom-print-section, #custom-print-section * { 
            visibility: visible !important; 
          }

          #registry-print-section {
            display: grid !important;
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 15px !important;
            background: white !important;
          }
          
          #custom-print-section { 
            display: block !important; 
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            background: white !important;
          }

          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 15px !important;
            width: 100% !important;
          }

          .print-grid-item {
            border: 1px solid #cbd5e1 !important;
            padding: 15px !important;
            border-radius: 12px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            background: white !important;
            page-break-inside: avoid !important;
            min-height: 215px !important;
            justify-content: center !important;
          }

          .print-card {
            border: 1px solid #cbd5e1 !important;
            padding: 15px !important;
            border-radius: 15px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            background: white !important;
            page-break-inside: avoid !important;
            height: 215px !important;
            justify-content: center !important;
          }

          .print-item-index {
            font-size: 10px !important;
            color: #64748b !important;
            margin-bottom: 8px !important;
            font-weight: bold !important;
          }

          .print-item-qr {
            margin-bottom: 8px !important;
          }

          .print-item-code {
            font-family: monospace !important;
            font-weight: 900 !important;
            font-size: 13px !important;
            word-break: break-all !important;
          }

          .page-break-after {
            page-break-after: always !important;
          }
          
          @page { size: A4; margin: 15mm 10mm; }
        }
        
        #registry-print-section, #custom-print-section { display: none; }
      `}</style>
    </div>
  );
};
