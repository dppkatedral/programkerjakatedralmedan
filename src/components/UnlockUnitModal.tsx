import React, { useState, useEffect } from 'react';
import { X, Lock, KeyRound, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { MASTER_DIVISIONS } from '../../database/master-data/divisions';
import { authPinService } from '../utils/authPinService';
import { AuthSession } from '../types/auth';

interface UnlockUnitModalProps {
  isOpen: boolean;
  unitId: string;
  unitNama: string;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
}

export const UnlockUnitModal: React.FC<UnlockUnitModalProps> = ({
  isOpen,
  unitId,
  unitNama,
  onClose,
  onSuccess,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>(unitId);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTarget(unitId);
    setPin('');
    setErrorMsg(null);
  }, [unitId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = authPinService.verifyPin(selectedTarget, pin);
    if (result.success && result.role && result.unitId && result.unitNama) {
      const session: AuthSession = {
        role: result.role,
        unitId: result.unitId,
        unitNama: result.unitNama,
        authenticatedAt: new Date().toISOString(),
      };
      authPinService.setSession(session);
      onSuccess(session);
      setPin('');
      onClose();
    } else {
      setErrorMsg(result.errorMessage || 'PIN angka tidak sesuai.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Buka Akses Unit</h3>
              <p className="text-[10px] text-slate-300 truncate max-w-[200px]">{unitNama}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {/* Pilihan Login Dragdown */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800">
              Pilih Akun / Seksi:
            </label>
            <div className="relative">
              <select
                value={selectedTarget}
                onChange={(e) => {
                  setSelectedTarget(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white cursor-pointer appearance-none pr-7"
              >
                <option value="admin">👑 Pastor Paroki / Admin</option>
                <option value="all">🌐 Buka Semua Unit (Universal)</option>
                <optgroup label="─── Unit Seksi & DPPH ───">
                  {MASTER_DIVISIONS.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.code === 'DPPH' ? '🏛️ ' : '• '} {div.nama}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* Masukkan PIN Angka */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Masukkan PIN (Angka Saja):</span>
              <span className="text-[9.5px] text-slate-400">Digit 0-9</span>
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setPin(digits);
                  setErrorMsg(null);
                }}
                placeholder="Ketik PIN angka..."
                autoFocus
                maxLength={12}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-center gap-1.5 animate-in fade-in duration-150">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-[0.99]"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Buka Data</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
