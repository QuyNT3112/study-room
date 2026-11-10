export type Role = 'TEACHER' | 'STUDENT';

export type ClassroomStatus = 'ACTIVE' | 'CLOSED';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export interface TeacherSummary {
  id: number;
  fullName: string;
  email: string;
}

export interface Member {
  id: number;
  fullName: string;
  email: string;
  enrolledAt: string;
}

export interface ClassroomSummary {
  id: number;
  name: string;
  description: string;
  roomCode: string;
  status: ClassroomStatus;
  teacher: TeacherSummary;
  memberCount: number;
  joined: boolean;
  owner: boolean;
  liveMeeting: boolean;
  activeMeetingParticipants: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassroomDetail extends ClassroomSummary {
  members: Member[];
}

export type MeetingStatus = 'LIVE' | 'ENDED';

export interface MeetingParticipant {
  userId: number;
  fullName: string;
  email: string;
  role: Role;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  joinedAt: string;
}

export interface MeetingSession {
  id: number;
  classroomId: number;
  classroomName: string;
  roomCode: string;
  title: string;
  meetingCode: string;
  status: MeetingStatus;
  host: TeacherSummary;
  activeParticipants: MeetingParticipant[];
  participantCount: number;
  startedAt: string;
  endedAt: string | null;
  canManage: boolean;
  canJoin: boolean;
}

export interface MeetingOverview {
  active: boolean;
  canStart: boolean;
  canJoin: boolean;
  currentSession: MeetingSession | null;
  recentSessions: MeetingSession[];
}

export interface MeetingChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  senderRole: Role;
  content: string;
  sentAt: string;
}

export interface TeacherDashboard {
  totalClassrooms: number;
  activeClassrooms: number;
  totalStudents: number;
  totalEnrollments: number;
  recentClassrooms: ClassroomSummary[];
}

export interface StudentDashboard {
  totalJoinedClassrooms: number;
  myClassrooms: ClassroomSummary[];
  account: User;
}

export interface ApiErrorPayload {
  timestamp?: string;
  status: number;
  error?: string;
  message: string;
  path?: string;
  fieldErrors?: Record<string, string> | null;
}
