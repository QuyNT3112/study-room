import { useCallback, useEffect, useRef, useState } from 'react';
import { getMeetingWsUrl, meetingApi } from '../services/api';
import type { MeetingChatMessage, MeetingParticipant, MeetingSession, User } from '../types';

export type MeetingConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'replaced'
  | 'error';

interface PeerEntry {
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  remoteStream: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface UseMeetingRoomOptions {
  classroomId: string | undefined;
  user: User | null;
  onMeetingEnded?: (message: string) => void;
}

export function useMeetingRoom({ classroomId, user, onMeetingEnded }: UseMeetingRoomOptions) {
  const [sessionInfo, setSessionInfo] = useState<MeetingSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<MeetingConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);

  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<number, PeerEntry>>(new Map());
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const disposedRef = useRef(false);

  const audioEnabledRef = useRef(false);
  const videoEnabledRef = useRef(false);
  const screenSharingRef = useRef(false);
  const handRaisedRef = useRef(false);

  const onMeetingEndedRef = useRef(onMeetingEnded);
  onMeetingEndedRef.current = onMeetingEnded;

  const rebuildLocalPreviewStream = useCallback(() => {
    const tracks: MediaStreamTrack[] = [];
    if (localAudioTrackRef.current && localAudioTrackRef.current.readyState === 'live') {
      tracks.push(localAudioTrackRef.current);
    }
    const activeVideo =
      screenTrackRef.current && screenTrackRef.current.readyState === 'live'
        ? screenTrackRef.current
        : localVideoTrackRef.current && localVideoTrackRef.current.readyState === 'live'
          ? localVideoTrackRef.current
          : null;
    if (activeVideo) {
      tracks.push(activeVideo);
    }
    setLocalStream(tracks.length > 0 ? new MediaStream(tracks) : null);
  }, []);

  const sendWs = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const syncMediaState = useCallback(
    (overrides?: {
      audio?: boolean;
      video?: boolean;
      screen?: boolean;
      hand?: boolean;
    }) => {
      const nextAudio = overrides?.audio ?? audioEnabledRef.current;
      const nextVideo = overrides?.video ?? videoEnabledRef.current;
      const nextScreen = overrides?.screen ?? screenSharingRef.current;
      const nextHand = overrides?.hand ?? handRaisedRef.current;

      audioEnabledRef.current = nextAudio;
      videoEnabledRef.current = nextVideo;
      screenSharingRef.current = nextScreen;
      handRaisedRef.current = nextHand;

      setAudioEnabled(nextAudio);
      setVideoEnabled(nextVideo);
      setScreenSharing(nextScreen);
      setHandRaised(nextHand);

      sendWs({
        type: 'MEDIA_STATE',
        audioEnabled: nextAudio,
        videoEnabled: nextVideo,
        screenSharing: nextScreen,
        handRaised: nextHand,
      });
    },
    [sendWs],
  );

