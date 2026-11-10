import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, KeyRound, Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { classroomApi } from '../services/api';
import type { ClassroomStatus, ClassroomSummary } from '../types';
import { ClassroomCard } from '../components/ClassroomCard';
import { ClassroomFormModal } from '../components/ClassroomFormModal';
import { JoinByCodeModal } from '../components/JoinByCodeModal';
import { ConfirmModal } from '../components/ConfirmModal';

interface ClassroomsPageProps {
  mode: 'all' | 'mine';
}

export function ClassroomsPage({ mode }: ClassroomsPageProps) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClassroomStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRoom, setEditingRoom] = useState<ClassroomSummary | null>(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const [confirmRoom, setConfirmRoom] = useState<ClassroomSummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | null>(null);
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false);

  const isTeacher = user?.role === 'TEACHER';

  const loadClassrooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const data =
        mode === 'mine'
          ? await classroomApi.listMine()
          : await classroomApi.listAll({ search, status: statusFilter });
      setClassrooms(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách phòng học');
    } finally {
      setIsLoading(false);
    }
  }, [mode, search, statusFilter, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClassrooms();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadClassrooms]);

  const filteredClassrooms =
    mode === 'mine'
      ? classrooms.filter((room) => {
          const matchesSearch =
            !search.trim() ||
            room.name.toLowerCase().includes(search.trim().toLowerCase()) ||
            room.roomCode.toLowerCase().includes(search.trim().toLowerCase());
          const matchesStatus = !statusFilter || room.status === statusFilter;
          return matchesSearch && matchesStatus;
        })
      : classrooms;

  const handleFormSubmit = async (values: {
    name: string;
    description: string;
    status: ClassroomStatus;
  }) => {
    if (formMode === 'create') {
      const created = await classroomApi.create(values);
      toast.success(`Đã tạo phòng học "${created.name}" (Mã: ${created.roomCode})`);
    } else if (editingRoom) {
      const updated = await classroomApi.update(editingRoom.id, values);
      toast.success(`Đã cập nhật phòng học "${updated.name}"`);
    }
    await loadClassrooms();
  };

  const handleJoinById = async (room: ClassroomSummary) => {
    try {
      await classroomApi.joinById(room.id);
      toast.success(`Đã tham gia phòng học "${room.name}"`);
      await loadClassrooms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tham gia phòng học');
    }
  };

  const handleJoinByCode = async (roomCode: string) => {
    const joined = await classroomApi.joinByCode(roomCode);
    toast.success(`Đã tham gia phòng học "${joined.name}"`);
    navigate(`/classrooms/${joined.id}`);
  };

  const handleConfirmAction = async () => {
    if (!confirmRoom || !confirmAction) return;
    setIsConfirmSubmitting(true);
    try {
      if (confirmAction === 'delete') {
        await classroomApi.delete(confirmRoom.id);
        toast.success(`Đã xóa phòng học "${confirmRoom.name}"`);
      } else {
        await classroomApi.leave(confirmRoom.id);
        toast.success(`Đã rời khỏi phòng học "${confirmRoom.name}"`);
      }
      setConfirmRoom(null);
      setConfirmAction(null);
      await loadClassrooms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setIsConfirmSubmitting(false);
    }
  };

  const pageTitle =
    mode === 'mine'
      ? isTeacher
        ? 'Phòng học của tôi'
        : 'Phòng học đã tham gia'
      : isTeacher
        ? 'Tất cả phòng học'
        : 'Khám phá phòng học';

  const pageSubtitle =
    mode === 'mine'
      ? isTeacher
        ? 'Quản lý danh sách phòng học bạn đã tạo, chỉnh sửa hoặc theo dõi thành viên.'
        : 'Danh sách các phòng học bạn đang theo học.'
      : isTeacher
        ? 'Xem toàn bộ các phòng học hiện có trên nền tảng StudyRoom.'
        : 'Tìm kiếm phòng học phù hợp hoặc tham gia nhanh bằng mã phòng.';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{pageSubtitle}</p>
        </div>

        {isTeacher ? (
          <button
            type="button"
            onClick={() => {
              setFormMode('create');
              setEditingRoom(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <Plus className="h-4.5 w-4.5" />
            Tạo phòng học
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setJoinModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <KeyRound className="h-4.5 w-4.5" />
            Tham gia bằng mã
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên phòng hoặc mã phòng..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pr-3.5 pl-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/15"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { value: '' as const, label: 'Tất cả' },
            { value: 'ACTIVE' as const, label: 'Đang mở' },
            { value: 'CLOSED' as const, label: 'Đã đóng' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-52 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : filteredClassrooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Không tìm thấy phòng học phù hợp
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search || statusFilter
              ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'
              : isTeacher
                ? 'Hãy tạo phòng học mới để bắt đầu giảng dạy.'
                : 'Bạn có thể nhập mã phòng học hoặc xem danh sách phòng đang mở.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClassrooms.map((room) => (
            <ClassroomCard
              key={room.id}
              classroom={room}
              userRole={user?.role ?? 'STUDENT'}
              onEdit={(c) => {
                setFormMode('edit');
                setEditingRoom(c);
                setFormOpen(true);
              }}
              onDelete={(c) => {
                setConfirmRoom(c);
                setConfirmAction('delete');
              }}
              onJoin={handleJoinById}
              onLeave={(c) => {
                setConfirmRoom(c);
                setConfirmAction('leave');
              }}
            />
          ))}
        </div>
      )}

      <ClassroomFormModal
        isOpen={formOpen}
        mode={formMode}
        initialData={editingRoom}
        onSubmit={handleFormSubmit}
        onClose={() => setFormOpen(false)}
      />

      <JoinByCodeModal
        isOpen={joinModalOpen}
        onSubmit={handleJoinByCode}
        onClose={() => setJoinModalOpen(false)}
      />

      <ConfirmModal
        isOpen={Boolean(confirmRoom && confirmAction)}
        title={confirmAction === 'delete' ? 'Xóa phòng học' : 'Rời khỏi phòng học'}
        description={
          confirmAction === 'delete'
            ? `Bạn có chắc muốn xóa phòng "${confirmRoom?.name}"? Hành động này không thể hoàn tác.`
            : `Bạn có chắc muốn rời khỏi phòng học "${confirmRoom?.name}"?`
        }
        confirmLabel={confirmAction === 'delete' ? 'Xóa phòng' : 'Rời phòng'}
        isSubmitting={isConfirmSubmitting}
        onConfirm={handleConfirmAction}
        onClose={() => {
          setConfirmRoom(null);
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
