import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Compass,
  KeyRound,
  Mail,
  Plus,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { classroomApi, dashboardApi, meetingApi } from '../services/api';
import type {
  ClassroomStatus,
  ClassroomSummary,
  MeetingSession,
  StudentDashboard,
  TeacherDashboard,
} from '../types';
import { ClassroomCard } from '../components/ClassroomCard';
import { ClassroomFormModal } from '../components/ClassroomFormModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDate, getInitials } from '../utils/format';

export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [teacherData, setTeacherData] = useState<TeacherDashboard | null>(null);
  const [studentData, setStudentData] = useState<StudentDashboard | null>(null);
  const [liveMeetings, setLiveMeetings] = useState<MeetingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRoom, setEditingRoom] = useState<ClassroomSummary | null>(null);
  const [confirmRoom, setConfirmRoom] = useState<ClassroomSummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | null>(null);
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false);

  const [quickRoomCode, setQuickRoomCode] = useState('');
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);

  const isTeacher = user?.role === 'TEACHER';

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [liveList] = await Promise.all([
        meetingApi.listLive().catch(() => [] as MeetingSession[]),
        user.role === 'TEACHER'
          ? dashboardApi.teacher().then(setTeacherData)
          : dashboardApi.student().then(setStudentData),
      ]);
      setLiveMeetings(liveList);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
    await loadDashboard();
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
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setIsConfirmSubmitting(false);
    }
  };

  const handleQuickJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    const code = quickRoomCode.trim().toUpperCase();
    if (code.length < 4) {
      toast.error('Vui lòng nhập mã phòng hợp lệ');
      return;
    }

    setIsJoiningByCode(true);
    try {
      const joined = await classroomApi.joinByCode(code);
      toast.success(`Đã tham gia phòng học "${joined.name}"`);
      setQuickRoomCode('');
      navigate(`/classrooms/${joined.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tham gia phòng học');
    } finally {
      setIsJoiningByCode(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-48 animate-pulse rounded-2xl bg-white" />
          <div className="h-48 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Xin chào, {user?.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isTeacher
              ? 'Tổng quan các phòng học và học sinh bạn đang phụ trách.'
              : 'Theo dõi các phòng học đã tham gia và thông tin tài khoản của bạn.'}
          </p>
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
            Tạo phòng học mới
          </button>
        ) : (
          <Link
            to="/classrooms"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <Compass className="h-4.5 w-4.5" />
            Khám phá phòng học
          </Link>
        )}
      </div>

      {/* LIVE MEETINGS BANNER */}
      {liveMeetings.length > 0 && (
        <section className="rounded-2xl border border-rose-200/90 bg-gradient-to-r from-rose-50 via-white to-indigo-50/70 p-5 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
            Buổi họp trực tuyến đang diễn ra ({liveMeetings.length})
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {liveMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{meeting.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    Lớp: {meeting.classroomName} · {meeting.participantCount} người đang tham gia
                  </p>
                </div>
                <Link
                  to={`/classrooms/${meeting.classroomId}/meeting`}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                >
                  <Video className="h-3.5 w-3.5" />
                  Tham gia ngay
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TEACHER DASHBOARD */}
      {isTeacher && teacherData && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Tổng số phòng học đã tạo</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <BookOpen className="h-5 w-5" />
                </div>
              </div>
              <p className="font-display mt-3 text-3xl font-extrabold text-slate-900">
                {teacherData.totalClassrooms}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {teacherData.activeClassrooms} phòng đang hoạt động
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Tổng số học sinh</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <p className="font-display mt-3 text-3xl font-extrabold text-slate-900">
                {teacherData.totalStudents}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {teacherData.totalEnrollments} lượt ghi danh vào các lớp
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Phòng đang mở</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <p className="font-display mt-3 text-3xl font-extrabold text-slate-900">
                {teacherData.activeClassrooms}
              </p>
              <p className="mt-1 text-xs text-slate-500">Sẵn sàng tiếp nhận học sinh mới</p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Phòng học gần đây</h2>
              <Link
                to="/my-classrooms"
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Xem tất cả
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {teacherData.recentClassrooms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Bạn chưa tạo phòng học nào
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Tạo phòng học đầu tiên để cấp mã phòng cho học sinh tham gia.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFormMode('create');
                    setEditingRoom(null);
                    setFormOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Tạo phòng học
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teacherData.recentClassrooms.map((room) => (
                  <ClassroomCard
                    key={room.id}
                    classroom={room}
                    userRole="TEACHER"
                    onEdit={(c) => {
                      setFormMode('edit');
                      setEditingRoom(c);
                      setFormOpen(true);
                    }}
                    onDelete={(c) => {
                      setConfirmRoom(c);
                      setConfirmAction('delete');
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* STUDENT DASHBOARD */}
      {!isTeacher && studentData && (
        <>
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Joined count + Quick Join by Code */}
            <div className="flex flex-col justify-between gap-5 lg:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">
                      Tổng số phòng đã tham gia
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="font-display mt-3 text-3xl font-extrabold text-slate-900">
                    {studentData.totalJoinedClassrooms}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Phòng học hiện có trong danh sách của bạn
                  </p>
                </div>

                <form
                  onSubmit={handleQuickJoinByCode}
                  className="flex flex-col justify-between rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 to-white p-5 shadow-2xs"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
                    <KeyRound className="h-4.5 w-4.5 text-indigo-600" />
                    Tham gia nhanh bằng mã phòng
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={quickRoomCode}
                      onChange={(e) => setQuickRoomCode(e.target.value.toUpperCase())}
                      placeholder="Nhập mã (VD: JAVA25)"
                      maxLength={12}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-semibold tracking-wider text-slate-900 uppercase outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15"
                    />
                    <button
                      type="submit"
                      disabled={isJoiningByCode}
                      className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isJoiningByCode ? '...' : 'Vào lớp'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Account Info Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white">
                  {getInitials(studentData.account.fullName)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-slate-900">
                    {studentData.account.fullName}
                  </h2>
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Học sinh
                  </span>
                </div>
              </div>

              <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-3.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{studentData.account.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>Ngày tham gia: {formatDate(studentData.account.createdAt)}</span>
                </div>
              </dl>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Phòng học của mình</h2>
              <Link
                to="/my-classrooms"
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Xem tất cả
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {studentData.myClassrooms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <Compass className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Bạn chưa tham gia phòng học nào
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Nhập mã phòng ở trên hoặc khám phá danh sách phòng học đang mở.
                </p>
                <Link
                  to="/classrooms"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Khám phá phòng học
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {studentData.myClassrooms.map((room) => (
                  <ClassroomCard
                    key={room.id}
                    classroom={room}
                    userRole="STUDENT"
                    onLeave={(c) => {
                      setConfirmRoom(c);
                      setConfirmAction('leave');
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ClassroomFormModal
        isOpen={formOpen}
        mode={formMode}
        initialData={editingRoom}
        onSubmit={handleFormSubmit}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmModal
        isOpen={Boolean(confirmRoom && confirmAction)}
        title={confirmAction === 'delete' ? 'Xóa phòng học' : 'Rời khỏi phòng học'}
        description={
          confirmAction === 'delete'
            ? `Bạn có chắc muốn xóa phòng "${confirmRoom?.name}"? Toàn bộ dữ liệu tham gia của học sinh trong phòng này cũng sẽ bị xóa.`
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
