import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  X, User, Mail, Crown, Shield, Download, Trash2, Lock,
  Globe, Moon, Sun, AlertTriangle, Check, Loader2, CreditCard,
  KeyRound, Calendar, AtSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { exportUserData, deleteAccount, changePassword, updateProfile } from '../services/api';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'security' | 'preferences' | 'gdpr';

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Export state
  const [exportLoading, setExportLoading] = useState(false);

  // Display name state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');

  if (!isOpen || !user) return null;

  const getInitials = (email: string) => {
    if (user?.displayName) {
      return user.displayName.slice(0, 2).toUpperCase();
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const handleSaveDisplayName = async () => {
    setDisplayNameError('');
    setDisplayNameSuccess(false);
    if (!displayName || displayName.length < 2) return;

    setDisplayNameLoading(true);
    try {
      await updateProfile(displayName.trim());
      await refreshUser();
      setDisplayNameSuccess(true);
      setTimeout(() => setDisplayNameSuccess(false), 3000);
    } catch (err: any) {
      setDisplayNameError(err.message || t('profile.displayNameError'));
    } finally {
      setDisplayNameLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('profile.passwordTooShort'));
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || t('profile.passwordChangeFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const blob = await exportUserData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gilo-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');

    if (deleteConfirmText !== 'DELETE') {
      setDeleteError(t('profile.deleteConfirmError'));
      return;
    }
    if (!deletePassword) {
      setDeleteError(t('profile.deletePasswordRequired'));
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteAccount(deletePassword);
      logout();
      onClose();
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.message || t('profile.deleteAccountFailed'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');
  };

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'profile', icon: <User className="w-4 h-4" />, label: t('profile.tabProfile') },
    { id: 'security', icon: <Lock className="w-4 h-4" />, label: t('profile.tabSecurity') },
    { id: 'preferences', icon: <Globe className="w-4 h-4" />, label: t('profile.tabPreferences') },
    { id: 'gdpr', icon: <Shield className="w-4 h-4" />, label: t('profile.tabGDPR') },
  ];

  const createdDate = user.subscription?.currentPeriodEnd
    ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative glass-strong rounded-2xl w-full max-w-xl border-gradient animate-fade-in-scale max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-t-overlay/10">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
              user.tier === 'byo' ? 'from-amber-500 to-orange-500' : user.tier === 'pro' ? 'from-indigo-500 to-purple-600' : 'from-blue-500 to-indigo-500'
            } flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0`}>
              {getInitials(user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-t-text font-semibold truncate">{user.displayName || user.email}</p>
              {user.displayName && (
                <p className="text-t-text/40 text-xs truncate">{user.email}</p>
              )}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium capitalize ${
                  user.tier === 'byo' ? 'text-amber-400' : user.tier === 'pro' ? 'text-indigo-400' : 'text-blue-400'
                }`}>
                  {user.tier === 'byo' ? 'BYO LLM' : user.tier} Plan
                </span>
                {(user.tier === 'pro' || user.tier === 'byo') && <Crown className="w-3 h-3 text-indigo-400" />}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-t-overlay/10 transition-colors"
          >
            <X className="w-5 h-5 text-t-text/50" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-t-overlay/10 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400'
                  : 'text-t-text/40 border-transparent hover:text-t-text/70 hover:border-t-overlay/20'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* === Profile Tab === */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Email */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3 mb-1">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span className="text-t-text/50 text-sm">{t('profile.email')}</span>
                </div>
                <p className="text-t-text font-medium ml-7 break-all">{user.email}</p>
              </div>

              {/* Display Name / Pseudo */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3 mb-1">
                  <AtSign className="w-4 h-4 text-purple-400" />
                  <span className="text-t-text/50 text-sm">{t('profile.displayName')}</span>
                </div>
                <div className="ml-7 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="input-futuristic flex-1 px-3 py-2 rounded-xl text-t-text text-sm"
                      placeholder={t('profile.displayNamePlaceholder')}
                      maxLength={50}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveDisplayName()}
                    />
                    <button
                      onClick={handleSaveDisplayName}
                      disabled={displayNameLoading || !displayName || displayName.length < 2 || displayName === user.displayName}
                      className="px-3 py-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {displayNameLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-t-text/30 text-xs mt-1.5">{t('profile.displayNameHint')}</p>
                  {displayNameSuccess && (
                    <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {t('profile.displayNameSaved')}
                    </p>
                  )}
                  {displayNameError && (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {displayNameError}
                    </p>
                  )}
                </div>
              </div>

              {/* Plan */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                      <span className="text-t-text/50 text-sm">{t('profile.plan')}</span>
                    </div>
                    <p className="text-t-text font-medium ml-7 capitalize">{user.tier} Plan</p>
                    {createdDate && (
                      <p className="text-t-text/30 text-xs ml-7 mt-1">
                        {t('profile.renewsOn')}: {createdDate}
                      </p>
                    )}
                  </div>
                  {user.tier === 'free' && (
                    <button
                      onClick={() => { onClose(); navigate('/billing'); }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-all"
                    >
                      {t('profile.upgradePro')}
                    </button>
                  )}
                </div>
              </div>

              {/* Quotas */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <KeyRound className="w-4 h-4 text-green-400" />
                  <span className="text-t-text/50 text-sm">{t('profile.quotas')}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 ml-7">
                  <div>
                    <p className="text-t-text font-bold text-lg">{user.usage.projectsCount}</p>
                    <p className="text-t-text/30 text-xs">/ {user.quotas.projectsMax} agents</p>
                  </div>
                  <div>
                    <p className="text-t-text font-bold text-lg">{Math.round(user.usage.storageUsed / (1024 * 1024))}</p>
                    <p className="text-t-text/30 text-xs">/ {Math.round(user.quotas.storageMax / (1024 * 1024))} MB</p>
                  </div>
                  <div>
                    <p className="text-t-text font-bold text-lg">{user.usage.deploymentsThisMonth}</p>
                    <p className="text-t-text/30 text-xs">/ {user.quotas.deploymentsPerMonth} {t('profile.deploys')}</p>
                  </div>
                </div>
              </div>

              {/* Account created */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  <span className="text-t-text/50 text-sm">{t('profile.accountId')}</span>
                </div>
                <p className="text-t-text/40 text-xs ml-7 mt-1 font-mono">{user.id}</p>
              </div>
            </div>
          )}

          {/* === Security Tab === */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-t-text font-semibold text-sm mb-3">{t('profile.changePassword')}</h3>

              <div>
                <label className="block text-t-text/50 text-xs mb-1.5">{t('profile.currentPassword')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-futuristic w-full px-4 py-2.5 rounded-xl text-t-text text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-t-text/50 text-xs mb-1.5">{t('profile.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-futuristic w-full px-4 py-2.5 rounded-xl text-t-text text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-t-text/50 text-xs mb-1.5">{t('profile.confirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-futuristic w-full px-4 py-2.5 rounded-xl text-t-text text-sm"
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                />
              </div>

              {passwordError && (
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p className="text-green-400 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> {t('profile.passwordChanged')}
                </p>
              )}

              <button
                onClick={handleChangePassword}
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                className="w-full btn-gradient px-4 py-2.5 rounded-xl text-t-text font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('profile.changePasswordBtn')}
              </button>
            </div>
          )}

          {/* === Preferences Tab === */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Language */}
              <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-t-text font-medium text-sm">{t('profile.language')}</p>
                    <p className="text-t-text/30 text-xs">{i18n.language === 'fr' ? 'Français' : 'English'}</p>
                  </div>
                </div>
                <button
                  onClick={toggleLanguage}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/25 transition-all"
                >
                  {i18n.language === 'fr' ? 'Switch to English' : 'Passer en Français'}
                </button>
              </div>

              {/* Theme */}
              <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
                  <div>
                    <p className="text-t-text font-medium text-sm">{t('profile.theme')}</p>
                    <p className="text-t-text/30 text-xs">{theme === 'dark' ? t('profile.dark') : t('profile.light')}</p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-all"
                >
                  {theme === 'dark' ? t('profile.switchLight') : t('profile.switchDark')}
                </button>
              </div>
            </div>
          )}

          {/* === GDPR Tab === */}
          {activeTab === 'gdpr' && (
            <div className="space-y-5">
              {/* Export Data */}
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Download className="w-5 h-5 text-blue-400" />
                  <h3 className="text-t-text font-semibold">{t('profile.exportTitle')}</h3>
                </div>
                <p className="text-t-text/40 text-sm mb-4 ml-8">
                  {t('profile.exportDesc')}
                </p>
                <button
                  onClick={handleExportData}
                  disabled={exportLoading}
                  className="ml-8 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {t('profile.exportBtn')}
                </button>
              </div>

              {/* Delete Account */}
              <div className="glass-card rounded-xl p-5 border border-red-500/10">
                <div className="flex items-center gap-3 mb-2">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <h3 className="text-red-400 font-semibold">{t('profile.deleteTitle')}</h3>
                </div>
                <div className="ml-8">
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 mb-4">
                    <p className="text-red-300/80 text-sm font-medium mb-2">{t('profile.deleteWarning')}</p>
                    <ul className="text-xs text-t-text/40 space-y-1 list-disc ml-4">
                      <li>{t('profile.deleteItem1')}</li>
                      <li>{t('profile.deleteItem2')}</li>
                      <li>{t('profile.deleteItem3')}</li>
                      <li>{t('profile.deleteItem4')}</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-t-text/50 text-xs mb-1.5">{t('profile.deletePasswordLabel')}</label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="input-futuristic w-full px-4 py-2.5 rounded-xl text-t-text text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-t-text/50 text-xs mb-1.5">
                        {t('profile.deleteConfirmLabel')}
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="input-futuristic w-full px-4 py-2.5 rounded-xl text-t-text text-sm"
                        placeholder="DELETE"
                      />
                    </div>

                    {deleteError && (
                      <p className="text-red-400 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {deleteError}
                      </p>
                    )}

                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading || deleteConfirmText !== 'DELETE' || !deletePassword}
                      className="w-full px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {deleteLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {t('profile.deleteBtn')}
                    </button>
                  </div>
                </div>
              </div>

              {/* GDPR Info */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-t-text/70 text-sm font-medium">{t('profile.gdprCompliance')}</span>
                </div>
                <p className="text-t-text/30 text-xs ml-7 leading-relaxed">
                  {t('profile.gdprDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
