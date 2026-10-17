import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Download, Printer, QrCode } from 'lucide-react';

interface DeviceQrModalProps {
  deviceId: string;
  subscriberName?: string;
  agentName?: string;
  onClose: () => void;
}

export const DeviceQrModal: React.FC<DeviceQrModalProps> = ({
  deviceId,
  subscriberName,
  agentName,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const svgElement = document.getElementById('device-qr-code-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${deviceId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sky-900 font-extrabold text-sm">
            <QrCode className="w-5 h-5 text-sky-700" />
            <span>رمز الاستجابة السريعة (QR Code)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            ✕
          </button>
        </div>

        {/* QR Code Container */}
        <div className="my-5 flex flex-col items-center">
          <div className="p-4 bg-white border-2 border-slate-900 rounded-2xl shadow-inner">
            <QRCodeSVG
              id="device-qr-code-svg"
              value={`https://alsari.iq/device/${deviceId}`}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="mt-4 font-mono font-black text-lg text-slate-900 tracking-wider flex items-center justify-center gap-2">
            <span>{deviceId}</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-slate-100 transition-colors"
              title="نسخ رقم الجهاز"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {copied && <div className="text-[10px] text-emerald-600 font-bold mt-0.5">تم نسخ رقم الجهاز!</div>}

          {subscriberName && (
            <div className="mt-2 text-xs text-slate-600">
              المشترك: <span className="font-bold text-slate-900">{subscriberName}</span>
            </div>
          )}

          {agentName && (
            <div className="text-[11px] text-slate-400">
              الوكيل: <span className="font-semibold text-slate-700">{agentName}</span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-xs">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4 text-sky-700" />
            <span>تحميل QR</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-sky-900 hover:bg-sky-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