  const closePeer = useCallback((peerId: number) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.close();
    peersRef.current.delete(peerId);
    setRemoteStreams((prev) => {
      if (!(peerId in prev)) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  }, []);

  const createPeerConnection = useCallback(
    (peerId: number): PeerEntry => {
      const existing = peersRef.current.get(peerId);
      if (existing) {
        return existing;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const remoteStream = new MediaStream();

      const activeAudio =
        localAudioTrackRef.current && localAudioTrackRef.current.readyState === 'live'
          ? localAudioTrackRef.current
          : null;
      const activeVideo =
        screenTrackRef.current && screenTrackRef.current.readyState === 'live'
          ? screenTrackRef.current
          : localVideoTrackRef.current && localVideoTrackRef.current.readyState === 'live'
            ? localVideoTrackRef.current
            : null;

      const audioTransceiver = pc.addTransceiver(activeAudio ?? 'audio', {
        direction: 'sendrecv',
      });
      const videoTransceiver = pc.addTransceiver(activeVideo ?? 'video', {
        direction: 'sendrecv',
      });

      const entry: PeerEntry = {
        pc,
        audioSender: audioTransceiver.sender,
        videoSender: videoTransceiver.sender,
        remoteStream,
        pendingCandidates: [],
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWs({
            type: 'ICE_CANDIDATE',
            targetUserId: peerId,
            payload: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const track = event.track;
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: new MediaStream(remoteStream.getTracks()),
        }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          closePeer(peerId);
        }
      };

      peersRef.current.set(peerId, entry);
      return entry;
    },
    [closePeer, sendWs],
  );

  const sendOfferToPeer = useCallback(
    async (peerId: number) => {
      try {
        const entry = createPeerConnection(peerId);
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        sendWs({
          type: 'OFFER',
          targetUserId: peerId,
          payload: entry.pc.localDescription,
        });
      } catch (err) {
        console.warn(`Failed to create WebRTC offer for peer ${peerId}:`, err);
      }
    },
    [createPeerConnection, sendWs],
  );

  const handleOfferFromPeer = useCallback(
    async (peerId: number, sdp: RTCSessionDescriptionInit) => {
      try {
        const entry = createPeerConnection(peerId);
        await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        while (entry.pendingCandidates.length > 0) {
          const candidate = entry.pendingCandidates.shift();
          if (candidate) {
            await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        sendWs({
          type: 'ANSWER',
          targetUserId: peerId,
          payload: entry.pc.localDescription,
        });
      } catch (err) {
        console.warn(`Failed to handle WebRTC offer from peer ${peerId}:`, err);
      }
    },
    [createPeerConnection, sendWs],
  );

  const handleAnswerFromPeer = useCallback(async (peerId: number, sdp: RTCSessionDescriptionInit) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      while (entry.pendingCandidates.length > 0) {
        const candidate = entry.pendingCandidates.shift();
        if (candidate) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (err) {
      console.warn(`Failed to apply WebRTC answer from peer ${peerId}:`, err);
    }
  }, []);

  const handleIceCandidateFromPeer = useCallback(
    async (peerId: number, candidate: RTCIceCandidateInit) => {
      const entry = peersRef.current.get(peerId);
      if (!entry) return;
      try {
        if (entry.pc.remoteDescription) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          entry.pendingCandidates.push(candidate);
        }
      } catch (err) {
        console.warn(`Failed to add ICE candidate from peer ${peerId}:`, err);
      }
    },
    [],
  );

  const replaceTrackForAllPeers = useCallback(
    async (kind: 'audio' | 'video', track: MediaStreamTrack | null) => {
      const promises: Promise<void>[] = [];
      peersRef.current.forEach((entry) => {
        const sender = kind === 'audio' ? entry.audioSender : entry.videoSender;
        if (sender) {
          promises.push(sender.replaceTrack(track));
        }
      });
      await Promise.allSettled(promises);
    },
    [],
  );

  const cleanupAllResources = useCallback(() => {
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }

    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }

    Array.from(peersRef.current.keys()).forEach((peerId) => closePeer(peerId));

    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    setLocalStream(null);
  }, [closePeer]);

  useEffect(() => {
    if (!classroomId || !user) return;
    disposedRef.current = false;

    const init = async () => {
      setConnectionStatus('connecting');
      setErrorMessage(null);
      setMediaWarning(null);

      // 1. Kiểm tra trạng thái buổi họp qua REST API
      let overview;
      try {
        overview = await meetingApi.getOverview(classroomId);
      } catch (err) {
        if (disposedRef.current) return;
        setConnectionStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Không thể tải thông tin buổi họp');
        return;
      }

      if (disposedRef.current) return;
      if (!overview.active || !overview.currentSession) {
        setConnectionStatus('ended');
        setErrorMessage('Hiện chưa có buổi họp trực tuyến nào đang mở trong phòng học này.');
        return;
      }

      setSessionInfo(overview.currentSession);

      // 2. Yêu cầu quyền micro/camera (tự động fallback nếu máy không có thiết bị hoặc bị từ chối)
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const avStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          if (disposedRef.current) {
            avStream.getTracks().forEach((t) => t.stop());
            return;
          }
          localAudioTrackRef.current = avStream.getAudioTracks()[0] ?? null;
          localVideoTrackRef.current = avStream.getVideoTracks()[0] ?? null;
          audioEnabledRef.current = Boolean(localAudioTrackRef.current);
          videoEnabledRef.current = Boolean(localVideoTrackRef.current);
          setAudioEnabled(audioEnabledRef.current);
          setVideoEnabled(videoEnabledRef.current);
          rebuildLocalPreviewStream();
        } catch {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (disposedRef.current) {
              audioOnly.getTracks().forEach((t) => t.stop());
              return;
            }
            localAudioTrackRef.current = audioOnly.getAudioTracks()[0] ?? null;
            audioEnabledRef.current = Boolean(localAudioTrackRef.current);
            videoEnabledRef.current = false;
            setAudioEnabled(audioEnabledRef.current);
            setVideoEnabled(false);
            setMediaWarning('Không tìm thấy camera hoặc quyền camera bị tắt — bạn đang tham gia bằng chế độ âm thanh.');
            rebuildLocalPreviewStream();
          } catch {
            if (disposedRef.current) return;
            audioEnabledRef.current = false;
            videoEnabledRef.current = false;
            setAudioEnabled(false);
            setVideoEnabled(false);
            setMediaWarning(
              'Không thể truy cập micro/camera — bạn vẫn có thể nghe, xem màn hình và chat trong buổi họp.',
            );
          }
        }
      } else {
        setMediaWarning('Trình duyệt không hỗ trợ thiết bị media — đang tham gia ở chế độ xem & chat.');
      }

      if (disposedRef.current) return;

      // 3. Kết nối WebSocket Signaling
      const ws = new WebSocket(getMeetingWsUrl(classroomId));
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposedRef.current) {
          ws.close();
          return;
        }
        setConnectionStatus('connected');
        syncMediaState({
          audio: audioEnabledRef.current,
          video: videoEnabledRef.current,
          screen: screenSharingRef.current,
          hand: handRaisedRef.current,
        });

