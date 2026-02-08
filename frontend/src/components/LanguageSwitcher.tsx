import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-200 text-xs font-medium"
      title={t('lang.switchTo')}
    >
      <Globe className="w-3.5 h-3.5" />
      <span className="uppercase">{i18n.language === 'fr' ? 'EN' : 'FR'}</span>
    </button>
  );
}
