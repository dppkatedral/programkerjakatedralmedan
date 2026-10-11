import { MASTER_DIVISIONS } from '../../database/master-data/divisions';
import { AuthRole, AuthSession, PinConfig } from '../types/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const PIN_STORAGE_KEY = 'proker_pin_config_v2';
const SESSION_STORAGE_KEY = 'proker_auth_session_v2';

export const DEFAULT_ADMIN_PIN = '08121879'; // Pastor Paroki / Admin
export const DEFAULT_UNIVERSAL_PIN = '123456'; // Buka Semua Seksi
export const LEGACY_UNIVERSAL_PIN = '121314Katedral'; // Legacy alias support

export function createInitialPinConfig(): PinConfig {
  const unitPins: Record<string, string> = {};
  MASTER_DIVISIONS.forEach((div) => {
    unitPins[div.id] = DEFAULT_UNIVERSAL_PIN;
  });

  return {
    adminPin: DEFAULT_ADMIN_PIN,
    universalPin: DEFAULT_UNIVERSAL_PIN,
    unitPins,
  };
}

class AuthPinService {
  private config: PinConfig;

  constructor() {
    this.config = this.loadConfig();
    this.syncFromCloud();
  }

  private loadConfig(): PinConfig {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialPinConfig();
    }
    try {
      const stored = localStorage.getItem(PIN_STORAGE_KEY);
      if (stored) {
        const parsed: PinConfig = JSON.parse(stored);
        // Ensure all current master divisions exist in unitPins
        const initial = createInitialPinConfig();
        const mergedUnitPins = { ...initial.unitPins, ...(parsed.unitPins || {}) };
        return {
          adminPin: parsed.adminPin || DEFAULT_ADMIN_PIN,
          universalPin: parsed.universalPin || DEFAULT_UNIVERSAL_PIN,
          unitPins: mergedUnitPins,
          lastResetAt: parsed.lastResetAt,
        };
      }
    } catch (e) {
      console.warn('Gagal membaca PIN config dari localStorage:', e);
    }
    const initial = createInitialPinConfig();
    this.saveConfig(initial);
    return initial;
  }

  private saveConfig(config: PinConfig): void {
    this.config = config;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(config));
      }
      this.syncToCloud(config);
    } catch (e) {
      console.error('Gagal menyimpan PIN config ke localStorage:', e);
    }
  }

  private async syncToCloud(config: PinConfig) {
    try {
      const docRef = doc(db, 'system_config', 'pin_security');
      await setDoc(docRef, config, { merge: true });
    } catch (err) {
      // Offline fallback is normal
    }
  }

  private async syncFromCloud() {
    try {
      const docRef = doc(db, 'system_config', 'pin_security');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const cloudData = snap.data() as Partial<PinConfig>;
        if (cloudData.adminPin || cloudData.unitPins) {
          const merged: PinConfig = {
            adminPin: cloudData.adminPin || this.config.adminPin,
            universalPin: cloudData.universalPin || this.config.universalPin,
            unitPins: { ...this.config.unitPins, ...(cloudData.unitPins || {}) },
            lastResetAt: cloudData.lastResetAt || this.config.lastResetAt,
          };
          this.config = merged;
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(merged));
          }
        }
      }
    } catch {
      // Offline mode
    }
  }

  public getConfig(): PinConfig {
    return { ...this.config };
  }

  public getAdminPin(): string {
    return this.config.adminPin;
  }

  public getUniversalPin(): string {
    return this.config.universalPin;
  }

  public getUnitPin(unitId: string): string {
    return this.config.unitPins[unitId] || this.config.universalPin || DEFAULT_UNIVERSAL_PIN;
  }

  // Update PIN untuk satu seksi tertentu
  public updateUnitPin(unitId: string, newPin: string): boolean {
    if (!newPin || newPin.trim().length === 0) return false;
    const cleanPin = newPin.trim();
    const updated: PinConfig = {
      ...this.config,
      unitPins: {
        ...this.config.unitPins,
        [unitId]: cleanPin,
      },
    };
    this.saveConfig(updated);
    return true;
  }

  // Update PIN Master Pastor Paroki / Admin
  public updateAdminPin(newPin: string): boolean {
    if (!newPin || newPin.trim().length === 0) return false;
    const cleanPin = newPin.trim();
    const updated: PinConfig = {
      ...this.config,
      adminPin: cleanPin,
    };
    this.saveConfig(updated);
    return true;
  }

  // Update PIN Universal Semua Seksi
  public updateUniversalPin(newPin: string): boolean {
    if (!newPin || newPin.trim().length === 0) return false;
    const cleanPin = newPin.trim();
    const updated: PinConfig = {
      ...this.config,
      universalPin: cleanPin,
    };
    this.saveConfig(updated);
    return true;
  }

  // Reset SEMUA PIN Seksi ke default ('123456')
  // Fitur khusus Pastor Paroki / Admin
  public resetAllSeksiPins(defaultPin: string = DEFAULT_UNIVERSAL_PIN): void {
    const unitPins: Record<string, string> = {};
    MASTER_DIVISIONS.forEach((div) => {
      unitPins[div.id] = defaultPin;
    });

    const updated: PinConfig = {
      ...this.config,
      universalPin: defaultPin,
      unitPins,
      lastResetAt: new Date().toISOString(),
    };
    this.saveConfig(updated);
  }

  // Validasi login / PIN untuk unit atau role
  public verifyPin(
    targetId: string, // 'admin' | 'all' | 'div-xxx' | unit name
    enteredPin: string
  ): {
    success: boolean;
    role?: AuthRole;
    unitId?: string;
    unitNama?: string;
    errorMessage?: string;
  } {
    const pin = (enteredPin || '').trim();
    if (!pin) {
      return { success: false, errorMessage: 'Silakan masukkan PIN berupa angka.' };
    }

    // 1. Target: Pastor Paroki / Admin
    if (targetId === 'admin') {
      if (pin === this.config.adminPin || pin === DEFAULT_ADMIN_PIN) {
        return {
          success: true,
          role: 'pastor_paroki',
          unitId: 'admin',
          unitNama: 'Pastor Paroki / Administrator',
        };
      }
      return { success: false, errorMessage: 'PIN Pastor Paroki / Admin tidak sesuai.' };
    }

    // 2. Target: Semua Seksi / Semua Unit
    if (targetId === 'all') {
      if (
        pin === this.config.universalPin ||
        pin === DEFAULT_UNIVERSAL_PIN ||
        pin === LEGACY_UNIVERSAL_PIN ||
        pin === this.config.adminPin ||
        pin === DEFAULT_ADMIN_PIN
      ) {
        return {
          success: true,
          role: 'semua_seksi',
          unitId: 'all',
          unitNama: 'Semua Unit (DPPH & 15 Seksi)',
        };
      }
      return { success: false, errorMessage: 'PIN yang dimasukkan tidak sesuai. Silakan hubungi Pastor Paroki/Admin.' };
    }

    // 3. Target: Unit Tertentu (DPPH atau Seksi)
    // Temukan master division berdasarkan ID atau nama
    const div = MASTER_DIVISIONS.find(
      (d) => d.id === targetId || d.nama.toLowerCase() === targetId.toLowerCase()
    );

    if (!div) {
      return { success: false, errorMessage: `Unit "${targetId}" tidak ditemukan.` };
    }

    const assignedPin = this.config.unitPins[div.id] || this.config.universalPin || DEFAULT_UNIVERSAL_PIN;

    // PIN Seksi benar JIKA:
    // a. Sesuai dengan PIN unit tersebut
    // b. Atau memasukkan Universal PIN ('123456' / legacy)
    // c. Atau memasukkan Master PIN Pastor Paroki ('08121879')
    if (
      pin === assignedPin ||
      pin === this.config.universalPin ||
      pin === DEFAULT_UNIVERSAL_PIN ||
      pin === LEGACY_UNIVERSAL_PIN ||
      pin === this.config.adminPin ||
      pin === DEFAULT_ADMIN_PIN
    ) {
      return {
        success: true,
        role: 'seksi',
        unitId: div.id,
        unitNama: div.nama,
      };
    }

    return {
      success: false,
      errorMessage: `PIN untuk ${div.nama} salah. Hubungi Pastor Paroki/Admin jika memerlukan reset.`,
    };
  }

  // Session Management
  public getSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  }

  public setSession(session: AuthSession): void {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
    } catch {
      // ignore
    }
  }

  public clearSession(): void {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

export const authPinService = new AuthPinService();
