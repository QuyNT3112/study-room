import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Hand,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Power,
  Send,
  Users,
  Video,
  VideoOff,
  Wifi,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useMeetingRoom } from '../hooks/useMeetingRoom';
import type { MeetingParticipant } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { getInitials } from '../utils/format';

interface VideoTileProps {
  participant: MeetingParticipant;
  stream: MediaStream | null;
  isLocal: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
}

function VideoTile({ participant, stream, isLocal, isPinned, onTogglePin }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (stream) {
      void el.play().catch(() => {
        // Autoplay có thể cần tương tác người dùng trên một số trình duyệt
      });
    }
  }, [stream]);

  const hasLiveVideoTrack = Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled),
  );
  const showVideo = (participant.videoEnabled || participant.screenSharing) && hasLiveVideoTrack;
  const isTeacher = participant.role === 'TEACHER';

  return (
    <div
      className={`group relative flex h-full min-h-[210px] flex-col items-center justify-center overflow-hidden rounded-2xl border bg-slate-900 transition ${
        participant.handRaised
          ? 'border-amber-400/90 ring-2 ring-amber-400/40'
          : participant.screenSharing
            ? 'border-cyan-400/80 ring-2 ring-cyan-400/25'
            : 'border-slate-800'
      }`}
    >
      {/* Luôn giữ thẻ <video> trong DOM để luồng audio không bị ngắt khi tắt camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full transition-opacity duration-200 ${
          participant.screenSharing ? 'object-contain bg-slate-950' : 'object-cover'
        } ${isLocal && !participant.screenSharing ? '-scale-x-100' : ''} ${
          showVideo ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
        }`}
      />

      {!showVideo && (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg ${
              isTeacher ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}
          >
            {getInitials(participant.fullName)}
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-200">{participant.fullName}</p>
          <p className="mt-0.5 text-xs text-slate-400">Đang tắt camera</p>
        </div>
      )}

      {/* Top Left Status Badges */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
        {participant.screenSharing && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/90 px-2.5 py-1 text-[11px] font-semibold text-slate-950 shadow-sm">
            <MonitorUp className="h-3.5 w-3.5" />
            Đang chia sẻ màn hình
          </span>
        )}
        {participant.handRaised && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow-sm">
            <Hand className="h-3.5 w-3.5" />
            Giơ tay
          </span>
        )}
      </div>

      {/* Top Right Pin Button */}
      <button
        type="button"
        onClick={onTogglePin}
        title={isPinned ? 'Thu nhỏ khung hình' : 'Ghim khung hình lớn'}
        className="absolute top-3 right-3 rounded-lg bg-slate-950/70 p-1.5 text-slate-200 opacity-0 backdrop-blur-xs transition group-hover:opacity-100 hover:bg-slate-800"
      >
        {isPinned ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {/* Bottom Name & Mic Overlay */}
      <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-950/75 px-3 py-1.5 backdrop-blur-sm">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              isTeacher ? 'bg-indigo-400' : 'bg-emerald-400'
            }`}
          />
          <span className="truncate text-xs font-semibold text-white">
            {participant.fullName}
            {isLocal ? ' (Bạn)' : ''}
          </span>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              isTeacher ? 'bg-indigo-500/30 text-indigo-200' : 'bg-emerald-500/25 text-emerald-200'
            }`}
          >
            {isTeacher ? 'Giáo viên' : 'Học sinh'}
          </span>
        </div>

        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full backdrop-blur-sm ${
            participant.audioEnabled
              ? 'bg-slate-950/75 text-emerald-400'
              : 'bg-rose-500/90 text-white'
          }`}
          title={participant.audioEnabled ? 'Micro đang bật' : 'Micro đang tắt'}
        >
          {participant.audioEnabled ? (
            <Mic className="h-3.5 w-3.5" />
          ) : (
            <MicOff className="h-3.5 w-3.5" />
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(startedAtIso?: string): string {
  if (!startedAtIso) return '00:00';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function MeetingRoomPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [sideTab, setSideTab] = useState<'chat' | 'participants' | null>('chat');
  const [pinnedUserId, setPinnedUserId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [elapsedText, setElapsedText] = useState('00:00');

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastSeenChatLenRef = useRef(0);

  const {
    sessionInfo,
    connectionStatus,
    errorMessage,
    mediaWarning,
    participants,
    localStream,
    remoteStreams,
    chatMessages,
    audioEnabled,
    videoEnabled,
    screenSharing,
    handRaised,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleHandRaise,
    sendChatMessage,
    leaveRoom,
    endMeetingForAll,
  } = useMeetingRoom({
    classroomId: id,
    user,
    onMeetingEnded: (msg) => {
      toast.info(msg);
    },
  });

  // Cập nhật đồng hồ thời lượng cuộc họp mỗi giây
  useEffect(() => {
    if (!sessionInfo?.startedAt) return;
    setElapsedText(formatDuration(sessionInfo.startedAt));
    const timer = window.setInterval(() => {
      setElapsedText(formatDuration(sessionInfo.startedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionInfo?.startedAt]);

  // Cuộn chat & đếm tin chưa đọc khi tab chat đang đóng
  useEffect(() => {
    if (sideTab === 'chat') {
      setUnreadChatCount(0);
      lastSeenChatLenRef.current = chatMessages.length;
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (chatMessages.length > lastSeenChatLenRef.current) {
      setUnreadChatCount((prev) => prev + (chatMessages.length - lastSeenChatLenRef.current));
      lastSeenChatLenRef.current = chatMessages.length;
    }
  }, [chatMessages.length, sideTab]);

  // Tự động ưu tiên hiển thị người đang chia sẻ màn hình nếu chưa ghim thủ công
  const activeScreenSharer = useMemo(
    () => participants.find((p) => p.screenSharing) || null,
    [participants],
  );

  const effectivePinnedId = pinnedUserId ?? activeScreenSharer?.userId ?? null;
  const pinnedParticipant = useMemo(
    () => participants.find((p) => p.userId === effectivePinnedId) || null,
    [participants, effectivePinnedId],
  );
  const unpinnedParticipants = useMemo(
    () =>
      pinnedParticipant
        ? participants.filter((p) => p.userId !== pinnedParticipant.userId)
        : participants,
    [participants, pinnedParticipant],
  );

  const handleCopyMeetingCode = async () => {
    if (!sessionInfo) return;
    try {
      await navigator.clipboard.writeText(sessionInfo.meetingCode);
      setCopiedCode(true);
      toast.info(`Đã sao chép mã buổi họp ${sessionInfo.meetingCode}`);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      toast.error('Không thể sao chép mã buổi họp');
    }
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const handleLeave = () => {
    leaveRoom();
    navigate(`/classrooms/${id}`, { replace: true });
  };

  const handleConfirmEndMeeting = async () => {
    setIsEndingMeeting(true);
    try {
      await endMeetingForAll();
      toast.success('Đã kết thúc buổi họp trực tuyến');
      navigate(`/classrooms/${id}`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể kết thúc buổi họp');
    } finally {
      setIsEndingMeeting(false);
      setEndConfirmOpen(false);
    }
  };

  if (connectionStatus === 'ended' || connectionStatus === 'replaced' || connectionStatus === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
            <VideoOff className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-xl font-bold text-white">
            {connectionStatus === 'ended'
              ? 'Buổi họp đã kết thúc'
              : connectionStatus === 'replaced'
                ? 'Phiên họp đã chuyển sang cửa sổ khác'
                : 'Không thể kết nối phòng họp'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {errorMessage || 'Kết nối tới phòng họp trực tuyến đã đóng.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/classrooms/${id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại phòng học
            </Link>
            {connectionStatus === 'error' && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Thử kết nối lại
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const gridColsClass =
    participants.length <= 1
      ? 'grid-cols-1 max-w-4xl mx-auto'
      : participants.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : participants.length <= 4
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-900/95 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Lớp học
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[11px] font-bold text-rose-400 ring-1 ring-rose-500/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                LIVE · {elapsedText}
              </span>
              <h1 className="font-display truncate text-sm font-bold text-white sm:text-base">
                {sessionInfo?.title || 'Phòng họp trực tuyến'}
              </h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {sessionInfo?.classroomName} · Mã lớp: {sessionInfo?.roomCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessionInfo?.meetingCode && (
            <button
              type="button"
              onClick={handleCopyMeetingCode}
              className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-300 transition hover:border-indigo-500/60 hover:text-white sm:inline-flex"
            >
              <span>{sessionInfo.meetingCode}</span>
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            <Wifi className="h-3.5 w-3.5" />
            {connectionStatus === 'connected' ? 'Đã kết nối' : 'Đang kết nối...'}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            {participants.length}
          </span>
        </div>
      </header>

      {/* Media Warning Banner */}
      {mediaWarning && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 sm:px-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{mediaWarning}</span>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Video Stage */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-3 sm:p-5">
          {participants.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-slate-300">
                Đang tham gia phòng họp trực tuyến...
              </p>
            </div>
          ) : pinnedParticipant ? (
            <div className="flex flex-1 flex-col gap-3 lg:flex-row">
              <div className="min-h-[300px] flex-1">
                <VideoTile
                  participant={pinnedParticipant}
                  stream={
                    pinnedParticipant.userId === user?.id
                      ? localStream
                      : remoteStreams[pinnedParticipant.userId] || null
                  }
                  isLocal={pinnedParticipant.userId === user?.id}
                  isPinned
                  onTogglePin={() => setPinnedUserId(null)}
                />
              </div>

              {unpinnedParticipants.length > 0 && (
                <div className="grid shrink-0 grid-cols-2 gap-3 lg:flex lg:w-64 lg:flex-col lg:overflow-y-auto">
                  {unpinnedParticipants.map((participant) => (
                    <div key={participant.userId} className="h-44 shrink-0">
                      <VideoTile
                        participant={participant}
                        stream={
                          participant.userId === user?.id
                            ? localStream
                            : remoteStreams[participant.userId] || null
                        }
                        isLocal={participant.userId === user?.id}
                        isPinned={false}
                        onTogglePin={() => setPinnedUserId(participant.userId)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`grid w-full flex-1 auto-rows-fr gap-3 sm:gap-4 ${gridColsClass}`}>
              {participants.map((participant) => (
                <VideoTile
                  key={participant.userId}
                  participant={participant}
                  stream={
                    participant.userId === user?.id
                      ? localStream
                      : remoteStreams[participant.userId] || null
                  }
                  isLocal={participant.userId === user?.id}
                  isPinned={false}
                  onTogglePin={() => setPinnedUserId(participant.userId)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Side Drawer: Chat & Participants */}
        {sideTab && (
          <aside className="flex w-full shrink-0 flex-col border-l border-slate-800 bg-slate-900 sm:w-84 lg:w-96">
            <div className="flex border-b border-slate-800 p-2">
              <button
                type="button"
                onClick={() => setSideTab('chat')}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                  sideTab === 'chat'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                Trò chuyện ({chatMessages.length})
              </button>
              <button
                type="button"
                onClick={() => setSideTab('participants')}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                  sideTab === 'participants'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                Thành viên ({participants.length})
              </button>
            </div>

            {sideTab === 'chat' ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {chatMessages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Chưa có tin nhắn nào. Hãy gửi lời chào tới mọi người trong lớp!
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isSelf = msg.senderId === user?.id;
                      const timeStr = new Date(msg.sentAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                        >
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">
                              {isSelf ? 'Bạn' : msg.senderName}
                            </span>
                            {msg.senderRole === 'TEACHER' && (
                              <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-300">
                                GV
                              </span>
                            )}
                            <span>{timeStr}</span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
                              isSelf
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-100'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendChat} className="border-t border-slate-800 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Nhập tin nhắn trong buổi họp..."
                      maxLength={1000}
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="inline-flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Gửi tin nhắn"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 divide-y divide-slate-800/80 overflow-y-auto p-3">
                {participants.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                          p.role === 'TEACHER' ? 'bg-indigo-600' : 'bg-emerald-600'
                        }`}
                      >
                        {getInitials(p.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {p.fullName}
                          {p.userId === user?.id ? ' (Bạn)' : ''}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {p.role === 'TEACHER' ? 'Giáo viên chủ trì' : 'Học sinh'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {p.handRaised && (
                        <span className="rounded-lg bg-amber-400/20 p-1.5 text-amber-400" title="Đang giơ tay">
                          <Hand className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {p.screenSharing && (
                        <span className="rounded-lg bg-cyan-400/20 p-1.5 text-cyan-300" title="Đang chia sẻ màn hình">
                          <MonitorUp className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span
                        className={`rounded-lg p-1.5 ${
                          p.audioEnabled ? 'bg-slate-800 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {p.audioEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                      </span>
                      <span
                        className={`rounded-lg p-1.5 ${
                          p.videoEnabled ? 'bg-slate-800 text-emerald-400' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {p.videoEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <footer className="flex shrink-0 flex-wrap items-center justify-center gap-2.5 border-t border-slate-800/90 bg-slate-900/95 px-4 py-3 sm:gap-3">
        <button
          type="button"
          onClick={() => void toggleAudio()}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:text-sm ${
            audioEnabled
              ? 'bg-slate-800 text-white hover:bg-slate-700'
              : 'bg-rose-600 text-white hover:bg-rose-500'
          }`}
        >
          {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{audioEnabled ? 'Tắt mic' : 'Bật mic'}</span>
        </button>

        <button
          type="button"
          onClick={() => void toggleVideo()}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:text-sm ${
            videoEnabled
              ? 'bg-slate-800 text-white hover:bg-slate-700'
              : 'bg-rose-600 text-white hover:bg-rose-500'
          }`}
        >
          {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{videoEnabled ? 'Tắt camera' : 'Bật camera'}</span>
        </button>

        <button
          type="button"
          onClick={() => void toggleScreenShare()}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:text-sm ${
            screenSharing
              ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
        >
          {screenSharing ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          <span className="hidden md:inline">
            {screenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleHandRaise}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:text-sm ${
            handRaised
              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
              : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
        >
          <Hand className="h-4 w-4" />
          <span className="hidden md:inline">{handRaised ? 'Hạ tay' : 'Giơ tay'}</span>
        </button>

        <div className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

        <button
          type="button"
          onClick={() => setSideTab((prev) => (prev === 'chat' ? null : 'chat'))}
          className={`relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition sm:text-sm ${
            sideTab === 'chat'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Chat</span>
          {unreadChatCount > 0 && sideTab !== 'chat' && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unreadChatCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSideTab((prev) => (prev === 'participants' ? null : 'participants'))}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition sm:text-sm ${
            sideTab === 'participants'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Thành viên ({participants.length})</span>
        </button>

        <div className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

        <button
          type="button"
          onClick={handleLeave}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-500 sm:text-sm"
        >
          <PhoneOff className="h-4 w-4" />
          <span>Rời họp</span>
        </button>

        {sessionInfo?.canManage && (
          <button
            type="button"
            onClick={() => setEndConfirmOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-900 sm:text-sm"
          >
            <Power className="h-4 w-4" />
            <span className="hidden sm:inline">Kết thúc cho tất cả</span>
          </button>
        )}
      </footer>

      <ConfirmModal
        isOpen={endConfirmOpen}
        title="Kết thúc buổi họp trực tuyến"
        description="Khi kết thúc, toàn bộ thành viên đang tham gia trong phòng họp sẽ bị ngắt kết nối và phiên họp sẽ được lưu vào lịch sử."
        confirmLabel="Kết thúc buổi họp"
        isSubmitting={isEndingMeeting}
        onConfirm={() => void handleConfirmEndMeeting()}
        onClose={() => setEndConfirmOpen(false)}
      />
    </div>
  );
}