        pingTimerRef.current = window.setInterval(() => {
          sendWs({ type: 'PING' });
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (disposedRef.current) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = msg.type as string;
        switch (type) {
          case 'ROOM_STATE': {
            const existingPeers = (msg.participants as MeetingParticipant[]) || [];
            const self = msg.self as MeetingParticipant | undefined;
            const history = (msg.chatHistory as MeetingChatMessage[]) || [];
            setParticipants(self ? [self, ...existingPeers] : existingPeers);
            setChatMessages(history);
            existingPeers.forEach((peer) => {
              void sendOfferToPeer(peer.userId);
            });
            break;
          }
          case 'PARTICIPANT_JOINED': {
            const joined = msg.participant as MeetingParticipant;
            setParticipants((prev) => {
              const filtered = prev.filter((p) => p.userId !== joined.userId);
              return [...filtered, joined];
            });
            break;
          }
          case 'PARTICIPANT_LEFT': {
            const leftUserId = Number(msg.userId);
            closePeer(leftUserId);
            setParticipants((prev) => prev.filter((p) => p.userId !== leftUserId));
            break;
          }
          case 'MEDIA_STATE': {
            const uid = Number(msg.userId);
            setParticipants((prev) =>
              prev.map((p) =>
                p.userId === uid
                  ? {
                      ...p,
                      audioEnabled: Boolean(msg.audioEnabled),
                      videoEnabled: Boolean(msg.videoEnabled),
                      screenSharing: Boolean(msg.screenSharing),
                      handRaised: Boolean(msg.handRaised),
                    }
                  : p,
              ),
            );
            break;
          }
          case 'OFFER': {
            const fromUserId = Number(msg.fromUserId);
            const payload = msg.payload as RTCSessionDescriptionInit;
            void handleOfferFromPeer(fromUserId, payload);
            break;
          }
          case 'ANSWER': {
            const fromUserId = Number(msg.fromUserId);
            const payload = msg.payload as RTCSessionDescriptionInit;
            void handleAnswerFromPeer(fromUserId, payload);
            break;
          }
          case 'ICE_CANDIDATE': {
            const fromUserId = Number(msg.fromUserId);
            const payload = msg.payload as RTCIceCandidateInit;
            void handleIceCandidateFromPeer(fromUserId, payload);
            break;
          }
          case 'CHAT_MESSAGE': {
            const chatItem = msg.message as MeetingChatMessage;
            setChatMessages((prev) => [...prev, chatItem]);
            break;
          }
          case 'MEETING_ENDED': {
            const endMsg = (msg.message as string) || 'Buổi họp đã kết thúc.';
            setConnectionStatus('ended');
            setErrorMessage(endMsg);
            cleanupAllResources();
            onMeetingEndedRef.current?.(endMsg);
            break;
          }
          case 'SESSION_REPLACED': {
            setConnectionStatus('replaced');
            setErrorMessage(
              (msg.message as string) || 'Phiên họp này đã được mở ở tab hoặc thiết bị khác.',
            );
            cleanupAllResources();
            break;
          }
          case 'ERROR': {
            if (typeof msg.message === 'string') {
              setMediaWarning(msg.message);
            }
            break;
          }
          default:
            break;
        }
      };

      ws.onclose = (event) => {
        if (disposedRef.current) return;
        if (event.code === 4001) {
          setConnectionStatus('replaced');
          return;
        }
        setConnectionStatus((prev) => {
          if (prev === 'ended' || prev === 'replaced' || prev === 'error') {
            return prev;
          }
          setErrorMessage('Kết nối tới phòng họp đã bị ngắt.');
          return 'error';
        });
      };

      ws.onerror = () => {
        if (disposedRef.current) return;
        setConnectionStatus((prev) => (prev === 'ended' || prev === 'replaced' ? prev : 'error'));
        setErrorMessage('Không thể kết nối WebSocket tới phòng họp.');
      };
    };

