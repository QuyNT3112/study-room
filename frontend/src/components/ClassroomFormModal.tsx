import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { ClassroomStatus, ClassroomSummary } from '../types';

interface ClassroomFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Pick<ClassroomSummary, 'id' | 'name' | 'description' | 'status'> | null;
  onSubmit: (values: { name: string; description: string; status: ClassroomStatus }) => Promise<void>;
  onClose: () => void;
}

export function ClassroomFormModal({
  isOpen,
  mode,
  initialData,
  onSubmit,
  onClose,
}: ClassroomFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ClassroomStatus>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setName(initialData.name);
        setDescription(initialData.description || '');
        setStatus(initialData.status);
      } else {
        setName('');
        setDescription('');
        setStatus('ACTIVE');
      }
      setError(null);
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setError('Tên phòng học phải có ít nhất 3 ký tự');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim(),
        status,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu thông tin phòng học');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'create' ? 'Tạo phòng học mới' : 'Chỉnh sửa phòng học'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'create'
                  ? 'Hệ thống sẽ tự động cấp mã phòng riêng cho học sinh tham gia.'
                  : 'Cập nhật thông tin và trạng thái hoạt động của phòng học.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
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
            <label htmlFor="classroom-name" className="block text-sm font-medium text-slate-700">
              Tên phòng học <span className="text-rose-500">*</span>
            </label>
            <input
              id="classroom-name"
              type="text"
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Lập trình Java Web Spring Boot"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/15"
            />
          </div>

          <div>
            <label htmlFor="classroom-description" className="block text-sm font-medium text-slate-700">
              Mô tả phòng học
            </label>
            <textarea
              id="classroom-description"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giới thiệu nội dung môn học, mục tiêu hoặc lịch học dự kiến..."
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/15"
            />
          </div>

          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Trạng thái phòng học</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('ACTIVE')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${
                    status === 'ACTIVE'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/15'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Đang mở
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('CLOSED')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${
                    status === 'CLOSED'
                      ? 'border-slate-600 bg-slate-100 text-slate-900 ring-2 ring-slate-500/15'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Đã đóng
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang lưu...'
                : mode === 'create'
                  ? 'Tạo phòng học'
                  : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
