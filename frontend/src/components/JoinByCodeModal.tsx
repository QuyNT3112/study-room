import { useState, type FormEvent } from 'react';
import { KeyRound, X } from 'lucide-react';

interface JoinByCodeModalProps {
  isOpen: boolean;
  onSubmit: (roomCode: string) => Promise<void>;
  onClose: () => void;
}

export function JoinByCodeModal({ isOpen, onSubmit, onClose }: JoinByCodeModalProps) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = roomCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      setError('Vui lòng nhập mã phòng hợp lệ (tối thiểu 4 ký tự)');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(cleaned);
      setRoomCode('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tham gia phòng học');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tham gia bằng mã phòng</h2>
              <p className="text-xs text-slate-500">Nhập mã phòng do giáo viên cung cấp</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="join-room-code" className="block text-sm font-medium text-slate-700">
              Mã phòng học
            </label>
            <input
              id="join-room-code"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Ví dụ: JAVA25"
              maxLength={12}
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-slate-900 uppercase outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/15"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Đang tham gia...' : 'Tham gia ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