    void init();

    return () => {
      disposedRef.current = true;
      cleanupAllResources();
    };
  }, [
    classroomId,
    user,
    cleanupAllResources,
    closePeer,
    handleAnswerFromPeer,
    handleIceCandidateFromPeer,
    handleOfferFromPeer,
    rebuildLocalPreviewStream,
    sendOfferToPeer,
    sendWs,
    syncMediaState,
  ]);

  const toggleAudio = useCallback(async () => {
    if (localAudioTrackRef.current && localAudioTrackRef.current.readyState === 'live') {
      const next = !audioEnabledRef.current;
      localAudioTrackRef.current.enabled = next;
      syncMediaState({ audio: next });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaWarning('Trình duyệt không hỗ trợ micro.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0] ?? null;
      if (!track) return;
      localAudioTrackRef.current = track;
      await replaceTrackForAllPeers('audio', track);
      rebuildLocalPreviewStream();
      syncMediaState({ audio: true });
      setMediaWarning(null);
    } catch {
      setMediaWarning('Không thể bật micro. Vui lòng kiểm tra quyền truy cập micro của trình duyệt.');
    }
  }, [rebuildLocalPreviewStream, replaceTrackForAllPeers, syncMediaState]);

  const toggleVideo = useCallback(async () => {
    if (videoEnabledRef.current) {
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current = null;
      }
      if (!screenSharingRef.current) {
        await replaceTrackForAllPeers('video', null);
      }
      rebuildLocalPreviewStream();
      syncMediaState({ video: false });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaWarning('Trình duyệt không hỗ trợ camera.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0] ?? null;
      if (!track) return;
      localVideoTrackRef.current = track;
      if (!screenSharingRef.current) {
        await replaceTrackForAllPeers('video', track);
      }
      rebuildLocalPreviewStream();
      syncMediaState({ video: true });
      setMediaWarning(null);
    } catch {
      setMediaWarning('Không thể bật camera. Vui lòng kiểm tra thiết bị hoặc quyền truy cập.');
    }
  }, [rebuildLocalPreviewStream, replaceTrackForAllPeers, syncMediaState]);

  const stopScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    const fallbackVideo =
      videoEnabledRef.current && localVideoTrackRef.current?.readyState === 'live'
        ? localVideoTrackRef.current
        : null;
    await replaceTrackForAllPeers('video', fallbackVideo);
    rebuildLocalPreviewStream();
    syncMediaState({ screen: false });
  }, [rebuildLocalPreviewStream, replaceTrackForAllPeers, syncMediaState]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharingRef.current) {
      await stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaWarning('Trình duyệt không hỗ trợ chia sẻ màn hình.');
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = displayStream.getVideoTracks()[0];
      if (!track) return;

      screenTrackRef.current = track;
      track.onended = () => {
        void stopScreenShare();
      };

      await replaceTrackForAllPeers('video', track);
      rebuildLocalPreviewStream();
      syncMediaState({ screen: true });
    } catch {
      // Người dùng hủy hộp thoại chọn màn hình
    }
  }, [rebuildLocalPreviewStream, replaceTrackForAllPeers, stopScreenShare, syncMediaState]);

  const toggleHandRaise = useCallback(() => {
    syncMediaState({ hand: !handRaisedRef.current });
  }, [syncMediaState]);

  const sendChatMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      sendWs({
        type: 'CHAT_MESSAGE',
        content: trimmed,
      });
    },
    [sendWs],
  );

  const leaveRoom = useCallback(() => {
    disposedRef.current = true;
    cleanupAllResources();
  }, [cleanupAllResources]);

  const endMeetingForAll = useCallback(async () => {
    if (!classroomId) return;
    await meetingApi.end(classroomId);
    disposedRef.current = true;
    cleanupAllResources();
  }, [classroomId, cleanupAllResources]);

  return {
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
  };
}
