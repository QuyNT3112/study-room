import type {
  ApiErrorPayload,
  AuthResponse,
  ClassroomDetail,
  ClassroomStatus,
  ClassroomSummary,
  MeetingOverview,
  MeetingSession,
  Role,
  StudentDashboard,
  TeacherDashboard,
  User,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8080/api';
const TOKEN_STORAGE_KEY = 'studyroom_access_token';

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string> | null;

  constructor(message: string, status: number, fieldErrors?: Record<string, string> | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra Backend đã khởi chạy chưa.',
      0,
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const err = payload as ApiErrorPayload | null;
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
      window.dispatchEvent(new CustomEvent('studyroom:unauthorized'));
    }
    throw new ApiError(
      err?.message || 'Đã có lỗi xảy ra khi xử lý yêu cầu',
      response.status,
      err?.fieldErrors,
    );
  }

  return payload as T;
}

export const authApi = {
  register(data: { fullName: string; email: string; password: string; role: Role }) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  login(data: { email: string; password: string }) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  logout() {
    return request<{ message: string }>('/auth/logout', { method: 'POST' });
  },
  me() {
    return request<User>('/auth/me');
  },
};

export const dashboardApi = {
  teacher() {
    return request<TeacherDashboard>('/dashboard/teacher');
  },
  student() {
    return request<StudentDashboard>('/dashboard/student');
  },
};

export const classroomApi = {
  listAll(params?: { search?: string; status?: ClassroomStatus | '' }) {
    const query = new URLSearchParams();
    if (params?.search?.trim()) {
      query.set('search', params.search.trim());
    }
    if (params?.status) {
      query.set('status', params.status);
    }
    const qs = query.toString();
    return request<ClassroomSummary[]>(`/classrooms${qs ? `?${qs}` : ''}`);
  },
  listMine() {
    return request<ClassroomSummary[]>('/classrooms/my');
  },
  getDetail(id: number | string) {
    return request<ClassroomDetail>(`/classrooms/${id}`);
  },
  create(data: { name: string; description: string; status?: ClassroomStatus }) {
    return request<ClassroomDetail>('/classrooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update(id: number | string, data: { name: string; description: string; status: ClassroomStatus }) {
    return request<ClassroomDetail>(`/classrooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: number | string) {
    return request<{ message: string }>(`/classrooms/${id}`, {
      method: 'DELETE',
    });
  },
  joinById(id: number | string) {
    return request<ClassroomDetail>(`/classrooms/${id}/join`, {
      method: 'POST',
    });
  },
  joinByCode(roomCode: string) {
    return request<ClassroomDetail>('/classrooms/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ roomCode }),
    });
  },
  leave(id: number | string) {
    return request<{ message: string }>(`/classrooms/${id}/leave`, {
      method: 'DELETE',
    });
  },
};

export const meetingApi = {
  listLive() {
    return request<MeetingSession[]>('/meetings/live');
  },
  getOverview(classroomId: number | string) {
    return request<MeetingOverview>(`/classrooms/${classroomId}/meeting`);
  },
  start(classroomId: number | string, title?: string) {
    return request<MeetingSession>(`/classrooms/${classroomId}/meeting/start`, {
      method: 'POST',
      body: JSON.stringify(title?.trim() ? { title: title.trim() } : {}),
    });
  },
  end(classroomId: number | string) {
    return request<MeetingSession>(`/classrooms/${classroomId}/meeting/end`, {
      method: 'POST',
    });
  },
};

export function getMeetingWsUrl(classroomId: number | string): string {
  const token = getStoredToken() || '';
  const explicitWsUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  let wsBase: string;

  if (explicitWsUrl) {
    wsBase = explicitWsUrl.replace(/\/$/, '');
  } else if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    const parsed = new URL(API_BASE_URL);
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = `${protocol}//${parsed.host}/ws/meeting`;
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = `${protocol}//${window.location.host}/ws/meeting`;
  }

  const params = new URLSearchParams({
    token,
    classroomId: String(classroomId),
  });
  return `${wsBase}?${params.toString()}`;
}
