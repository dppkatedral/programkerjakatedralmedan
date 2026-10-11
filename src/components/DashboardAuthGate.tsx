import React, { useState, useMemo } from 'react';
import {
  Building2,
  Bell,
  Calendar,
  Repeat,
} from 'lucide-react';
import { MASTER_DIVISIONS } from '../../database/master-data/divisions';
import { AuthSession } from '../types/auth';
import { ProgramKerja } from '../types/proker';
import {
  BULAN_LIST,
  isPelayananRutin,
  isDivisionMatch,
  normalizeDivisionName,
} from '../utils/formatters';

interface DashboardAuthGateProps {
  onAuthenticated?: (session: AuthSession) => void;
  initialSelectedUnit?: string;
  programs?: ProgramKerja[];
  selectedYear?: 'all' | 2026 | 2027;
}

export const DashboardAuthGate: React.FC<DashboardAuthGateProps> = ({
  programs = [],
  selectedYear = 'all',
}) => {
  // Bulan berjalan default (1 - 12) berdasarkan kalender saat ini
  const currentCalendarMonth = new Date().getMonth() + 1;
  const [activeReminderMonth, setActiveReminderMonth] = useState<number>(currentCalendarMonth);

  // 1. Program dalam tahun terpilih (jika ada filter tahun)
  const progsInYear = useMemo(() => {
    return programs.filter((p) => {
      if (selectedYear !== 'all' && p.tahun !== selectedYear) return false;
      return true;
    });
  }, [programs, selectedYear]);

  // 2. Program Kerja Terjadwal di Bulan Berjalan (Non-Rutin)
  // "reminder terkait program yang akan di dilaksanakan dibulan berjalan dari setiap seksi dan ditampilkan hanya nama program nya saja"
  const scheduledInActiveMonth = useMemo(() => {
    return progsInYear.filter((p) => {
      if (isPelayananRutin(p)) return false;
      return Array.isArray(p.bulanPelaksanaan) && p.bulanPelaksanaan.includes(activeReminderMonth);
    });
  }, [progsInYear, activeReminderMonth]);

  // Kelompokkan program terjadwal per seksi
  const groupedScheduledBySeksi = useMemo(() => {
    const map = new Map<string, { divisionName: string; divisionCode?: string; programs: ProgramKerja[] }>();

    // Urutkan berdasarkan MASTER_DIVISIONS
    MASTER_DIVISIONS.forEach((div) => {
      const matchProgs = scheduledInActiveMonth.filter((p) =>
        isDivisionMatch(p.penanggungjawab?.divisi, div.nama)
      );
      if (matchProgs.length > 0) {
        map.set(div.id, {
          divisionName: div.nama,
          divisionCode: div.code,
          programs: matchProgs,
        });
      }
    });

    // Cek jika ada program dengan divisi yang belum terpetakan di MASTER_DIVISIONS
    scheduledInActiveMonth.forEach((p) => {
      const divName = p.penanggungjawab?.divisi || 'Paroki';
      const isAlreadyGrouped = Array.from(map.values()).some((g) =>
        isDivisionMatch(g.divisionName, divName)
      );
      if (!isAlreadyGrouped) {
        const key = normalizeDivisionName(divName);
        if (!map.has(key)) {
          map.set(key, {
            divisionName: divName,
            programs: [p],
          });
        } else {
          map.get(key)!.programs.push(p);
        }
      }
    });

    return Array.from(map.values());
  }, [scheduledInActiveMonth]);

  // 3. Pelayanan Rutin Paroki
  // "jika pelaksanaan rutin juga di tampilkan tapi di buat dalam 1 kotak dgn info pelayanan rutin dan sebutkan nama seksinya"
  const routinePrograms = useMemo(() => {
    return progsInYear.filter((p) => isPelayananRutin(p));
  }, [progsInYear]);

  const currentMonthData = BULAN_LIST.find((b) => b.no === activeReminderMonth);
  const currentMonthName = currentMonthData ? currentMonthData.nama : `Bulan ${activeReminderMonth}`;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 px-1 sm:px-2 pb-10 animate-in fade-in duration-200">
      {/* =========================================================================
          BAGIAN 1: REMINDER PROGRAM BULAN BERJALAN DARI SETIAP SEKSI
          "layar depan akan berisi mengenai reminder terkait program yang akan di dilaksanakan dibulan berjalan dari setiap seksi dan ditampilkan hanya nama program nya saja"
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header Reminder Bulan Berjalan */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 px-2 py-0.2 rounded-full bg-emerald-950/70 border border-emerald-700/50">
                  Reminder Program Kerja
                </span>
                <span className="text-xs font-extrabold text-white">
                  Bulan Berjalan: <span className="text-emerald-300 underline">{currentMonthName}</span> {selectedYear !== 'all' ? selectedYear : '2026/2027'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Daftar agenda kegiatan yang akan dilaksanakan di bulan berjalan dari setiap seksi (hanya nama program).
              </p>
            </div>
          </div>

          {/* Quick Month Switcher: Memudahkan jika ingin melihat reminder bulan lain */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {BULAN_LIST.map((b) => {
              const isSelected = b.no === activeReminderMonth;
              const isCurrentCal = b.no === currentCalendarMonth;
              return (
                <button
                  key={b.no}
                  type="button"
                  onClick={() => setActiveReminderMonth(b.no)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : isCurrentCal
                      ? 'bg-white/20 text-white hover:bg-white/30 border border-emerald-400/50'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                  title={b.nama}
                >
                  {b.singkatan}
                  {isCurrentCal && !isSelected && ' •'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Konten Reminder per Seksi: HANYA MENAMPILKAN NAMA PROGRAM SAJA */}
        <div className="p-3.5 sm:p-5">
          {groupedScheduledBySeksi.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {groupedScheduledBySeksi.map((group, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50/80 rounded-xl border border-slate-200/90 p-3.5 hover:border-emerald-300 transition-all shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    {/* Header Seksi */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-emerald-600/10 text-emerald-800 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                          {group.divisionName}
                        </h4>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px] font-extrabold shrink-0">
                        {group.programs.length} Program
                      </span>
                    </div>

                    {/* DAFTAR HANYA NAMA PROGRAM NYA SAJA */}
                    <ul className="space-y-1.5 pt-0.5">
                      {group.programs.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-start gap-2 text-xs font-semibold text-slate-800 leading-snug"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                          <span className="break-words">{p.namaProgram}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2.5 mt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Pelaksanaan: {currentMonthName}</span>
                    <span className="text-[9px] font-medium text-slate-400 italic">Terjadwal</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 px-4 text-center rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Tidak ada program kerja khusus non-rutin yang terjadwal di bulan {currentMonthName}.
              </p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Setiap seksi tetap berfokus pada agenda pelayanan rutin paroki yang berjalan berkala sepanjang tahun di bawah ini.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          BAGIAN 2: SATU KOTAK DENGAN INFO PELAYANAN RUTIN & SEBUTKAN NAMA SEKSINYA
          "jika pelaksanaan rutin juga di tampilkan tapi di buat dalam 1 kotak dgn info pelayanan rutin dan sebutkan nama seksinya"
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3.5">
        {/* Header Kotak Pelayanan Rutin */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-300/40 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800 px-2 py-0.2 rounded-full bg-amber-50 border border-amber-200">
                  Agenda Tetap Sepanjang Tahun
                </span>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Info Pelayanan Rutin Paroki
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Daftar kegiatan & pelayanan berkala yang dijalankan oleh masing-masing seksi sepanjang tahun.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px]">
              {routinePrograms.length} Pelayanan Rutin
            </span>
          </div>
        </div>

        {/* Isi Kotak Pelayanan Rutin: Menampilkan Program Rutin dengan Menyebutkan Nama Seksinya */}
        {routinePrograms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {routinePrograms.map((prog) => {
              const seksiNama = prog.penanggungjawab?.divisi || 'Paroki';
              return (
                <div
                  key={prog.id}
                  className="p-3 rounded-xl bg-amber-50/30 border border-amber-200/70 hover:border-amber-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Sebutkan Nama Seksi */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-extrabold uppercase tracking-tight">
                        {seksiNama}
                      </span>
                    </div>

                    {/* Nama Program Pelayanan Rutin */}
                    <p className="text-xs font-bold text-slate-900 leading-snug">
                      {prog.namaProgram}
                    </p>
                  </div>

                  {prog.tanggalSpesifik && (
                    <p className="text-[10px] text-slate-500 mt-2 italic flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-amber-600 inline-block" />
                      <span>{prog.tanggalSpesifik}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 px-4 text-center rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-600">
              Belum ada data pelayanan rutin yang terdaftar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
