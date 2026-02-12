import { X, QrCode } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentSlug: string;
}

export default function QRCodeModal({ isOpen, onClose, agentName, agentSlug }: QRCodeModalProps) {
  if (!isOpen) return null;

  const agentUrl = `https://${agentSlug}.gilo.dev`;
  const qrSize = 250;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(agentUrl)}&bgcolor=0f0f23&color=ffffff&format=png`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />
      <div
        className="relative rounded-2xl p-6 w-full max-w-sm border border-t-overlay/20 animate-fade-in-up bg-[#13132b] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <QrCode className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-t-text">QR Code</h3>
              <p className="text-xs text-t-text/50">{agentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-t-text/40 hover:text-t-text hover:bg-t-overlay/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 rounded-2xl bg-[#0f0f23] border border-t-overlay/10">
            <img
              src={qrUrl}
              alt={`QR Code - ${agentName}`}
              width={qrSize}
              height={qrSize}
              className="rounded-lg"
            />
          </div>
          <p className="text-xs text-t-text/40">{agentUrl}</p>
        </div>
      </div>
    </div>
  );
}
