export type ScheduleType = 'sepanjang_tahun' | 'multi_bulan' | 'satu_kali';

export type ProgramStatus = 'direncanakan' | 'berjalan' | 'selesai' | 'ditunda';

export type ModeTanggal = 'tanggal_pasti' | 'akan_ditentukan' | 'rutin_berkala';

export interface PenanggungJawab {
  nama: string;
  divisi: string;
  kontak: string;
}

export interface DokumenLampiran {
  id: string;
  nama: string;
  tipe: string; // 'application/pdf', 'image/jpeg', etc.
  dataUrl?: string; // data URI atau URL file
  ukuran?: string; // e.g. '2.4 MB'
}

export type StatusKeterlaksanaan = 'terlaksana' | 'tidak_terlaksana' | 'perubahan_waktu';

export interface EvaluasiProgram {
  statusKeterlaksanaan?: StatusKeterlaksanaan;
  // Jika terlaksana (semua opsional):
  tanggalPelaksanaan?: string;
  tempatPelaksanaan?: string;
  jumlahPeserta?: string;
  penjelasanKegiatan?: string;
  anggaranTerpakai?: number;
  dokumentasi?: DokumenLampiran[];
  // Jika tidak terlaksana:
  alasanTidakTerlaksana?: string;
  // Jika perubahan waktu pelaksanaan:
  jadwalBaru?: string; // e.g. Rencana tanggal atau bulan baru
  alasanPerubahanWaktu?: string; // Alasan pergantian waktu
  penjelasanPerubahan?: string; // Catatan tambahan perubahan
  // Metadata pengisi:
  tanggalEvaluasi?: string;
  evaluator?: string;
}

export interface ProgramKerja {
  id: string;
  tahun: 2026 | 2027;
  namaProgram: string;
  tujuanKegiatan: string;
  targetSasaran: string;
  estimasiAnggaran: number;
  tipeJadwal: ScheduleType;
  bulanPelaksanaan: number[]; // 1 = Januari, ..., 12 = Desember
  modeTanggal?: ModeTanggal; // 'tanggal_pasti' | 'akan_ditentukan' | 'rutin_berkala'
  tanggalSpesifik?: string; // e.g. "Setiap Selasa pertama tiap bulan", "15 Agustus 2026", or "Akan ditentukan kemudian"
  jadwalBulanan?: Record<number, string>; // Rencana tanggal pelaksanaan untuk tiap bulan (1-12)
  penanggungjawab: PenanggungJawab;
  status: ProgramStatus;
  evaluasi?: EvaluasiProgram; // Menu & data evaluasi keterlaksanaan program kerja
  catatan?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterOptions {
  tahun: 'all' | 2026 | 2027;
  searchQuery: string;
  tipeJadwal: 'all' | ScheduleType;
  status: 'all' | ProgramStatus;
  divisi: 'all' | string;
  selectedMonth?: number; // 1-12
}
