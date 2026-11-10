import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Copy,
  Edit3,
  GraduationCap,
  LogOut,
  Trash2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import type { ClassroomSummary, Role } from '../types';
import { useToast } from '../context/ToastContext';

interface ClassroomCardProps {
  classroom: ClassroomSummary;
  userRole: Role;
  onEdit?: (classroom: ClassroomSummary) => void;
  onDelete?: (classroom: ClassroomSummary) => void;
  onJoin?: (classroom: ClassroomSummary) => void;
  onLeave?: (classroom: ClassroomSummary) => void;
}

export function ClassroomCard({
  classroom,
  userRole,
  onEdit,
  onDelete,
  onJoin,
  onLeave,
}: ClassroomCardProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(classroom.roomCode);
      setCopied(true);
      toast.info(`Đã sao chép mã phòng ${classroom.roomCode}`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Không thể sao chép mã phòng');
    }
  };

  const isActive = classroom.status === 'ACTIVE';

  return (
    <article className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-indigo-200 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                  : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              {isActive ? 'Đang mở' : 'Đã đóng'}
            </span>

            {classroom.liveMeeting && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                Đang họp
                {classroom.activeMeetingParticipants > 0
                  ? ` (${classroom.activeMeetingParticipants})`
                  : ''}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            title="Sao chép mã phòng"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <span>{classroom.roomCode}</span>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <Link to={`/classrooms/${classroom.id}`} className="mt-3.5 block">
          <h3 className="line-clamp-2 text-base font-bold text-slate-900 transition group-hover:text-indigo-600">
            {classroom.name}
          </h3>
        </Link>

        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-slate-600">
          {classroom.description || 'Chưa có mô tả cho phòng học này.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <GraduationCap className="h-4 w-4 text-indigo-500" />
            {classroom.teacher.fullName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-slate-400" />
            {classroom.memberCount} học sinh
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2">
        <Link
          to={`/classrooms/${classroom.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
        >
          Xem chi tiết
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>

        <div className="flex items-center gap-1.5">
          {classroom.liveMeeting && (classroom.owner || classroom.joined) && (
            <Link
              to={`/classrooms/${classroom.id}/meeting`}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
            >
              <Video className="h-3.5 w-3.5" />
              Vào họp
            </Link>
          )}

          {userRole === 'TEACHER' && classroom.owner && (
            <>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(classroom)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Sửa
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(classroom)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              )}
            </>
          )}

          {userRole === 'STUDENT' && (
            <>
              {classroom.joined ? (
                onLeave && (
                  <button
                    type="button"
                    onClick={() => onLeave(classroom)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Rời phòng
                  </button>
                )
              ) : (
                onJoin && (
                  <button
                    type="button"
                    disabled={!isActive}
                    onClick={() => onJoin(classroom)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {isActive ? 'Tham gia' : 'Đã đóng'}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
