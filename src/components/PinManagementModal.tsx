import React, { useState, useMemo } from 'react';
import {
  X,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Check,
  Save,
  Search,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Building2,
  Users,
  Sparkles,
  Info,
} from 'lucide-react';
import { MASTER_DIVISIONS } from '../../database/master-data/divisions';
import { authPinService, DEFAULT_ADMIN_PIN, DEFAULT_UNIVERSAL_PIN } from '../utils/authPinService';

interface PinManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPinUpdated?: (message: string) => void;
}

export const PinManagementModal: React.FC<PinManagementModalProps> = ({
  isOpen,
  onClose,
  onPinUpdated,
}) => {
  const [config, setConfig] = useState(() => authPinService.getConfig());
  const [search, setSearch] = useState('');
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  const [editingPins, setEditingPins] = useState<Record<string, string>>({});
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [customResetPin, setCustomResetPin] = useState(DEFAULT_UNIVERSAL_PIN);
  const [adminPinInput, setAdminPinInput] = useState(config.adminPin);
  const [universalPinInput, setUniversalPinInput] = useState(config.universalPin);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showUniversalPin, setShowUniversalPin] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
    if (onPinUpdated) onPinUpdated(msg);
  };

  const filteredDivisions = useMemo(() => {
    if (!search.trim()) return MASTER_DIVISIONS;
    const q = search.toLowerCase();
    return MASTER_DIVISIONS.filter(
      (d) =>
        d.nama.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.defaultPic.toLowerCase().includes(q)
    );
  }, [search]);

  if (!isOpen) return null;

  const toggleShowPin = (id: string) => {
    setShowPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditChange = (unitId: string, val: string) => {
    const digits = val.replace(/\D/g, '');
    setEditingPins((prev) => ({ ...prev, [unitId]: digits }));
  };

  const handleSaveUnitPin = (unitId: string, unitName: string) => {
    const val = editingPins[unitId];
    if (val === undefined || val.trim().length === 0) return;
    const trimmed = val.trim();
    authPinService.updateUnitPin(unitId, trimmed);
    const updated = authPinService.getConfig();
    setConfig(updated);
    setEditingPins((prev) => {
      const copy = { ...prev };
      delete copy[unitId];
      return copy;
    });
    showNotif(`PIN untuk ${unitName} berhasil diubah ke: ${trimmed}`);
  };

  const handleResetAll = () => {
    const targetPin = customResetPin.trim() || DEFAULT_UNIVERSAL_PIN;
    authPinService.resetAllSeksiPins(targetPin);
    const updated = authPinService.getConfig();
    setConfig(updated);
    setEditingPins({});
    setIsResetConfirmOpen(false);
    showNotif(`Semua PIN Seksi & DPPH berhasil direset ke "${targetPin}"!`);
  };

  const handleSaveAdminPin = () => {
    const trimmed = adminPinInput.trim();
    if (!trimmed) return;
    authPinService.updateAdminPin(trimmed);
    setConfig(authPinService.getConfig());
    showNotif(`PIN Pastor Paroki/Admin diperbarui: ${trimmed}`);
  };

  const handleSaveUniversalPin = () => {
    const trimmed = universalPinInput.trim();
    if (!trimmed) return;
    authPinService.updateUniversalPin(trimmed);
    setConfig(authPinService.getConfig());
    showNotif(`PIN Semua Seksi diperbarui: ${trimmed}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>Manajemen & Reset PIN Paroki</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                  Akses Khusus Pastor Paroki / Admin
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Kelola PIN angka individu tiap seksi atau lakukan reset serentak jika diperlukan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 animate-in fade-in duration-150">
            <Check className="w-4 h-4" />
            <span>{notification}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Master PINs Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card Pastor Paroki / Admin PIN */}
            <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-700" />
                  PIN Pastor Paroki / Admin
                </span>
                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-1.5 py-0.5 rounded">
                  Akses Penuh
                </span>
              </div>
              <p className="text-[10.5px] text-slate-600">
                Digunakan oleh Pastor Paroki / Admin untuk melihat seluruh data dan mereset PIN.
              </p>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={showAdminPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showAdminPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {adminPinInput !== config.adminPin && (
                  <button
                    type="button"
                    onClick={handleSaveAdminPin}
                    className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg shadow-2xs"
                  >
                    Simpan
                  </button>
                )}
              </div>
            </div>

            {/* Card Universal PIN Buka Semua Seksi */}
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                  PIN Buka Semua Seksi (Universal)
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                  Hak Semua Unit
                </span>
              </div>
              <p className="text-[10.5px] text-slate-600">
                PIN cepat untuk membuka data seluruh seksi & DPPH sekaligus.
              </p>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={showUniversalPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={universalPinInput}
                    onChange={(e) => setUniversalPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUniversalPin(!showUniversalPin)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showUniversalPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {universalPinInput !== config.universalPin && (
                  <button
                    type="button"
                    onClick={handleSaveUniversalPin}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-2xs"
                  >
                    Simpan
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Banner: Reset Semua PIN Seksi */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-950">
                  Reset Semua PIN Seksi & DPPH Sekaligus
                </h4>
                <p className="text-[10.5px] text-amber-900/80">
                  Kembalikan PIN seluruh 16 unit (DPPH & 15 Seksi) ke PIN standar (<b>{DEFAULT_UNIVERSAL_PIN}</b>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Semua PIN ke {DEFAULT_UNIVERSAL_PIN}</span>
            </button>
          </div>

          {/* Confirm Reset Dialog */}
          {isResetConfirmOpen && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Konfirmasi Reset Semua PIN Seksi & DPPH</span>
              </div>
              <p className="text-[11px] text-rose-900">
                Apakah Pastor Paroki / Admin yakin ingin mereset PIN untuk seluruh 16 unit? Semua koordinator seksi nantinya akan menggunakan PIN baru di bawah ini untuk membuka data.
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">Setel PIN Baru:</label>
                <input
                  type="text"
                  value={customResetPin}
                  onChange={(e) => setCustomResetPin(e.target.value)}
                  className="w-28 bg-white border border-rose-300 rounded-md px-2 py-1 text-xs font-mono font-bold text-slate-900"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-lg shadow-2xs"
                >
                  Ya, Reset Semua Unit Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* List PIN per Seksi */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-600" />
                <span>Daftar PIN Masing-Masing Unit (DPPH & 15 Seksi):</span>
              </h4>

              {/* Search box */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama seksi / PIC..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
              {filteredDivisions.map((div) => {
                const currentPin = config.unitPins[div.id] || config.universalPin || DEFAULT_UNIVERSAL_PIN;
                const isEditing = editingPins[div.id] !== undefined;
                const editVal = isEditing ? editingPins[div.id] : currentPin;
                const isVisible = showPins[div.id] || false;

                return (
                  <div
                    key={div.id}
                    className="p-2.5 sm:px-3 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {div.code === 'DPPH' ? '🏛️ ' : ''}{div.nama}
                        </span>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                          {div.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        PIC Default: {div.defaultPic}
                      </p>
                    </div>

                    {/* PIN Controller for this division */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative">
                        <input
                          type={isVisible ? 'text' : 'password'}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={editVal}
                          onChange={(e) => handleEditChange(div.id, e.target.value)}
                          placeholder="PIN Angka"
                          className={`w-28 sm:w-32 bg-slate-50 border rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none ${
                            isEditing
                              ? 'border-emerald-500 bg-emerald-50/30'
                              : 'border-slate-200'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowPin(div.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          title={isVisible ? 'Sembunyikan PIN' : 'Lihat PIN'}
                        >
                          {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleSaveUnitPin(div.id, div.nama)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1"
                          title="Simpan PIN Baru"
                        >
                          <Save className="w-3 h-3" />
                          <span>Simpan</span>
                        </button>
                      )}

                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => handleEditChange(div.id, currentPin)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md text-[11px] font-semibold"
                        >
                          Ubah
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>PIN tersimpan secara otomatis & dapat disinkronkan ke cloud.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            Selesai & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
