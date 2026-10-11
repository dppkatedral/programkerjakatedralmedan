import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  FileText,
  Upload,
  File,
  Trash2,
  ExternalLink,
  Save,
  AlertCircle,
  Building2,
  Eye,
} from 'lucide-react';
import { ProgramKerja, EvaluasiProgram, DokumenLampiran, StatusKeterlaksanaan } from '../types/proker';
import { formatRupiah, parseRupiahInput } from '../utils/formatters';

interface EvaluasiModalProps {
  isOpen: boolean;
  program: ProgramKerja | null;
  onClose: () => void;
  onSaveEvaluasi: (programId: string, evaluasiData: EvaluasiProgram) => void;
}

export const EvaluasiModal: React.FC<EvaluasiModalProps> = ({
  isOpen,
  program,
  onClose,
  onSaveEvaluasi,
}) => {
  const [statusKeterlaksanaan, setStatusKeterlaksanaan] = useState<StatusKeterlaksanaan>('terlaksana');
  const [tanggalPelaksanaan, setTanggalPelaksanaan] = useState<string>('');
  const [tempatPelaksanaan, setTempatPelaksanaan] = useState<string>('');
  const [jumlahPeserta, setJumlahPeserta] = useState<string>('');
  const [penjelasanKegiatan, setPenjelasanKegiatan] = useState<string>('');
  const [rawAnggaran, setRawAnggaran] = useState<string>('');
  const [anggaranTerpakai, setAnggaranTerpakai] = useState<number>(0);
  const [dokumentasi, setDokumentasi] = useState<DokumenLampiran[]>([]);
  const [alasanTidakTerlaksana, setAlasanTidakTerlaksana] = useState<string>('');
  const [jadwalBaru, setJadwalBaru] = useState<string>('');
  const [alasanPerubahanWaktu, setAlasanPerubahanWaktu] = useState<string>('');
  const [penjelasanPerubahan, setPenjelasanPerubahan] = useState<string>('');
  const [evaluator, setEvaluator] = useState<string>('');

  // Sinkronisasi data saat modal dibuka
  useEffect(() => {
    if (program) {
      const prev = program.evaluasi;
      if (prev) {
        setStatusKeterlaksanaan(prev.statusKeterlaksanaan || 'terlaksana');
        setTanggalPelaksanaan(prev.tanggalPelaksanaan || '');
        setTempatPelaksanaan(prev.tempatPelaksanaan || '');
        setJumlahPeserta(prev.jumlahPeserta || '');
        setPenjelasanKegiatan(prev.penjelasanKegiatan || '');
        setAnggaranTerpakai(prev.anggaranTerpakai || 0);
        setRawAnggaran(prev.anggaranTerpakai ? prev.anggaranTerpakai.toLocaleString('id-ID') : '');
        setDokumentasi(prev.dokumentasi || []);
        setAlasanTidakTerlaksana(prev.alasanTidakTerlaksana || '');
        setJadwalBaru(prev.jadwalBaru || '');
        setAlasanPerubahanWaktu(prev.alasanPerubahanWaktu || '');
        setPenjelasanPerubahan(prev.penjelasanPerubahan || '');
        setEvaluator(prev.evaluator || program.penanggungjawab?.nama || '');
      } else {
        // Default kosong / baru
        setStatusKeterlaksanaan('terlaksana');
        setTanggalPelaksanaan(
          (program.jadwalBulanan && Object.values(program.jadwalBulanan)[0]) ||
          (program.tanggalSpesifik?.match(/\d{4}-\d{2}-\d{2}/)?.[0]) ||
          ''
        );
        setTempatPelaksanaan('');
        setJumlahPeserta('');
        setPenjelasanKegiatan('');
        setAnggaranTerpakai(program.estimasiAnggaran || 0);
        setRawAnggaran(program.estimasiAnggaran ? program.estimasiAnggaran.toLocaleString('id-ID') : '');
        setDokumentasi([]);
        setAlasanTidakTerlaksana('');
        setJadwalBaru('');
        setAlasanPerubahanWaktu('');
        setPenjelasanPerubahan('');
        setEvaluator(program.penanggungjawab?.nama || '');
      }
    }
  }, [program, isOpen]);

  if (!isOpen || !program) return null;

  const handleAnggaranChange = (val: string) => {
    const num = parseRupiahInput(val);
    setAnggaranTerpakai(num);
    setRawAnggaran(num ? num.toLocaleString('id-ID') : '');
  };

  // Upload file dokumentasi (PDF, JPEG, PNG, etc.)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newDoc: DokumenLampiran = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          nama: file.name,
          tipe: file.type || 'application/octet-stream',
          dataUrl,
          ukuran: sizeStr,
        };
        setDokumentasi((prev) => [...prev, newDoc]);
      };

      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveDoc = (id: string) => {
    setDokumentasi((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSave = () => {
    const evaluasiData: EvaluasiProgram = {
      statusKeterlaksanaan,
      tanggalEvaluasi: new Date().toISOString(),
      evaluator: evaluator || program.penanggungjawab?.nama || 'Seksi Penanggung Jawab',
      ...(statusKeterlaksanaan === 'terlaksana'
        ? {
            tanggalPelaksanaan,
            tempatPelaksanaan,
            jumlahPeserta,
            penjelasanKegiatan,
            anggaranTerpakai,
            dokumentasi,
          }
        : statusKeterlaksanaan === 'perubahan_waktu'
        ? {
            jadwalBaru,
            alasanPerubahanWaktu,
            penjelasanPerubahan,
            dokumentasi,
          }
        : {
            alasanTidakTerlaksana,
          }),
    };

    onSaveEvaluasi(program.id, evaluasiData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                📝 Form Evaluasi
              </span>
              <span className="text-xs text-slate-300 font-semibold truncate">
                {program.penanggungjawab?.divisi}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white truncate mt-1">
              {program.namaProgram}
            </h3>
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

        {/* Form Body Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. Pilihan Status Keterlaksanaan Program: 3 Pilihan */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              1. Pilihan Status Evaluasi Pelaksanaan:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatusKeterlaksanaan('terlaksana')}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center sm:flex-col sm:items-start gap-2 cursor-pointer ${
                  statusKeterlaksanaan === 'terlaksana'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    statusKeterlaksanaan === 'terlaksana'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">1. Terlaksana</h4>
                  <p className="text-[10px] text-slate-500">Kegiatan telah selesai</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusKeterlaksanaan('tidak_terlaksana')}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center sm:flex-col sm:items-start gap-2 cursor-pointer ${
                  statusKeterlaksanaan === 'tidak_terlaksana'
                    ? 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    statusKeterlaksanaan === 'tidak_terlaksana'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-400'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">2. Tidak Terlaksana</h4>
                  <p className="text-[10px] text-slate-500">Kegiatan ditiadakan</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusKeterlaksanaan('perubahan_waktu')}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center sm:flex-col sm:items-start gap-2 cursor-pointer ${
                  statusKeterlaksanaan === 'perubahan_waktu'
                    ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/20 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    statusKeterlaksanaan === 'perubahan_waktu'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-400'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">3. Perubahan Waktu</h4>
                  <p className="text-[10px] text-slate-500">Jadwal bergeser</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2A. FORM JIKA PROGRAM TERLAKSANA (Semua bersifat opsional) */}
          {statusKeterlaksanaan === 'terlaksana' && (
            <div className="space-y-3.5 pt-2 border-t border-slate-100 animate-in fade-in">
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Seluruh kolom evaluasi di bawah ini bersifat fleksibel & opsional (tidak wajib).</span>
              </div>

              {/* Tanggal Pelaksanaan & Tempat Pelaksanaan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tanggal Pelaksanaan:</span>
                  </label>
                  <input
                    type="date"
                    value={tanggalPelaksanaan}
                    onChange={(e) => setTanggalPelaksanaan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tempat Pelaksanaan:</span>
                  </label>
                  <input
                    type="text"
                    value={tempatPelaksanaan}
                    onChange={(e) => setTempatPelaksanaan(e.target.value)}
                    placeholder="Contoh: Gedung Aula Paroki / Gereja Katedral"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Jumlah Peserta & Realisasi Anggaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Jumlah Peserta:</span>
                  </label>
                  <input
                    type="text"
                    value={jumlahPeserta}
                    onChange={(e) => setJumlahPeserta(e.target.value)}
                    placeholder="Contoh: 150 orang / 35 panitia"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Jumlah Anggaran Terpakai:</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Est: {formatRupiah(program.estimasiAnggaran)}
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Penjelasan Singkat Kegiatan */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Penjelasan Singkat Kegiatan yang Dilakukan:</span>
                </label>
                <textarea
                  rows={3}
                  value={penjelasanKegiatan}
                  onChange={(e) => setPenjelasanKegiatan(e.target.value)}
                  placeholder="Uraikan jalannya kegiatan, output yang dicapai, atau catatan penting pelaksanaan..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              {/* Dokumentasi (Upload PDF, JPEG, dll.) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Dokumentasi Kegiatan (PDF, JPEG, PNG, dll.):</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Opsional</span>
                </div>

                {/* Box Upload */}
                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-3.5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">
                    Klik untuk Unggah Foto / Dokumen PDF
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Mendukung file JPEG, PNG, PDF, atau dokumen lampiran
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* List Lampiran yang Diunggah */}
                {dokumentasi.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10.5px] font-bold text-slate-700">
                      Lampiran Terunggah ({dokumentasi.length}):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {dokumentasi.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-2 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {doc.tipe.includes('image') ? (
                              doc.dataUrl ? (
                                <img
                                  src={doc.dataUrl}
                                  alt={doc.nama}
                                  className="w-8 h-8 rounded object-cover shrink-0 border border-slate-200"
                                />
                              ) : (
                                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                              )
                            ) : (
                              <File className="w-5 h-5 text-rose-500 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 text-[11px] truncate">
                                {doc.nama}
                              </p>
                              <span className="text-[9.5px] text-slate-400">
                                {doc.ukuran || 'Lampiran'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {doc.dataUrl && (
                              <a
                                href={doc.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-slate-100"
                                title="Lihat"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(doc.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2B. FORM JIKA PROGRAM TIDAK TERLAKSANA */}
          {statusKeterlaksanaan === 'tidak_terlaksana' && (
            <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
              <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-xl text-[11px] text-rose-950 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Jelaskan kendala atau pertimbangan mengapa program kerja ini tidak dapat terlaksana.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Tidak Terlaksana:
                </label>
                <textarea
                  rows={4}
                  value={alasanTidakTerlaksana}
                  onChange={(e) => setAlasanTidakTerlaksana(e.target.value)}
                  placeholder="Contoh: Terkendala ketiadaan anggaran, perubahan jadwal kalender keuskupan, atau dialihkan ke semester berikutnya..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-rose-400 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* 2C. FORM JIKA TERJADI PERUBAHAN WAKTU PELAKSANAAN */}
          {statusKeterlaksanaan === 'perubahan_waktu' && (
            <div className="space-y-3.5 pt-2 border-t border-slate-100 animate-in fade-in">
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-[11px] text-amber-950 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Program tetap direncanakan tetapi mengalami penyesuaian atau pergeseran jadwal pelaksanaan.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Rencana Jadwal / Waktu Baru Pelaksanaan:</span>
                </label>
                <input
                  type="text"
                  value={jadwalBaru}
                  onChange={(e) => setJadwalBaru(e.target.value)}
                  placeholder="Contoh: Digeser ke Bulan Oktober 2026 / Tanggal 18 November 2026..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Perubahan Waktu Pelaksanaan:
                </label>
                <textarea
                  rows={3}
                  value={alasanPerubahanWaktu}
                  onChange={(e) => setAlasanPerubahanWaktu(e.target.value)}
                  placeholder="Contoh: Menyesuaikan agenda keuskupan, bentrok dengan kegiatan retret dekenat, atau persiapan teknis peserta..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan / Keterangan Penyesuaian (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={penjelasanPerubahan}
                  onChange={(e) => setPenjelasanPerubahan(e.target.value)}
                  placeholder="Catatan koordinasi lanjutan, lokasi pengganti, atau instruksi untuk panitia..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* PIC / Evaluator */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Nama Pengisi Evaluasi (PIC Seksi):
            </label>
            <input
              type="text"
              value={evaluator}
              onChange={(e) => setEvaluator(e.target.value)}
              placeholder="Nama penanggung jawab evaluasi..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Evaluasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
