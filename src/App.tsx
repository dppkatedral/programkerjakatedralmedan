/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  Save,
  CheckCircle2,
  DollarSign,
  User,
  Phone,
  Target,
  FileText,
  Clock,
  Filter,
  FileSpreadsheet,
  Download,
  Smartphone,
  Monitor,
  Check,
  RotateCcw,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { ProgramKerja, ScheduleType, ProgramStatus } from './types/proker';
import { INITIAL_PROGRAM_KERJA } from './data/initialData';
import {
  BULAN_LIST,
  DAFTAR_DIVISI,
  formatRupiah,
  parseRupiahInput,
  getTipeJadwalLabel,
  getStatusInfo,
  exportToCSV,
  generateJadwalBulanan,
  formatIndonesianDate,
  toISODateString,
  isPelayananRutin,
  isDivisionMatch,
  normalizeDivisionName,
} from './utils/formatters';
import dbService from '../database';
import { getDefaultPicForDivisi, MASTER_DIVISIONS } from '../database/master-data/divisions';
import { SelectSeksiModal } from './components/SelectSeksiModal';
import { DashboardView } from './components/DashboardView';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { EvaluasiModal } from './components/EvaluasiModal';
import { PinManagementModal } from './components/PinManagementModal';
import { UnlockUnitModal } from './components/UnlockUnitModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EvaluasiProgram } from './types/proker';
import { AuthSession } from './types/auth';
import { authPinService } from './utils/authPinService';

