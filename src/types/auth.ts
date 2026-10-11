export type AuthRole = 'pastor_paroki' | 'semua_seksi' | 'seksi';

export interface AuthSession {
  role: AuthRole;
  unitId: string; // 'admin' | 'all' | 'div-dpph' | 'div-liturgi', etc.
  unitNama: string;
  authenticatedAt: string;
}

export interface PinConfig {
  adminPin: string; // Default: '08121879' (Pastor Paroki / Admin)
  universalPin: string; // Default: '123456' (Buka semua seksi)
  unitPins: Record<string, string>; // unitId -> PIN (e.g. 'div-dpph': '123456')
  lastResetAt?: string;
}
