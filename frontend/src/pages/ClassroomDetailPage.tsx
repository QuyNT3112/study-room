import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  Edit3,
  GraduationCap,
  History,
  LogOut,
  Mail,
  Power,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { classroomApi, meetingApi } from '../services/api';
import type { ClassroomDetail, ClassroomStatus, MeetingOverview } from '../types';
import { ClassroomFormModal } from '../components/ClassroomFormModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDateTime, getInitials } from '../utils/format';

export function ClassroomDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [meetingOverview, setMeetingOverview] = useState<MeetingOverview | null>(null);
  const [meetingTitleInput, setMeetingTitleInput] = useState('');
  const [isMeetingBusy, setIsMeetingBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | 'endMeeting' | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const loadMeetingOverview = useCallback(async (roomId: number | string) => {
    try {
      const overview = await meetingApi.getOverview(roomId);
      setMeetingOverview(overview);
    } catch {
      setMeetingOverview(null);
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await classroomApi.getDetail(id);
      setClassroom(data);
      if (data.owner || data.joined) {
        await loadMeetingOverview(data.id);
      } else {
        setMeetingOverview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải thông tin phòng học');
    } finally {
      setIsLoading(false);
    }
  }, [id, loadMeetingOverview]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleCopyCode = async () => {
    if (!classroom) return;
    try {
      await navigator.clipboard.writeText(classroom.roomCode);
      setCopied(true);
      toast.info(`Đã sao chép mã phòng ${classroom.roomCode}`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Không thể sao chép mã phòng');
    }
  };

  const handleEditSubmit = async (values: {
    name: string;
    description: string;
    status: ClassroomStatus;
  }) => {
    if (!classroom) return;
    const updated = await classroomApi.update(classroom.id, values);
    setClassroom(updated);
    toast.success('Đã cập nhật thông tin phòng học');
  };

  const handleJoin = async () => {
    if (!classroom) return;
    setIsActionSubmitting(true);
    try {
      const updated = await classroomApi.joinById(classroom.id);
      setClassroom(updated);
      await loadMeetingOverview(updated.id);
      toast.success(`Đã tham gia phòng học "${classroom.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tham gia phòng học');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleStartMeeting = async () => {
    if (!classroom) return;
    setIsMeetingBusy(true);
    try {
      await meetingApi.start(classroom.id, meetingTitleInput);
      toast.success('Đã mở phòng họp trực tuyến');
      navigate(`/classrooms/${classroom.id}/meeting`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể bắt đầu buổi họp');
    } finally {
      setIsMeetingBusy(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!classroom || !confirmAction) return;
    setIsActionSubmitting(true);
    try {
      if (confirmAction === 'delete') {
        await classroomApi.delete(classroom.id);
        toast.success(`Đã xóa phòng học "${classroom.name}"`);
        navigate('/my-classrooms', { replace: true });
      } else if (confirmAction === 'endMeeting') {
        await meetingApi.end(classroom.id);
        toast.success('Đã kết thúc buổi họp trực tuyến');
        setConfirmAction(null);
        await loadDetail();
      } else {
        await classroomApi.leave(classroom.id);
        toast.success(`Đã rời khỏi phòng học "${classroom.name}"`);
        setConfirmAction(null);
        await loadDetail();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-2xl bg-white" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl bg-white lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (error || !classroom) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-lg font-bold text-slate-900">Không thể hiển thị phòng học</h2>
        <p className="mt-2 text-sm text-slate-600">{error || 'Phòng học không tồn tại.'}</p>
        <Link
          to="/classrooms"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách phòng học
        </Link>
      </div>
    );
  }

  const isActive = classroom.status === 'ACTIVE';
  const isTeacher = user?.role === 'TEACHER';

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/classrooms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách phòng học
        </Link>
      </div>

      {/* Hero Info Card */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs sm:p-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                />
                {isActive ? 'Đang hoạt động' : 'Đã đóng'}
              </span>

              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1 font-mono text-xs font-bold tracking-wider text-indigo-700 transition hover:bg-indigo-100"
              >
                Mã phòng: {classroom.roomCode}
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {classroom.name}
            </h1>

            <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-line text-slate-600">
              {classroom.description || 'Phòng học này chưa có mô tả chi tiết.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {isTeacher && classroom.owner && (
              <>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Edit3 className="h-4 w-4" />
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('delete')}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa phòng
                </button>
              </>
            )}

            {!isTeacher && (
              <>
                {classroom.joined ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={() => setConfirmAction('leave')}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" />
                    Rời khỏi phòng học
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!isActive || isActionSubmitting}
                    onClick={handleJoin}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <UserPlus className="h-4 w-4" />
                    {isActive ? 'Tham gia phòng học' : 'Phòng học đã đóng'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Online Meeting Section */}
      <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Video className="h-4.5 w-4.5" />
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Họp trực tuyến (Online Meeting)
              </h2>
              {meetingOverview?.active || classroom.liveMeeting ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                  Đang diễn ra
                  {(meetingOverview?.currentSession?.participantCount ??
                    classroom.activeMeetingParticipants) > 0 &&
                    ` · ${
                      meetingOverview?.currentSession?.participantCount ??
                      classroom.activeMeetingParticipants
                    } người đang họp`}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Chưa có buổi họp
                </span>
              )}
            </div>

            {meetingOverview?.active && meetingOverview.currentSession ? (
              <p className="text-sm text-slate-600">
                Chủ đề:{' '}
                <span className="font-semibold text-slate-900">
                  {meetingOverview.currentSession.title}
                </span>{' '}
                · Mã họp:{' '}
                <span className="font-mono font-semibold text-indigo-700">
                  {meetingOverview.currentSession.meetingCode}
                </span>{' '}
                · Bắt đầu lúc {formatDateTime(meetingOverview.currentSession.startedAt)}
              </p>
            ) : classroom.owner ? (
              <p className="text-sm text-slate-600">
                Mở phòng họp video/audio, chia sẻ màn hình và trao đổi chat trực tiếp với học sinh trong lớp.
              </p>
            ) : classroom.joined ? (
              <p className="text-sm text-slate-600">
                Khi giáo viên bắt đầu buổi họp trực tuyến, nút tham gia phòng họp sẽ hiển thị ngay tại đây.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Bạn cần tham gia phòng học này trước để có thể vào buổi họp trực tuyến cùng lớp.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {classroom.owner && (
              <>
                {meetingOverview?.active ? (
                  <>
                    <Link
                      to={`/classrooms/${classroom.id}/meeting`}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
                    >
                      <Video className="h-4 w-4" />
                      Vào phòng họp ngay
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmAction('endMeeting')}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Power className="h-4 w-4" />
                      Kết thúc họp
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={meetingTitleInput}
                      onChange={(e) => setMeetingTitleInput(e.target.value)}
                      placeholder="Tên buổi họp (tùy chọn)..."
                      maxLength={180}
                      disabled={!isActive || isMeetingBusy}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15 sm:w-60"
                    />
                    <button
                      type="button"
                      disabled={!isActive || isMeetingBusy}
                      onClick={() => void handleStartMeeting()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      <Video className="h-4 w-4" />
                      {isMeetingBusy
                        ? 'Đang mở...'
                        : isActive
                          ? 'Bắt đầu họp online'
                          : 'Phòng học đã đóng'}
                    </button>
                  </div>
                )}
              </>
            )}

            {!isTeacher && classroom.joined && (
              <>
                {meetingOverview?.active ? (
                  <Link
                    to={`/classrooms/${classroom.id}/meeting`}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
                  >
                    <Video className="h-4 w-4" />
                    Tham gia họp online
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void loadMeetingOverview(classroom.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Kiểm tra lại buổi họp
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {meetingOverview && meetingOverview.recentSessions.length > 0 && (
          <div className="mt-5 border-t border-indigo-100 pt-4">
            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-500 uppercase">
              <History className="h-3.5 w-3.5" />
              Lịch sử buổi họp gần đây
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {meetingOverview.recentSessions.slice(0, 3).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{session.title}</p>
                    <p className="mt-0.5 text-slate-500">
                      {formatDateTime(session.startedAt)}
                      {session.endedAt ? ` → ${formatDateTime(session.endedAt)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      session.status === 'LIVE'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {session.status === 'LIVE' ? 'Đang mở' : 'Đã kết thúc'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Students List */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-indigo-600" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Danh sách học sinh tham gia
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {classroom.memberCount} thành viên
            </span>
          </div>

          {classroom.members.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Chưa có học sinh nào tham gia phòng học này
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Chia sẻ mã phòng <span className="font-mono font-bold">{classroom.roomCode}</span>{' '}
                để học sinh tham gia lớp.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {classroom.members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col justify-between gap-2 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                      {getInitials(member.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {member.fullName}
                        {member.id === user?.id && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Bạn
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    Tham gia: {formatDateTime(member.enrolledAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Teacher & Metadata Sidebar */}
        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h2 className="font-display text-base font-bold text-slate-900">Thông tin giáo viên</h2>
            <div className="mt-4 flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white">
                {getInitials(classroom.teacher.fullName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {classroom.teacher.fullName}
                </p>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Giáo viên phụ trách
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3.5 text-xs text-slate-600">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="truncate">{classroom.teacher.email}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h2 className="font-display text-base font-bold text-slate-900">Thông số phòng học</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd className="font-semibold text-slate-900">
                  {isActive ? 'Đang hoạt động' : 'Đã đóng'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Số lượng thành viên</dt>
                <dd className="font-semibold text-slate-900">
                  {classroom.memberCount} học sinh (+1 giáo viên)
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-1.5 text-slate-500">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Ngày tạo
                </dt>
                <dd className="text-xs font-medium text-slate-700">
                  {formatDateTime(classroom.createdAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Cập nhật
                </dt>
                <dd className="text-xs font-medium text-slate-700">
                  {formatDateTime(classroom.updatedAt)}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <ClassroomFormModal
        isOpen={editOpen}
        mode="edit"
        initialData={classroom}
        onSubmit={handleEditSubmit}
        onClose={() => setEditOpen(false)}
      />

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={
          confirmAction === 'delete'
            ? 'Xóa phòng học'
            : confirmAction === 'endMeeting'
              ? 'Kết thúc buổi họp trực tuyến'
              : 'Rời khỏi phòng học'
        }
        description={
          confirmAction === 'delete'
            ? `Bạn có chắc muốn xóa phòng "${classroom.name}"? Hành động này không thể hoàn tác.`
            : confirmAction === 'endMeeting'
              ? `Bạn có chắc muốn kết thúc buổi họp đang diễn ra trong phòng "${classroom.name}"? Toàn bộ thành viên đang họp sẽ bị ngắt kết nối.`
              : `Bạn có chắc muốn rời khỏi phòng học "${classroom.name}"?`
        }
        confirmLabel={
          confirmAction === 'delete'
            ? 'Xóa phòng'
            : confirmAction === 'endMeeting'
              ? 'Kết thúc họp'
              : 'Rời phòng'
        }
        isSubmitting={isActionSubmitting}
        onConfirm={handleConfirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}