export default function App() {
  // 1. Data Store from DatabaseService with automatic migration execution and Cloud Firestore sync
  const [programs, setPrograms] = useState<ProgramKerja[]>(() => {
    try {
      const initData = dbService.initDatabase();
      return initData.programs;
    } catch (e) {
      console.error('Error initializing database service:', e);
      return INITIAL_PROGRAM_KERJA;
    }
  });

  // Subscribe to real-time Cloud Firestore & local database changes
  useEffect(() => {
    const unsubscribe = dbService.subscribe((updated) => {
      if (Array.isArray(updated) && updated.length > 0) {
        setPrograms(updated);
      }
    });
    return () => unsubscribe();
  }, []);

  // 1B. Authentication & Security State
  // Default: Sesuai instruksi, dashboard awal dibuat tidak ada data program dari seksi manapun sampai dimasukkan password/PIN
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    return authPinService.getSession();
  });
  const [isPinManagerOpen, setIsPinManagerOpen] = useState<boolean>(false);
  const [unlockTarget, setUnlockTarget] = useState<{ unitId: string; unitNama: string } | null>(null);

  // 2. Filters & Navigation Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input'>('dashboard');
  const [selectedYear, setSelectedYear] = useState<'all' | 2026 | 2027>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all'); // Default 'all' atau bulan tertentu (1-12)
  const [selectedSeksi, setSelectedSeksi] = useState<string | 'all'>(() => {
    const session = authPinService.getSession();
    if (session && session.role === 'seksi') {
      return session.unitNama;
    }
    return 'all';
  }); // Filter berdasarkan Seksi/Divisi
  const [isSelectSeksiModalOpen, setIsSelectSeksiModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isMobileDeviceFrame, setIsMobileDeviceFrame] = useState<boolean>(false);
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [evaluatingProgram, setEvaluatingProgram] = useState<ProgramKerja | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Auth Handlers
  const handleAuthenticate = (session: AuthSession) => {
    setAuthSession(session);
    if (session.role === 'seksi') {
      setSelectedSeksi(session.unitNama);
    } else {
      setSelectedSeksi('all');
    }
    showToast(`Sesi dibuka: ${session.unitNama}`);
  };

  const handleLockDashboard = () => {
    authPinService.clearSession();
    setAuthSession(null);
    setSelectedSeksi('all');
    showToast('Dashboard telah dikunci. Data program disembunyikan.');
  };

  // Handler pergantian seksi dengan verifikasi PIN
  const handleSelectSeksiWithAuth = (newSeksi: string) => {
    if (!authSession) {
      setUnlockTarget({
        unitId: newSeksi,
        unitNama: newSeksi === 'all' ? 'Semua Unit' : newSeksi,
      });
      return;
    }

    if (newSeksi === 'all') {
      if (authSession.role === 'pastor_paroki' || authSession.role === 'semua_seksi') {
        setSelectedSeksi('all');
      } else {
        setUnlockTarget({
          unitId: 'all',
          unitNama: 'Semua Unit',
        });
      }
      return;
    }

    // Target adalah Seksi / DPPH tertentu
    if (authSession.role === 'pastor_paroki' || authSession.role === 'semua_seksi') {
      setSelectedSeksi(newSeksi);
      return;
    }

    if (authSession.role === 'seksi' && isDivisionMatch(authSession.unitNama, newSeksi)) {
      setSelectedSeksi(newSeksi);
      return;
    }

    // Unit lain membutuhkan PIN unit tersebut
    const div = MASTER_DIVISIONS.find((d) => isDivisionMatch(d.nama, newSeksi));
    setUnlockTarget({
      unitId: div ? div.id : newSeksi,
      unitNama: newSeksi,
    });
  };

  // Simpan hasil evaluasi program kerja (1. Terlaksana, 2. Tidak Terlaksana, 3. Perubahan waktu pelaksanaan)
  const handleSaveEvaluasi = (programId: string, evaluasiData: EvaluasiProgram) => {
    const prog = programs.find((p) => p.id === programId);
    if (!prog) return;
    const updated: ProgramKerja = {
      ...prog,
      evaluasi: evaluasiData,
      status:
        evaluasiData.statusKeterlaksanaan === 'terlaksana'
          ? 'selesai'
          : evaluasiData.statusKeterlaksanaan === 'perubahan_waktu'
          ? 'direncanakan'
          : prog.status,
      updatedAt: new Date().toISOString(),
    };
    dbService.saveProgram(updated);
    if (currentId === programId) {
      setFormData(updated);
    }
    showToast(`Evaluasi untuk "${prog.namaProgram}" berhasil disimpan!`);
  };

  // 3. Filtered programs list based on Tahun, Bulan, Seksi & Hak Akses
  const filteredPrograms = useMemo(() => {
    // Sesuai aturan: jika belum login / belum masukkan PIN, data tidak ditampilkan
    if (!authSession) {
      return [];
    }

    return programs.filter((p) => {
      // Pembatasan per unit jika login sebagai Seksi tertentu
      if (
        authSession.role === 'seksi' &&
        !isDivisionMatch(p.penanggungjawab?.divisi, authSession.unitNama)
      ) {
        return false;
      }
      // Filter Tahun
      if (selectedYear !== 'all' && p.tahun !== selectedYear) return false;
      // Filter Bulan Kegiatan
      if (selectedMonth !== 'all') {
        const isMatch = p.bulanPelaksanaan?.includes(selectedMonth) || isPelayananRutin(p);
        if (!isMatch) return false;
      }
      // Filter Seksi / DPPH
      if (selectedSeksi !== 'all' && !isDivisionMatch(p.penanggungjawab?.divisi, selectedSeksi)) {
        return false;
      }
      return true;
    });
  }, [programs, selectedYear, selectedMonth, selectedSeksi, authSession]);

  // 4. Currently Selected Program ID for 1-Screen View & Editing
  const [currentId, setCurrentId] = useState<string>(() => {
    return INITIAL_PROGRAM_KERJA[0]?.id || '';
  });

  // Auto-adjust currentId if current selection is not in filtered list
  useEffect(() => {
    if (filteredPrograms.length > 0) {
      const exists = filteredPrograms.some((p) => p.id === currentId);
      if (!exists) {
        setCurrentId(filteredPrograms[0].id);
      }
    }
  }, [filteredPrograms, currentId]);

  // Current Program Object
  const currentProgram = useMemo(() => {
    return programs.find((p) => p.id === currentId) || null;
  }, [programs, currentId]);

  // Index in currently filtered list
  const currentIndex = useMemo(() => {
    return filteredPrograms.findIndex((p) => p.id === currentId);
  }, [filteredPrograms, currentId]);

  // Form State for Active Program
  const [formData, setFormData] = useState<Partial<ProgramKerja>>({});
  const [rawAnggaran, setRawAnggaran] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Sync form state when currentProgram changes
  useEffect(() => {
    if (currentProgram) {
      setFormData({ ...currentProgram });
      setRawAnggaran(
        currentProgram.estimasiAnggaran
          ? currentProgram.estimasiAnggaran.toLocaleString('id-ID')
          : ''
      );
      setFormErrors({});
      setHasUnsavedChanges(false);
    } else {
      setFormData({});
      setRawAnggaran('');
    }
  }, [currentId, currentProgram]);

  // Navigation handlers (Data Berikutnya / Sebelumnya)
  const handleNext = () => {
    if (currentIndex < filteredPrograms.length - 1) {
      setCurrentId(filteredPrograms[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentId(filteredPrograms[currentIndex - 1].id);
    }
  };

  // Budget input change
  const handleAnggaranChange = (val: string) => {
    const num = parseRupiahInput(val);
    setRawAnggaran(num > 0 ? num.toLocaleString('id-ID') : '');
    setFormData((prev) => ({ ...prev, estimasiAnggaran: num }));
    setHasUnsavedChanges(true);
  };

  const handleQuickBudgetPreset = (val: number) => {
    setRawAnggaran(val.toLocaleString('id-ID'));
    setFormData((prev) => ({ ...prev, estimasiAnggaran: val }));
    setHasUnsavedChanges(true);
  };

  // Schedule Type Change (Pelayanan Rutin Sepanjang Tahun, Multi Bulan, Satu Kali)
  const handleTipeJadwalChange = (tipe: ScheduleType) => {
    setFormData((prev) => {
      let bulan = prev.bulanPelaksanaan || [];
      let jadwalBln = prev.jadwalBulanan || {};
      let modeTgl = prev.modeTanggal;
      let tglSpesifik = prev.tanggalSpesifik;

      if (tipe === 'sepanjang_tahun') {
        bulan = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        modeTgl = 'rutin_berkala';
        tglSpesifik = prev.tanggalSpesifik || 'Pelayanan rutin setiap bulan sepanjang tahun';
        if (!jadwalBln || Object.keys(jadwalBln).length === 0) {
          jadwalBln = generateJadwalBulanan(prev.tahun || 2026, 'selasa_pertama');
        }
      } else if (tipe === 'satu_kali') {
        bulan = bulan.length > 0 ? [bulan[0]] : [selectedMonth === 'all' ? 1 : selectedMonth];
        modeTgl = 'tanggal_pasti';
      } else {
        if (bulan.length === 12 || bulan.length === 0) {
          bulan = [3, 6, 9];
        }
        modeTgl = 'tanggal_pasti';
      }
      return {
        ...prev,
        tipeJadwal: tipe,
        bulanPelaksanaan: bulan,
        jadwalBulanan: jadwalBln,
        modeTanggal: modeTgl,
        tanggalSpesifik: tglSpesifik,
      };
    });
    setHasUnsavedChanges(true);
  };

  // Monthly date input handler for each month
  const handleJadwalBulananChange = (bulanNo: number, val: string) => {
    setFormData((prev) => ({
      ...prev,
      jadwalBulanan: {
        ...(prev.jadwalBulanan || {}),
        [bulanNo]: val,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Auto-fill all 12 months with a recurring pattern
  const handleAutoFillMonthlyDates = (
    pola: 'selasa_pertama' | 'minggu_pertama' | 'tanggal_1' | 'tanggal_5' | 'tanggal_10' | 'tanggal_15'
  ) => {
    const targetYear = formData.tahun || 2026;
    const generated = generateJadwalBulanan(targetYear, pola);
    setFormData((prev) => ({
      ...prev,
      jadwalBulanan: generated,
      modeTanggal: 'rutin_berkala',
      tanggalSpesifik:
        pola === 'selasa_pertama'
          ? 'Setiap Selasa pertama tiap bulan'
          : pola === 'minggu_pertama'
          ? 'Setiap Minggu pertama tiap bulan'
          : `Setiap tanggal ${pola.replace('tanggal_', '')} tiap bulan`,
    }));
    setHasUnsavedChanges(true);
    showToast('Rencana tanggal 12 bulan berhasil diisi otomatis!');
  };

  // Month toggle for multi_bulan or satu_kali
  const handleToggleMonth = (m: number) => {
    setFormData((prev) => {
      if (prev.tipeJadwal === 'satu_kali') {
        return { ...prev, bulanPelaksanaan: [m] };
      }
      const existing = prev.bulanPelaksanaan || [];
      let updated: number[];
      if (existing.includes(m)) {
        if (existing.length <= 1) return prev; // Keep at least one
        updated = existing.filter((b) => b !== m);
      } else {
        updated = [...existing, m].sort((a, b) => a - b);
      }
      return { ...prev, bulanPelaksanaan: updated };
    });
    setHasUnsavedChanges(true);
  };

  // Save changes
  const handleSave = () => {
    const errors: Record<string, string> = {};
    if (!formData.namaProgram?.trim()) errors.namaProgram = 'Nama program wajib diisi';
    if (!formData.tujuanKegiatan?.trim()) errors.tujuanKegiatan = 'Tujuan kegiatan wajib diisi';
    if (!formData.targetSasaran?.trim()) errors.targetSasaran = 'Target sasaran wajib diisi';
    if (!formData.penanggungjawab?.nama?.trim()) errors.pjNama = 'Nama PJ wajib diisi';
    if (!formData.bulanPelaksanaan || formData.bulanPelaksanaan.length === 0) {
      errors.bulanPelaksanaan = 'Pilih minimal 1 bulan pelaksanaan';
    }
    if (formData.tipeJadwal === 'sepanjang_tahun') {
      const datesCount = Object.values(formData.jadwalBulanan || {}).filter((v) => v?.trim()).length;
      if (datesCount === 0) {
        // Auto fill if totally empty
        const auto = generateJadwalBulanan(formData.tahun || 2026, 'selasa_pertama');
        formData.jadwalBulanan = auto;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Mohon lengkapi kolom yang wajib diisi!');
      return;
    }

    const now = new Date().toISOString();
    const updated: ProgramKerja = {
      ...(formData as ProgramKerja),
      id: currentId,
      updatedAt: now,
    };
    dbService.saveProgram(updated);
    setHasUnsavedChanges(false);
    showToast('Data program kerja berhasil disimpan ke Cloud & Lokal!');
  };

  // Create new program for specific selected Seksi
  const handleCreateProgramForSeksi = (seksiName: string, defaultPicName: string) => {
    const targetTahun = selectedYear === 'all' ? 2026 : selectedYear;
    const initialBulan: number[] = selectedMonth === 'all' ? [1, 2, 3] : [selectedMonth];
    const initialTipe: ScheduleType = selectedMonth === 'all' ? 'multi_bulan' : 'satu_kali';
    const newId = `proker-${Date.now()}`;
    const newProg: ProgramKerja = {
      id: newId,
      tahun: targetTahun,
      namaProgram: `Program Kerja ${seksiName}`,
      tujuanKegiatan: '',
      targetSasaran: '',
      estimasiAnggaran: 10000000,
      tipeJadwal: initialTipe,
      bulanPelaksanaan: initialBulan,
      modeTanggal: 'tanggal_pasti',
      tanggalSpesifik: 'Tanggal akan ditentukan kemudian',
      penanggungjawab: {
        nama: defaultPicName,
        divisi: seksiName,
        kontak: '',
      },
      status: 'direncanakan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If currently filtered by a different seksi, reset or align filter to new seksi
    if (selectedSeksi !== 'all' && !isDivisionMatch(selectedSeksi, seksiName)) {
      setSelectedSeksi('all');
    }

    dbService.saveProgram(newProg);
    setCurrentId(newId);
    setActiveTab('input');
    showToast(`Program baru untuk ${seksiName} dibuat dengan PIC ${defaultPicName}!`);
  };

  // Create new program in place
  const handleAddNew = () => {
    const targetTahun = selectedYear === 'all' ? 2026 : selectedYear;
    const targetSeksi = selectedSeksi !== 'all' ? selectedSeksi : DAFTAR_DIVISI[0];
    const defaultPic = getDefaultPicForDivisi(targetSeksi);
    const initialBulan: number[] = selectedMonth === 'all' ? [1, 2, 3] : [selectedMonth];
    const initialTipe: ScheduleType = selectedMonth === 'all' ? 'multi_bulan' : 'satu_kali';
    const newId = `proker-${Date.now()}`;
    const newProg: ProgramKerja = {
      id: newId,
      tahun: targetTahun,
      namaProgram: 'Program Kerja Baru',
      tujuanKegiatan: '',
      targetSasaran: '',
      estimasiAnggaran: 10000000,
      tipeJadwal: initialTipe,
      bulanPelaksanaan: initialBulan,
      modeTanggal: 'tanggal_pasti',
      tanggalSpesifik: 'Tanggal akan ditentukan kemudian',
      penanggungjawab: {
        nama: defaultPic,
        divisi: targetSeksi,
        kontak: '',
      },
      status: 'direncanakan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dbService.saveProgram(newProg);
    setCurrentId(newId);
    setActiveTab('input');
    showToast(`Program baru dibuat dengan PIC ${defaultPic}!`);
  };

  // Duplicate current program
  const handleDuplicate = () => {
    if (!currentProgram) return;
    const newId = `proker-${Date.now()}`;
    const duplicated: ProgramKerja = {
      ...currentProgram,
      id: newId,
      namaProgram: `${currentProgram.namaProgram} (Salinan)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dbService.saveProgram(duplicated);
    setCurrentId(newId);
    showToast('Program berhasil disalin!');
  };

  // Delete current program - buka modal konfirmasi
  const handleDeleteClick = () => {
    if (!currentProgram) return;
    setIsDeleteModalOpen(true);
  };

  // Eksekusi penghapusan setelah dikonfirmasi oleh pengguna di modal
  const handleExecuteDelete = () => {
    if (!currentProgram) return;
    if (programs.length <= 1) {
      showToast('Minimal harus ada 1 program kerja dalam sistem.');
      setIsDeleteModalOpen(false);
      return;
    }

    const progName = currentProgram.namaProgram;
    dbService.deleteProgram(currentId);
    const remaining = programs.filter((p) => p.id !== currentId);
    const nextActive = remaining[0]?.id || '';
    setCurrentId(nextActive);
    setIsDeleteModalOpen(false);
    showToast(`Program "${progName}" berhasil dihapus.`);
  };

  // Programs in selected year
  const programsInSelectedYear = useMemo(() => {
    return programs.filter((p) =>
      selectedYear === 'all' ? true : p.tahun === selectedYear
    );
  }, [programs, selectedYear]);

  // Month counts calculation for month filter tabs (termasuk pelayanan rutin yang berjalan tiap bulan)
  const monthCounts = useMemo(() => {
    return BULAN_LIST.map((m) => {
      const count = programsInSelectedYear.filter(
        (p) => p.bulanPelaksanaan?.includes(m.no) || isPelayananRutin(p)
      ).length;
      return { ...m, count };
    });
  }, [programsInSelectedYear]);

  // Active divisions with proker count in selected month
  const activeSeksiInSelectedMonth = useMemo(() => {
    const activeInMonth = programsInSelectedYear.filter((p) => {
      if (selectedMonth !== 'all') {
        return p.bulanPelaksanaan?.includes(selectedMonth) || isPelayananRutin(p);
      }
      return true;
    });

    return MASTER_DIVISIONS.map((div) => {
      const count = activeInMonth.filter((p) => isDivisionMatch(p.penanggungjawab?.divisi, div.nama)).length;
      return {
        division: div,
        count,
      };
    }).filter((item) => item.count > 0);
  }, [programsInSelectedYear, selectedMonth]);

  // Auto-reset selectedSeksi jika seksi/DPPH tidak memiliki program di bulan yang baru dipilih
  // Catatan: Jangan me-reset jika user login sebagai unit seksi tertentu agar pilihan tetap konsisten
  useEffect(() => {
    if (authSession?.role === 'seksi') {
      return;
    }
    if (selectedSeksi !== 'all') {
      const isAvailable = activeSeksiInSelectedMonth.some(
        (item) => isDivisionMatch(item.division.nama, selectedSeksi)
      );
      if (!isAvailable) {
        setSelectedSeksi('all');
      }
    }
  }, [selectedMonth, activeSeksiInSelectedMonth, selectedSeksi, authSession]);

  // Overall budget summary
  const totalAnggaran = useMemo(() => {
    return filteredPrograms.reduce((sum, p) => sum + (p.estimasiAnggaran || 0), 0);
  }, [filteredPrograms]);

  return (
    <ErrorBoundary>
      <div
        className={`min-h-screen bg-slate-100 flex flex-col items-center ${
        isMobileDeviceFrame ? 'py-5 px-3' : ''
      }`}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Single-Screen Container */}
      <div
        className={`w-full bg-slate-50 min-h-screen flex flex-col relative transition-all ${
          isMobileDeviceFrame
            ? 'max-w-[430px] rounded-[36px] shadow-2xl border-4 border-slate-300 overflow-hidden min-h-[850px]'
            : activeTab === 'dashboard'
            ? 'w-full max-w-5xl lg:max-w-6xl mx-auto shadow-sm'
            : 'w-full max-w-xl md:max-w-2xl mx-auto shadow-sm'
        }`}
      >
        {/* Device Status Bar Simulation */}
        {isMobileDeviceFrame && (
          <div className="bg-white px-6 pt-3 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0 select-none">
            <span>09:41</span>
            <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto" />
            <div className="flex items-center gap-1.5 text-xs">
              <span>5G</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* 1. HEADER (1 Layar) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 pt-2 pb-2 space-y-1.5">
          {/* Top Brand & Actions - Memanjang di Mobile dengan Tombol Kompak di Baris Bawah */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
            {/* Bagian Judul: Dibuat Memanjang Penuh di Mobile */}
            <div className="flex items-center gap-2 min-w-0 w-full">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[11px] sm:text-xs md:text-sm font-extrabold text-slate-900 leading-snug break-words">
                  Program Kerja Paroki St Perawan Maria Yang Dikandung Tanpa Noda Katedral Keuskupan Agung Medan
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <p className="text-[9px] sm:text-[10px] text-emerald-700 font-bold">
                    {selectedYear === 'all'
                      ? 'Tahun Anggaran 2026 & 2027'
                      : `Tahun Anggaran ${selectedYear}`}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Cloud Synced
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Aksi: Jika belum login, HANYA tombol Login PIN */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
              {/* Session / Lock Indicator Badge & Login / Logout in Header */}
              {authSession ? (
                <>
                  <div className="flex items-center gap-1">
                    <div className="h-7 px-2 rounded-md bg-slate-900 text-white flex items-center gap-1.5 text-[10px] shadow-2xs">
                      <span className="font-extrabold truncate max-w-[110px] sm:max-w-[145px]">
                        {authSession.role === 'pastor_paroki'
                          ? '👑 Pastor Paroki'
                          : authSession.role === 'semua_seksi'
                          ? '🌐 Semua Seksi'
                          : `🏛️ ${authSession.unitNama}`}
                      </span>
                      {authSession.role === 'pastor_paroki' && (
                        <button
                          type="button"
                          onClick={() => setIsPinManagerOpen(true)}
                          className="px-1.5 py-0.2 rounded bg-indigo-600 hover:bg-indigo-500 text-[9px] font-bold text-white transition-colors cursor-pointer"
                          title="Kelola & Reset PIN"
                        >
                          PIN
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleLockDashboard}
                      className="h-7 px-2 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[10px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="Keluar / Logout dan kunci kembali dashboard"
                    >
                      <LogOut className="w-3 h-3 text-rose-600" />
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>

                  {/* Export / Download CSV Button */}
                  <button
                    type="button"
                    onClick={() => exportToCSV(programs)}
                    className="flex-1 sm:flex-none h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 transition-colors shadow-2xs"
                    title="Unduh Data ke CSV / Excel"
                  >
                    <Download className="w-3 h-3 text-slate-600" />
                    <span>Download</span>
                  </button>

                  {/* Input Program per Seksi Button */}
                  <button
                    type="button"
                    onClick={() => setIsSelectSeksiModalOpen(true)}
                    className="flex-1 sm:flex-none h-7 px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                    title="Pilih seksi untuk input program kerja baru"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Input Seksi</span>
                  </button>

                  {/* Tambah Baru Button */}
                  <button
                    type="button"
                    onClick={handleAddNew}
                    className="flex-1 sm:flex-none h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                    title="Tambah Program Baru"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" />
                    <span>+ Baru</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('dashboard');
                    setUnlockTarget({
                      unitId: 'all',
                      unitNama: 'Semua Unit',
                    });
                  }}
                  className="h-7.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                  title="Masuk / Login dengan PIN angka untuk membuka data"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-100" />
                  <span>Login PIN</span>
                </button>
              )}

              {/* Toggle HP Frame mode on desktop */}
              <button
                type="button"
                onClick={() => setIsMobileDeviceFrame(!isMobileDeviceFrame)}
                className="hidden md:flex h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 items-center justify-center shrink-0 text-[10px]"
                title="Ubah Tampilan Mode HP / Lebar"
              >
                {isMobileDeviceFrame ? (
                  <Monitor className="w-3 h-3" />
                ) : (
                  <Smartphone className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* TAB NAVIGASI & KONTROL FILTER: HANYA DITAMPILKAN SETELAH LOGIN */}
          {authSession && (
            <>
              {/* TAB NAVIGASI: DASHBOARD vs INPUT & DETAIL PROGRAM */}
              <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dashboard Program</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('input')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'input'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Input & Detail Program</span>
                </button>
              </div>

          {/* KONTROL KHUSUS TAB DASHBOARD: PILIHAN PERIODE & SEKSI TETAP DI ATAS SAAT SCROLL DOWN SEPERTI JUDUL */}
          {activeTab === 'dashboard' && (
            <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-800 px-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Pilihan Periode, DPPH & Seksi:</span>
                </div>

                {/* Tahun Pill Selector */}
                <div className="flex items-center p-0.5 bg-slate-200/70 rounded-md text-[9.5px] font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedYear(2026)}
                    className={`px-1.5 py-0.5 rounded transition-all ${
                      selectedYear === 2026 ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2026
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedYear(2027)}
                    className={`px-1.5 py-0.5 rounded transition-all ${
                      selectedYear === 2027 ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2027
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedYear('all')}
                    className={`px-1.5 py-0.5 rounded transition-all ${
                      selectedYear === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                </div>
              </div>

              {/* HANYA 1 BARIS: DRAGDOWN BULAN & DRAGDOWN SEKSI */}
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {/* Dragdown Pilihan Bulan */}
                <div className="relative min-w-0">
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                      setSelectedMonth(val);
                    }}
                    className="w-full h-7.5 bg-white border border-slate-300 rounded-lg pl-2 pr-6 text-[10.5px] font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer shadow-2xs truncate"
                    title="Pilih Bulan Kegiatan"
                  >
                    <option value="all">Semua Bulan ({programsInSelectedYear.length} proker)</option>
                    {monthCounts.map((m) => (
                      <option key={m.no} value={m.no}>
                        Bulan {m.nama} ({m.count} proker)
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[9px]">
                    ▼
                  </span>
                </div>

                {/* Dragdown Pilihan DPPH & Seksi */}
                <div className="relative min-w-0">
                  <select
                    value={selectedSeksi}
                    onChange={(e) => handleSelectSeksiWithAuth(e.target.value)}
                    className="w-full h-7.5 bg-white border border-slate-300 rounded-lg pl-2 pr-6 text-[10.5px] font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer shadow-2xs truncate"
                    title="Pilih DPPH atau Seksi Tertentu"
                  >
                    <option value="all">
                      Semua Unit (DPPH & 15 Seksi) ({activeSeksiInSelectedMonth.length} aktif)
                    </option>
                    {/* DPPH di urutan pertama, lalu 15 Seksi */}
                    {MASTER_DIVISIONS.map((div) => {
                      const activeItem = activeSeksiInSelectedMonth.find((item) =>
                        isDivisionMatch(item.division.nama, div.nama)
                      );
                      const count = activeItem ? activeItem.count : 0;
                      return (
                        <option key={div.id} value={div.nama}>
                          {div.code === 'DPPH' ? '🏛️ ' : ''}{div.nama} ({count} proker)
                        </option>
                      );
                    })}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[9px]">
                    ▼
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* KONTROL KHUSUS TAB INPUT: FILTER 1 BARIS & DROPDOWN PEMILIH PROGRAM */}
          {activeTab === 'input' && (
            <>
              {/* FILTER DRAGDOWN: TAHUN, BULAN, & SEKSI (HANYA 1 BARIS & UKURAN LEBIH KECIL) */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                {/* 1. Dragdown Pilihan Tahun Anggaran */}
                <div className="relative min-w-0">
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : (parseInt(e.target.value, 10) as 2026 | 2027);
                      setSelectedYear(val);
                    }}
                    className="w-full h-7 bg-white border border-slate-300 rounded-md pl-1.5 pr-4 text-[10px] font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer shadow-2xs truncate"
                    title="Filter Berdasarkan Tahun Anggaran"
                  >
                    <option value="all">Semua Tahun</option>
                    <option value={2026}>Tahun 2026</option>
                    <option value={2027}>Tahun 2027</option>
                  </select>
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                </div>

                {/* 2. Dragdown Pilihan Bulan Kegiatan */}
                <div className="relative min-w-0">
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                      setSelectedMonth(val);
                    }}
                    className="w-full h-7 bg-white border border-slate-300 rounded-md pl-1.5 pr-4 text-[10px] font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer shadow-2xs truncate"
                    title="Filter Berdasarkan Bulan Kegiatan"
                  >
                    <option value="all">Semua Bulan</option>
                    {monthCounts.map((m) => (
                      <option key={m.no} value={m.no}>
                        {m.singkatan || m.nama.slice(0, 3)} ({m.count})
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                </div>

                {/* 3. Dragdown Pilihan DPPH / Seksi */}
                <div className="relative min-w-0">
                  <select
                    value={selectedSeksi}
                    onChange={(e) => handleSelectSeksiWithAuth(e.target.value)}
                    className="w-full h-7 bg-white border border-slate-300 rounded-md pl-1.5 pr-4 text-[10px] font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer shadow-2xs truncate"
                    title="Filter Berdasarkan DPPH / Seksi"
                  >
                    <option value="all">Semua DPPH & Seksi</option>
                    {DAFTAR_DIVISI.map((div) => {
                      const count = programs.filter(
                        (p) =>
                          isDivisionMatch(p.penanggungjawab?.divisi, div) &&
                          (selectedYear === 'all' || p.tahun === selectedYear)
                      ).length;
                      return (
                        <option key={div} value={div}>
                          {div} {count > 0 ? `(${count})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                </div>
              </div>

              {/* 3. DROPDOWN (DRAGDOWN) PEMILIHAN PROGRAM & PREV/NEXT NAVIGATION */}
              <div className="bg-slate-100/80 p-1.5 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1 px-0.5">
                  <span>Pilih Program Kerja:</span>
                  <span className="tabular-nums">
                    {filteredPrograms.length > 0
                      ? `Data ${currentIndex + 1} dari ${filteredPrograms.length}`
                      : '0 data'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Tombol Sebelumnya */}
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentIndex <= 0}
                    className="w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-700 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-50 shrink-0 transition-colors shadow-2xs"
                    title="Pilih Data Sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* The Dragdown / Dropdown Selector */}
                  <div className="flex-1 relative min-w-0">
                    <select
                      value={currentId}
                      onChange={(e) => setCurrentId(e.target.value)}
                      className="w-full h-8 bg-white border border-slate-300 rounded-md px-2 pr-6 text-[11px] font-bold text-slate-900 truncate focus:outline-none focus:border-slate-500 cursor-pointer shadow-2xs"
                    >
                      {filteredPrograms.length === 0 ? (
                        <option value="">(Tidak ada program yang cocok dengan filter)</option>
                      ) : (
                        filteredPrograms.map((p, idx) => (
                          <option key={p.id} value={p.id}>
                            {idx + 1}. [{p.tahun}] {p.namaProgram} · {formatRupiah(p.estimasiAnggaran)}
                          </option>
                        ))
                      )}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[9px]">
                      ▼
                    </span>
                  </div>

                  {/* Tombol Berikutnya */}
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={currentIndex >= filteredPrograms.length - 1}
                    className="w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-700 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-50 shrink-0 transition-colors shadow-2xs"
                    title="Pilih Data Berikutnya"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </header>

        {/* 4. MAIN BODY: DASHBOARD ATAU FORM INPUT & DETAIL PROGRAM */}
        <main className="flex-1 px-3 sm:px-4 py-3 pb-24 overflow-y-auto space-y-4">
          {activeTab === 'dashboard' ? (
            <ErrorBoundary>
              <DashboardView
                programs={programs}
                selectedYear={selectedYear}
                onSelectYear={setSelectedYear}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                selectedSeksi={selectedSeksi}
                onSelectSeksi={handleSelectSeksiWithAuth}
                onOpenProgramDetail={(progId) => {
                  setCurrentId(progId);
                  setActiveTab('input');
                }}
                onInputProgramForSeksi={(seksiName) => {
                  handleCreateProgramForSeksi(seksiName, getDefaultPicForDivisi(seksiName));
                }}
                onOpenEvaluasi={(prog) => {
                  setEvaluatingProgram(prog);
                }}
                authSession={authSession}
                onAuthenticate={handleAuthenticate}
                onLockDashboard={handleLockDashboard}
                onOpenPinManager={() => setIsPinManagerOpen(true)}
                onPromptUnlockUnit={(unitId, unitNama) => setUnlockTarget({ unitId, unitNama })}
              />
            </ErrorBoundary>
          ) : !authSession ? (
            /* Protected Locked state for Input tab */
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 text-center space-y-4 max-w-lg mx-auto shadow-sm mt-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Data Program Dilindungi PIN Keamanan
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 max-w-xs mx-auto leading-relaxed">
                  Data program kerja Paroki St. Perawan Maria Katedral Medan hanya dapat diakses dengan memasukkan PIN. Silakan buka akses di tab Dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Buka Kunci Akses di Dashboard</span>
              </button>
            </div>
          ) : filteredPrograms.length === 0 ? (
            /* Empty State if filter yields no items */
            <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center space-y-3 mt-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Tidak ada program kerja pada filter ini
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {selectedMonth !== 'all'
                  ? `Tidak ada program yang berlangsung di bulan ${
                      BULAN_LIST[(selectedMonth as number) - 1]?.nama
                    }.`
                  : 'Tidak ada data program pada pilihan tahun ini.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear('all');
                    setSelectedMonth('all');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Semua Filter
                </button>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold shadow-xs hover:bg-slate-800"
                >
                  + Tambah Program di Bulan Ini
                </button>
              </div>
            </div>
          ) : currentProgram ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-4">
              {/* Highlight Banner Saat Filter Bulan Tertentu Aktif */}
              {selectedMonth !== 'all' && (
                <div className="bg-emerald-50/90 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-bold min-w-0">
                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      Fokus Bulan {BULAN_LIST[(selectedMonth as number) - 1]?.nama} {formData.tahun}:
                    </span>
                  </div>
                  <span className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 ml-2">
                    {formatIndonesianDate(
                      formData.jadwalBulanan?.[selectedMonth as number] || formData.tanggalSpesifik
                    ) || 'Belum dipilih'}
                  </span>
                </div>
              )}

              {/* Form Bar: Tahun, Status, & Quick Actions */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                {/* Dragdown Pilihan Tahun Program */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-600 font-bold">Tahun:</span>
                  <div className="relative">
                    <select
                      value={formData.tahun || 2026}
                      onChange={(e) => {
                        const newTahun = parseInt(e.target.value, 10) as 2026 | 2027;
                        setFormData((prev) => ({ ...prev, tahun: newTahun }));
                        setHasUnsavedChanges(true);
                      }}
                      className="h-8 bg-slate-50 border border-slate-300 rounded-lg pl-2.5 pr-7 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-slate-500 shadow-2xs"
                    >
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-semibold">Status:</span>
                  <select
                    value={formData.status || 'direncanakan'}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        status: e.target.value as ProgramStatus,
                      }));
                      setHasUnsavedChanges(true);
                    }}
                    className={`text-xs font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${
                      getStatusInfo(formData.status || 'direncanakan').color
                    }`}
                  >
                    <option value="direncanakan">Direncanakan</option>
                    <option value="berjalan">Sedang Berjalan</option>
                    <option value="selesai">Selesai</option>
                    <option value="ditunda">Ditunda</option>
                  </select>
                </div>
              </div>

              {/* FIELD 1: NAMA PROGRAM */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. Nama Program Kerja <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.namaProgram || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, namaProgram: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Masukkan nama program kerja..."
                  className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                    formErrors.namaProgram ? 'border-rose-400' : 'border-slate-200 focus:border-slate-400'
                  }`}
                />
                {formErrors.namaProgram && (
                  <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.namaProgram}</p>
                )}
              </div>

              {/* FIELD 2: TUJUAN KEGIATAN */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  2. Tujuan Kegiatan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.tujuanKegiatan || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, tujuanKegiatan: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Uraikan tujuan dan hasil yang ingin dicapai..."
                  className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                    formErrors.tujuanKegiatan ? 'border-rose-400' : 'border-slate-200 focus:border-slate-400'
                  }`}
                />
                {formErrors.tujuanKegiatan && (
                  <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.tujuanKegiatan}</p>
                )}
              </div>

              {/* FIELD 3: TARGET SASARAN */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  3. Target Sasaran / Output <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.targetSasaran || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, targetSasaran: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Contoh: 150 peserta, 10 cabang, zero insiden"
                  className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                    formErrors.targetSasaran ? 'border-rose-400' : 'border-slate-200 focus:border-slate-400'
                  }`}
                />
                {formErrors.targetSasaran && (
                  <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.targetSasaran}</p>
                )}
              </div>

              {/* FIELD 4: ESTIMASI ANGGARAN */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    4. Estimasi Anggaran (Rupiah) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs font-bold text-emerald-700 tabular-nums">
                    {formatRupiah(formData.estimasiAnggaran || 0)}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={rawAnggaran}
                    onChange={(e) => handleAnggaranChange(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {/* FIELD 5: JADWAL PELAKSANAAN (3 Pilihan: Sepanjang Tahun, Multi Bulan Terjadwal, Satu Kali Pelaksanaan) */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  5. Jadwal Pelaksanaan <span className="text-rose-500">*</span>
                </label>

                {/* Dragdown Pilihan Pola Jadwal Pelaksanaan */}
                <div className="mb-2.5">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pilihan Pola Pelaksanaan:
                  </label>
                  <div className="relative">
                    <select
                      value={formData.tipeJadwal || 'sepanjang_tahun'}
                      onChange={(e) => handleTipeJadwalChange(e.target.value as ScheduleType)}
                      className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 pr-8 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer shadow-2xs"
                    >
                      <option value="sepanjang_tahun">Pelayanan Rutin (Sepanjang Tahun 12 Bulan)</option>
                      <option value="multi_bulan">Multi Bulan Terjadwal (Beberapa Bulan Tertentu)</option>
                      <option value="satu_kali">Satu Kali Pelaksanaan (1 Bulan Tertentu)</option>
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
                  </div>
                </div>

                {/* Sub-UI: Pelayanan Rutin Sepanjang Tahun */}
                {formData.tipeJadwal === 'sepanjang_tahun' && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Pelayanan berjalan rutin setiap bulan sepanjang tahun (Januari – Desember). Tanggal pelaksanaan harian/mingguan berkala menyesuaikan jadwal paroki.</span>
                    </div>

                    {/* Input Rencana Tanggal Tiap Bulan */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-800">
                            Tanggal Rencana Pelaksanaan Tiap Bulan <span className="text-rose-500">*</span>
                          </label>
                          <p className="text-[10px] text-slate-500">
                            Input tanggal rencana untuk 12 bulan (Januari s/d Desember {formData.tahun})
                          </p>
                        </div>
                      </div>

                      {/* Tombol Pintas Isi Otomatis */}
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">Otomatisasi:</span>
                        <button
                          type="button"
                          onClick={() => handleAutoFillMonthlyDates('selasa_pertama')}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs shrink-0"
                          title="Generate Selasa pertama setiap bulan"
                        >
                          ⚡ Selasa Pertama
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAutoFillMonthlyDates('minggu_pertama')}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shrink-0"
                        >
                          ⚡ Minggu Pertama
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAutoFillMonthlyDates('tanggal_1')}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shrink-0"
                        >
                          ⚡ Tgl 1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAutoFillMonthlyDates('tanggal_5')}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shrink-0"
                        >
                          ⚡ Tgl 5
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAutoFillMonthlyDates('tanggal_10')}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shrink-0"
                        >
                          ⚡ Tgl 10
                        </button>
                      </div>

                      {/* 12 Bulan Calendar Date Pickers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                        {BULAN_LIST.map((b) => {
                          const isoVal = toISODateString(formData.jadwalBulanan?.[b.no]);
                          const lastDay = new Date(formData.tahun || 2026, b.no, 0).getDate();
                          const minDate = `${formData.tahun || 2026}-${String(b.no).padStart(2, '0')}-01`;
                          const maxDate = `${formData.tahun || 2026}-${String(b.no).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                          const formattedLabel = formatIndonesianDate(isoVal, true);

                          return (
                            <div
                              key={b.no}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{b.nama} {formData.tahun}</span>
                                </span>
                                {isoVal ? (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Sudah Dipilih
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-medium">
                                    Pilih Tanggal
                                  </span>
                                )}
                              </div>

                              <input
                                type="date"
                                min={minDate}
                                max={maxDate}
                                value={isoVal}
                                onChange={(e) => handleJadwalBulananChange(b.no, e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-400 focus:bg-white cursor-pointer"
                              />

                              {isoVal && (
                                <p className="text-[10px] text-emerald-800 font-semibold mt-1 truncate">
                                  🗓 {formattedLabel}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-UI: Multi Bulan Terjadwal */}
                {formData.tipeJadwal === 'multi_bulan' && (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700">
                        Pilih Bulan Terjadwal ({formData.bulanPelaksanaan?.length || 0} bulan terpilih):
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              bulanPelaksanaan: [3, 6, 9, 12],
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="text-emerald-700 font-bold hover:underline"
                        >
                          Triwulan
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              bulanPelaksanaan: [1, 2, 3, 4, 5, 6],
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="text-emerald-700 font-bold hover:underline"
                        >
                          Sem 1
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              bulanPelaksanaan: [7, 8, 9, 10, 11, 12],
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="text-emerald-700 font-bold hover:underline"
                        >
                          Sem 2
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                      {BULAN_LIST.map((m) => {
                        const isSelected = formData.bulanPelaksanaan?.includes(m.no);
                        return (
                          <button
                            key={m.no}
                            type="button"
                            onClick={() => handleToggleMonth(m.no)}
                            className={`py-1.5 text-xs font-bold rounded-lg border text-center transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {m.singkatan}
                          </button>
                        );
                      })}
                    </div>

                    {/* Input Tanggal Kalender untuk Bulan Terpilih */}
                    {formData.bulanPelaksanaan && formData.bulanPelaksanaan.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Pilih Tanggal Rencana Pelaksanaan Bulan Terpilih (Kalender):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                          {formData.bulanPelaksanaan.map((mNo) => {
                            const bObj = BULAN_LIST[mNo - 1];
                            const isoVal = toISODateString(formData.jadwalBulanan?.[mNo]);
                            const lastDay = new Date(formData.tahun || 2026, mNo, 0).getDate();
                            const minDate = `${formData.tahun || 2026}-${String(mNo).padStart(2, '0')}-01`;
                            const maxDate = `${formData.tahun || 2026}-${String(mNo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                            const formattedLabel = formatIndonesianDate(isoVal, true);

                            return (
                              <div
                                key={mNo}
                                className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{bObj?.nama} {formData.tahun}</span>
                                  </span>
                                  {isoVal ? (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      Terpilih
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 font-medium">
                                      Pilih Tanggal
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="date"
                                  min={minDate}
                                  max={maxDate}
                                  value={isoVal}
                                  onChange={(e) => handleJadwalBulananChange(mNo, e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-400 focus:bg-white cursor-pointer"
                                />
                                {isoVal && (
                                  <p className="text-[10px] text-emerald-800 font-semibold mt-1 truncate">
                                    🗓 {formattedLabel}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-UI: Satu Kali Pelaksanaan */}
                {formData.tipeJadwal === 'satu_kali' && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-800">
                      Pilih Tanggal Pelaksanaan dari Kalender:
                    </label>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                        <input
                          type="date"
                          min={`${formData.tahun || 2026}-01-01`}
                          max={`${formData.tahun || 2026}-12-31`}
                          value={toISODateString(formData.tanggalSpesifik)}
                          onChange={(e) => {
                            const picked = e.target.value;
                            if (picked) {
                              const mo = parseInt(picked.split('-')[1], 10);
                              setFormData((prev) => ({
                                ...prev,
                                tanggalSpesifik: picked,
                                bulanPelaksanaan: [mo],
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                tanggalSpesifik: '',
                              }));
                            }
                            setHasUnsavedChanges(true);
                          }}
                          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-500 cursor-pointer"
                        />
                      </div>
                      {formData.tanggalSpesifik && (
                        <p className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                          🗓 {formatIndonesianDate(formData.tanggalSpesifik, true)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* FIELD 6: PENANGGUNG JAWAB (PIC) */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    6. Penanggung Jawab (PIC) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Otomatis: Koordinator Seksi
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={formData.penanggungjawab?.nama || ''}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          penanggungjawab: {
                            ...(prev.penanggungjawab || { divisi: DAFTAR_DIVISI[0], kontak: '' }),
                            nama: e.target.value,
                          },
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Nama PIC (contoh: Koordinator Seksi Keamanan)"
                      className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none ${
                        formErrors.pjNama ? 'border-rose-400' : 'border-slate-200 focus:border-slate-400'
                      }`}
                    />
                    {formErrors.pjNama && (
                      <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.pjNama}</p>
                    )}

                    {/* Quick Button: Set/Reset to official Koordinator title */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-medium">Gelar Standar:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const autoPic = getDefaultPicForDivisi(formData.penanggungjawab?.divisi || DAFTAR_DIVISI[0]);
                          setFormData((prev) => ({
                            ...prev,
                            penanggungjawab: {
                              ...(prev.penanggungjawab || { divisi: DAFTAR_DIVISI[0], kontak: '' }),
                              nama: autoPic,
                            },
                          }));
                          setHasUnsavedChanges(true);
                          showToast(`Gelar PIC diatur: ${autoPic}`);
                        }}
                        className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors"
                        title="Klik untuk memasang gelar Koordinator Seksi ini"
                      >
                        ⚡ Set: {getDefaultPicForDivisi(formData.penanggungjawab?.divisi || DAFTAR_DIVISI[0])}
                      </button>
                    </div>
                  </div>

                  <div>
                    <select
                      value={formData.penanggungjawab?.divisi || DAFTAR_DIVISI[0]}
                      onChange={(e) => {
                        const newDiv = e.target.value;
                        const prevDiv = formData.penanggungjawab?.divisi || DAFTAR_DIVISI[0];
                        const prevDefaultPic = getDefaultPicForDivisi(prevDiv);
                        const currentName = formData.penanggungjawab?.nama || '';

                        // Update PIC name if empty or was previously a default coordinator title
                        const shouldAutoUpdate =
                          !currentName.trim() ||
                          currentName === prevDefaultPic ||
                          currentName.startsWith('Koordinator') ||
                          currentName.startsWith('Sekretariat');
                        const newPic = shouldAutoUpdate ? getDefaultPicForDivisi(newDiv) : currentName;

                        setFormData((prev) => ({
                          ...prev,
                          penanggungjawab: {
                            ...(prev.penanggungjawab || { kontak: '' }),
                            divisi: newDiv,
                            nama: newPic,
                          },
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                    >
                      {DAFTAR_DIVISI.map((div) => (
                        <option key={div} value={div}>
                          {div}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Pilihan dari 15 Seksi resmi + DPPH
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={formData.penanggungjawab?.kontak || ''}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        penanggungjawab: {
                          ...(prev.penanggungjawab || { nama: '', divisi: DAFTAR_DIVISI[0] }),
                          kontak: e.target.value,
                        },
                      }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="No. WhatsApp / Kontak (0812-xxxx)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                  {formData.penanggungjawab?.kontak && (
                    <a
                      href={`https://wa.me/${formData.penanggungjawab.kontak.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 px-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 text-xs font-bold transition-colors shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Hubungi WA</span>
                    </a>
                  )}
                </div>
              </div>

              {/* CATATAN TAMBAHAN (OPSIONAL) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Catatan Tambahan (Opsional):
                </label>
                <input
                  type="text"
                  value={formData.catatan || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, catatan: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Keterangan mitra, vendor, atau lokasi pelaksanaan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800"
                />
              </div>

              {/* MENU EVALUASI PROGRAM KERJA */}
              <div className="pt-2 border-t border-slate-200">
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-amber-950">
                            Menu Evaluasi Program Kerja
                          </h4>
                          {formData.evaluasi?.statusKeterlaksanaan === 'terlaksana' ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Terlaksana
                            </span>
                          ) : formData.evaluasi?.statusKeterlaksanaan === 'tidak_terlaksana' ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                              ✕ Tidak Terlaksana
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white text-amber-800 border border-amber-200">
                              Belum Dievaluasi
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-amber-900 mt-0.5 leading-relaxed">
                          Diisi oleh seksi bersangkutan untuk mencatat realisasi, tanggal, tempat, jumlah peserta, anggaran terpakai, dokumentasi, atau alasan tidak terlaksana.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (currentProgram) {
                          setEvaluatingProgram({
                            ...(formData as ProgramKerja),
                            id: currentId,
                          });
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{formData.evaluasi?.statusKeterlaksanaan ? 'Edit Evaluasi' : 'Isi Evaluasi'}</span>
                    </button>
                  </div>

                  {/* Ringkasan jika evaluasi sudah diisi */}
                  {formData.evaluasi?.statusKeterlaksanaan && (
                    <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-[11px] text-slate-700 space-y-1">
                      {formData.evaluasi.statusKeterlaksanaan === 'terlaksana' ? (
                        <>
                          <div className="flex items-center gap-2 flex-wrap text-emerald-900 font-bold">
                            <span>🗓 Tgl: {formData.evaluasi.tanggalPelaksanaan || 'Sesuai jadwal'}</span>
                            <span>•</span>
                            <span>📍 Tempat: {formData.evaluasi.tempatPelaksanaan || 'Belum diisi'}</span>
                            <span>•</span>
                            <span>👥 Peserta: {formData.evaluasi.jumlahPeserta || '-'}</span>
                          </div>
                          {formData.evaluasi.anggaranTerpakai !== undefined && (
                            <p className="text-slate-600">
                              Anggaran Terpakai: <span className="font-extrabold text-emerald-800">{formatRupiah(formData.evaluasi.anggaranTerpakai)}</span> (dari estimasi {formatRupiah(formData.estimasiAnggaran || 0)})
                            </p>
                          )}
                          {formData.evaluasi.penjelasanKegiatan && (
                            <p className="text-slate-600 italic">
                              "{formData.evaluasi.penjelasanKegiatan}"
                            </p>
                          )}
                          {formData.evaluasi.dokumentasi && formData.evaluasi.dokumentasi.length > 0 && (
                            <p className="text-[10px] text-indigo-700 font-bold">
                              📎 {formData.evaluasi.dokumentasi.length} Lampiran dokumentasi diunggah
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-rose-900">
                          <span className="font-bold">Alasan Tidak Terlaksana: </span>
                          {formData.evaluasi.alasanTidakTerlaksana || 'Tidak ada alasan dicantumkan.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS (Simpan, Salin, Hapus) */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    title="Duplikat Program Ini"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Salin</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="h-10 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title="Hapus Program Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  className={`h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
                    hasUnsavedChanges
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 animate-pulse'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{hasUnsavedChanges ? 'Simpan Perubahan' : 'Tersimpan ✓'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Quick Summary Strip at bottom of the 1 screen (khusus tab input) */}
          {activeTab === 'input' && (
            <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Total Program: </span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {filteredPrograms.length} proker
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Total Anggaran: </span>
                <span className="font-bold text-emerald-800 tabular-nums">
                  {formatRupiah(totalAnggaran)}
                </span>
              </div>
            </div>
          )}
        </main>

        {/* 5. FIXED BOTTOM STICKY BAR: PREV / NEXT NAVIGATION (Hanya saat tab Input / Detail aktif) */}
        {activeTab === 'input' && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-lg">
            <div className="max-w-xl md:max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-[11px] font-bold text-slate-500 tabular-nums shrink-0 px-1">
                {filteredPrograms.length > 0 ? `${currentIndex + 1} / ${filteredPrograms.length}` : '0 / 0'}
              </span>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex >= filteredPrograms.length - 1}
                className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-xs"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Pemilihan Seksi untuk Input Program Kerja Baru */}
        <SelectSeksiModal
          isOpen={isSelectSeksiModalOpen}
          onClose={() => setIsSelectSeksiModalOpen(false)}
          onSelectSeksi={(seksiName, defaultPicName) => {
            setIsSelectSeksiModalOpen(false);
            if (authSession?.role === 'seksi' && !isDivisionMatch(authSession.unitNama, seksiName)) {
              const div = MASTER_DIVISIONS.find((d) => isDivisionMatch(d.nama, seksiName));
              setUnlockTarget({
                unitId: div ? div.id : seksiName,
                unitNama: seksiName,
              });
              return;
            }
            handleCreateProgramForSeksi(seksiName, defaultPicName);
          }}
          selectedYear={selectedYear === 'all' ? 2026 : selectedYear}
          existingPrograms={programs}
        />

        {/* Modal Konfirmasi Hapus Program */}
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          program={currentProgram}
          canDelete={programs.length > 1}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleExecuteDelete}
        />

        {/* Modal Menu Evaluasi Program Kerja */}
        <EvaluasiModal
          isOpen={!!evaluatingProgram}
          program={evaluatingProgram}
          onClose={() => setEvaluatingProgram(null)}
          onSaveEvaluasi={handleSaveEvaluasi}
        />

        {/* Modal Manajemen PIN khusus Pastor Paroki / Admin */}
        <PinManagementModal
          isOpen={isPinManagerOpen}
          onClose={() => setIsPinManagerOpen(false)}
          onPinUpdated={(msg) => showToast(msg)}
        />

        {/* Modal Masukkan PIN saat memilih Seksi / DPPH */}
        {unlockTarget && (
          <UnlockUnitModal
            isOpen={!!unlockTarget}
            unitId={unlockTarget.unitId}
            unitNama={unlockTarget.unitNama}
            onClose={() => setUnlockTarget(null)}
            onSuccess={(newSession) => {
              setAuthSession(newSession);
              if (newSession.role === 'seksi') {
                setSelectedSeksi(newSession.unitNama);
              } else {
                setSelectedSeksi('all');
              }
              showToast(`Data untuk ${newSession.unitNama} berhasil dibuka!`);
            }}
          />
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
