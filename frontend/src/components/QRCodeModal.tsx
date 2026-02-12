import { useState } from 'react';
import { X, Download, Copy, Check, QrCode, ExternalLink, Code2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentSlug: string;
}

export default function QRCodeModal({ isOpen, onClose, agentName, agentSlug }: QRCodeModalProps) {
  const { t } = useTranslation();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  if (!isOpen) return null;

  const agentUrl = `https://${agentSlug}.gilo.dev`;
  const chatUrl = `${agentUrl}/chat`;
  const qrSize = 220;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(chatUrl)}&bgcolor=0f0f23&color=ffffff&format=png`;
  const qrUrlDownload = `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(chatUrl)}&bgcolor=0f0f23&color=ffffff&format=png`;

  const embedSnippet = `<!-- ${agentName} QR Code -->
<a href="${chatUrl}" target="_blank" rel="noopener">
  <img
    src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(chatUrl)}"
    alt="Chat with ${agentName}"
    width="256" height="256"
  />
</a>`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(chatUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrUrlDownload;
    a.download = `${agentSlug}-qr-code.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-2xl p-6 w-full max-w-md border border-t-overlay/10 animate-fade-in-up"
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

        {/* QR Code Display */}
        <div className="flex flex-col items-center gap-4 mb-5">
          <div className="p-4 rounded-2xl bg-[#0f0f23] border border-t-overlay/10">
            <img
              src={qrUrl}
              alt={`QR Code - ${agentName}`}
              width={qrSize}
              height={qrSize}
              className="rounded-lg"
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-t-text/70 font-medium">{chatUrl}</p>
            <p className="text-xs text-t-text/40 mt-1">
              {t('qrModal.scanToChat', 'Scannez pour discuter avec cet agent')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={handleCopyUrl}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-t-overlay/5 border border-t-overlay/10 text-sm text-t-text/70 hover:text-t-text hover:bg-t-overlay/10 transition-all"
          >
            {copiedUrl ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copiedUrl ? t('qrModal.copied', 'Copié !') : t('qrModal.copyUrl', 'Copier le lien')}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-t-overlay/5 border border-t-overlay/10 text-sm text-t-text/70 hover:text-t-text hover:bg-t-overlay/10 transition-all"
          >
            <Download className="w-4 h-4" />
            {t('qrModal.download', 'Télécharger')}
          </button>
          <a
            href={chatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-t-overlay/5 border border-t-overlay/10 text-sm text-t-text/70 hover:text-t-text hover:bg-t-overlay/10 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Embed Snippet */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-t-text/50" />
            <span className="text-xs font-medium text-t-text/60">{t('qrModal.embedTitle', 'Intégrer le QR dans une page web')}</span>
          </div>
          <div className="relative">
            <pre className="p-3 rounded-xl bg-black/30 border border-t-overlay/10 text-xs text-t-text/60 overflow-x-auto max-h-28">
              <code>{embedSnippet}</code>
            </pre>
            <button
              onClick={handleCopyEmbed}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-t-overlay/10 hover:bg-t-overlay/20 text-t-text/50 hover:text-t-text transition-all"
            >
              {copiedEmbed ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
