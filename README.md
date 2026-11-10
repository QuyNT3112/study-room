# StudyRoom — Nền tảng Quản lý Phòng học & Họp Trực tuyến (MVP)

**StudyRoom** là ứng dụng web cho phép giáo viên tạo và quản lý phòng học trực tuyến, cấp mã phòng riêng cho học sinh tham gia, theo dõi thống kê qua Dashboard theo vai trò và **tổ chức họp trực tuyến (Online Meeting)** ngay trong từng lớp học với Video/Audio WebRTC, chia sẻ màn hình, giơ tay phát biểu và chat thời gian thực.

---

## 1. Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| **Backend** | Java 25, Spring Boot 4.0.9 (Spring Web, Spring Data JPA, Spring Security, Spring WebSocket, Bean Validation), JJWT 0.12.6, BCrypt |
| **Họp trực tuyến** | WebRTC (Mesh P2P `RTCPeerConnection` + STUN) kết hợp WebSocket Signaling (`/ws/meeting`) bảo vệ bằng JWT |
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS v4, React Router v7, Lucide React |
| **Database** | H2 (file-based mặc định với PostgreSQL compatibility mode) / PostgreSQL 16+ (`postgres` profile & Docker Compose) |
| **Build & Test** | Maven Wrapper (`mvnw` / `mvnw.cmd`), JUnit 5, Spring MockMvc, Java `HttpClient` + `StandardWebSocketClient`, npm |

---

## 2. Cấu trúc thư mục

```text
studyroom/
├── .env.example                          # File cấu hình môi trường mẫu (Backend + Frontend)
├── .gitignore
├── docker-compose.yml                    # Docker PostgreSQL (tùy chọn)
├── README.md                             # Tài liệu kiến trúc, cách chạy, tính năng & hàm xử lý
├── database/
│   └── schema.sql                        # SQL Schema PostgreSQL (users, classrooms, enrollments, meeting_sessions)
├── backend/
│   ├── mvnw / mvnw.cmd                   # Maven Wrapper
│   ├── pom.xml
│   └── src/
│       ├── main/
│       │   ├── java/com/studyroom/
│       │   │   ├── StudyRoomApplication.java
│       │   │   ├── config/               # SecurityConfig, WebSocketConfig, DataSeeder
│       │   │   ├── controller/           # AuthController, ClassroomController, DashboardController, MeetingController
│       │   │   ├── dto/                  # request/* & response/* DTOs (Java records)
│       │   │   ├── entity/               # User, Classroom, Enrollment, MeetingSession, Role, ClassroomStatus, MeetingStatus
│       │   │   ├── exception/            # Custom exceptions & GlobalExceptionHandler
│       │   │   ├── repository/           # Spring Data JPA Repositories
│       │   │   ├── security/             # JwtService, JwtAuthenticationFilter, TokenRevocationService, UserPrincipal, CustomUserDetailsService
│       │   │   ├── service/              # AuthService, ClassroomService, DashboardService, MeetingService, MeetingRoomRegistry
│       │   │   └── websocket/            # MeetingWebSocketHandshakeInterceptor, MeetingSignalingHandler
│       │   └── resources/
│       │       ├── application.yml       # Cấu hình mặc định (H2 persistent file DB)
│       │       └── application-postgres.yml
│       └── test/
│           ├── java/com/studyroom/
│           │   ├── StudyRoomApplicationTests.java
│           │   ├── StudyRoomApiIntegrationTest.java
│           │   └── StudyRoomMeetingIntegrationTest.java
│           └── resources/
│               └── application-test.yml
└── frontend/
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts                    # Cấu hình dev server + proxy /api và /ws
    └── src/
        ├── App.tsx                       # Định tuyến toàn ứng dụng (gồm /classrooms/:id/meeting)
        ├── main.tsx
        ├── index.css
        ├── vite-env.d.ts
        ├── hooks/                        # useMeetingRoom.ts (WebRTC + WebSocket Signaling + Media)
        ├── components/                   # Layout, ClassroomCard, ClassroomFormModal, JoinByCodeModal, ConfirmModal, ProtectedRoute
        ├── context/                      # AuthContext, ToastContext
        ├── pages/                        # LoginPage, RegisterPage, DashboardPage, ClassroomsPage, ClassroomDetailPage, MeetingRoomPage
        ├── services/                     # api.ts (Fetch client, authApi, classroomApi, dashboardApi, meetingApi, getMeetingWsUrl)
        ├── types/                        # TypeScript interfaces
        └── utils/                        # format.ts
```

---

## 3. Thiết kế Database

Hệ thống sử dụng 4 bảng quan hệ chính (chi tiết tại [`database/schema.sql`](database/schema.sql)):

1. **`users`**: `id` (PK), `full_name`, `email` (UNIQUE), `password_hash` (BCrypt), `role` (`TEACHER` | `STUDENT`), `created_at`, `updated_at`.
2. **`classrooms`**: `id` (PK), `name`, `description`, `room_code` (UNIQUE), `status` (`ACTIVE` | `CLOSED`), `teacher_id` (FK → `users.id`), `created_at`, `updated_at`.
3. **`enrollments`**: `id` (PK), `classroom_id` (FK → `classrooms.id` ON DELETE CASCADE), `student_id` (FK → `users.id` ON DELETE CASCADE), `enrolled_at`, kèm ràng buộc `UNIQUE (classroom_id, student_id)` ngăn ghi danh trùng lặp.
4. **`meeting_sessions`**: `id` (PK), `classroom_id` (FK → `classrooms.id` ON DELETE CASCADE), `host_id` (FK → `users.id` ON DELETE CASCADE), `title`, `meeting_code` (UNIQUE, dạng `MT-XXXXXXXX`), `status` (`LIVE` | `ENDED`), `started_at`, `ended_at`.

---

## 4. Hướng dẫn cài đặt và khởi chạy chi tiết

### Yêu cầu môi trường
- **Java JDK 25** (kiểm tra bằng `java -version` và `javac -version`)
- **Node.js 20+** và **npm** (khuyến nghị Node 22 LTS)
- *(Tùy chọn)* **PostgreSQL 16+** hoặc **Docker Desktop** nếu muốn chạy PostgreSQL thay cho H2 mặc định.
- **Trình duyệt hiện đại** (Chrome / Edge / Firefox) hỗ trợ WebRTC. *Lưu ý: khi mở qua `http://localhost:5173`, trình duyệt coi là Secure Context nên cho phép dùng Camera/Micro/Chia sẻ màn hình bình thường; nếu máy không có webcam/mic, hệ thống tự chuyển sang chế độ nghe/xem/chat.*

### Bước 1: Cấu hình biến môi trường (tùy chọn)
- **Backend:** mặc định chạy cổng `8080` với H2 persistent DB tại `backend/data/studyroom.mv.db`, tự seed dữ liệu mẫu khi DB trống. Tham khảo [`.env.example`](.env.example) nếu muốn đổi cổng, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS` hoặc kết nối PostgreSQL.
- **Frontend:** nếu cần tùy chỉnh API/WebSocket URL, sao chép `frontend/.env.example` thành `frontend/.env`:
  ```env
  VITE_API_BASE_URL=http://localhost:8080/api
  VITE_WS_BASE_URL=ws://localhost:8080/ws/meeting
  ```
  *(Mặc định nếu không tạo `frontend/.env`, frontend gọi `http://localhost:8080/api` và tự suy ra `ws://localhost:8080/ws/meeting`.)*

### Bước 2: Khởi chạy Backend

**Trên Windows (PowerShell):**
```powershell
cd backend
# Nếu máy chưa đặt biến JAVA_HOME toàn cục, tự lấy từ đường dẫn javac:
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Split-Path (Split-Path (Get-Command javac).Source -Parent) -Parent }
.\mvnw.cmd spring-boot:run
```

**Trên macOS / Linux:**
```bash
cd backend
./mvnw spring-boot:run
```

> **Tùy chọn chạy với PostgreSQL qua Docker Compose:**
> ```bash
> docker compose up -d
> # Trên Windows PowerShell:
> $env:SPRING_PROFILES_ACTIVE="postgres"; .\mvnw.cmd spring-boot:run
> # Trên macOS / Linux:
> SPRING_PROFILES_ACTIVE=postgres ./mvnw spring-boot:run
> ```

Backend sẽ lắng nghe tại:
- REST API: `http://localhost:8080/api`
- WebSocket Meeting Signaling: `ws://localhost:8080/ws/meeting`
- H2 Console (chế độ mặc định): `http://localhost:8080/h2-console`

### Bước 3: Khởi chạy Frontend
Mở một terminal mới:
```powershell
cd frontend
npm install
npm run dev
```
> *Nếu Windows PowerShell chặn file `npm.ps1`, chạy `npm.cmd install` và `npm.cmd run dev`.*

Frontend chạy tại: **`http://localhost:5173`**

---

## 5. Tài khoản và phòng học mẫu

Khi khởi chạy lần đầu với DB trống, [`DataSeeder.run`](backend/src/main/java/com/studyroom/config/DataSeeder.java) tự động tạo dữ liệu mẫu:

| Vai trò | Họ tên | Email | Mật khẩu |
| --- | --- | --- | --- |
| **Giáo viên** | Cô Nguyễn Minh Anh | `teacher@studyroom.edu.vn` | `Teacher@123` |
| **Giáo viên 2** | Thầy Trần Quốc Bảo | `teacher2@studyroom.edu.vn` | `Teacher@123` |
| **Học sinh** | Nguyễn Hoàng Nam | `student@studyroom.edu.vn` | `Student@123` |
| **Học sinh 2** | Trần Thảo Vy | `student2@studyroom.edu.vn` | `Student@123` |

**Mã phòng học mẫu:** `JAVA25` (Đang mở), `REACT9` (Đang mở), `SQL101` (Đang mở), `ALGO88` (Đã đóng).

---

## 6. Chi tiết các tính năng & Hàm xử lý tương ứng

### 6.1. Xác thực, Phiên làm việc & Phân quyền (Auth & Security)

| Tính năng | Mô tả hoạt động | Hàm xử lý Backend | Hàm xử lý Frontend |
| --- | --- | --- | --- |
| **Đăng ký tài khoản** | Kiểm tra trùng email, băm mật khẩu bằng BCrypt, cấp JWT token | `AuthController.register` → `AuthService.register` → `JwtService.generateToken` | `RegisterPage` → `AuthContext.register` → `authApi.register` |
| **Đăng nhập** | Xác thực email/mật khẩu qua `AuthenticationManager`, trả JWT & hồ sơ người dùng | `AuthController.login` → `AuthService.login` → `CustomUserDetailsService.loadUserByUsername` | `LoginPage` → `AuthContext.login` → `authApi.login` |
| **Xác thực request & lấy thông tin hiện tại** | Đọc header `Authorization: Bearer <token>`, kiểm tra hợp lệ và chưa bị thu hồi | `JwtAuthenticationFilter.doFilterInternal` → `JwtService.isTokenValid` → `AuthController.me` / `AuthService.getCurrentUser` | `AuthContext.loadSession` → `authApi.me` (`ProtectedRoute`, `GuestOnlyRoute`) |
| **Đăng xuất & Thu hồi JWT** | Đưa `jti` của token vào danh sách thu hồi trong bộ nhớ cho tới khi hết hạn | `AuthController.logout` → `AuthService.logout` → `JwtService.revokeToken` → `TokenRevocationService.revoke` | `Layout.handleLogout` → `AuthContext.logout` → `authApi.logout` |
| **Xử lý lỗi tập trung** | Chuẩn hóa mọi ngoại lệ (`400`, `401`, `403`, `404`, `409`, `500`) về `ErrorResponse` JSON | `GlobalExceptionHandler` (`handleNotFound`, `handleDuplicate`, `handleBadRequest`, `handleForbidden`, `handleValidation`, ...) | `request()` trong `frontend/src/services/api.ts` (ném `ApiError` & phát sự kiện `studyroom:unauthorized`) |

---

### 6.2. Quản lý phòng học, Ghi danh & Dashboard

| Tính năng | Mô tả hoạt động | Hàm xử lý Backend | Hàm xử lý Frontend |
| --- | --- | --- | --- |
| **Tìm kiếm & lọc phòng học** | Lọc theo tên/mã phòng (`search`) và trạng thái (`ACTIVE`/`CLOSED`), đính kèm trạng thái đang họp | `ClassroomController.listAll` → `ClassroomService.listAllClassrooms` → `ClassroomService.toSummaryList` | `ClassroomsPage.loadClassrooms` → `classroomApi.listAll` |
| **Xem phòng của tôi** | Trả về phòng GV đã tạo hoặc phòng HS đã ghi danh | `ClassroomController.listMine` → `ClassroomService.listMyClassrooms` | `ClassroomsPage.loadClassrooms` → `classroomApi.listMine` |
| **Xem chi tiết phòng học** | Hiển thị mô tả, giáo viên phụ trách, danh sách thành viên và trạng thái buổi họp trực tiếp | `ClassroomController.getDetail` → `ClassroomService.getClassroomDetail` → `ClassroomService.buildDetailResponse` | `ClassroomDetailPage.loadDetail` → `classroomApi.getDetail` |
| **Tạo / Sửa / Xóa phòng (GV)** | Chỉ GV chủ phòng mới được thao tác; tạo mã phòng 6 ký tự ngẫu nhiên duy nhất; xóa phòng tự ngắt các phiên họp đang mở | `ClassroomController.create`/`update`/`delete` → `ClassroomService.createClassroom` (`generateUniqueRoomCode`), `updateClassroom`, `deleteClassroom` | `ClassroomFormModal`, `DashboardPage.handleFormSubmit`, `ClassroomsPage.handleFormSubmit`, `ClassroomDetailPage.handleEditSubmit` |
| **Tham gia / Rời phòng (HS)** | Học sinh vào bằng ID hoặc mã `roomCode` (không phân biệt hoa/thường); chặn lớp đã đóng & trùng lặp | `ClassroomController.joinByCode`/`joinById`/`leave` → `ClassroomService.joinClassroomByCode`, `joinClassroomById`, `enrollStudent`, `leaveClassroom` | `DashboardPage.handleQuickJoinByCode`, `JoinByCodeModal`, `ClassroomsPage.handleJoinById`, `ClassroomDetailPage.handleJoin` |
| **Dashboard theo vai trò** | Thống kê số phòng, số học sinh, lượt ghi danh, lớp gần đây + banner các buổi họp đang `LIVE` | `DashboardController.getTeacherDashboard`/`getStudentDashboard` → `DashboardService.getTeacherDashboard`/`getStudentDashboard` | `DashboardPage.loadDashboard` (`dashboardApi.teacher`, `dashboardApi.student`, `meetingApi.listLive`) |

---

### 6.3. Họp trực tuyến (Online Meeting: WebRTC + WebSocket Signaling + Chat)

Chức năng họp trực tuyến hoạt động theo kiến trúc:
1. **Điều khiển vòng đời phiên họp qua REST API** (`MeetingSession` lưu trong DB với mã `MT-XXXXXXXX` và trạng thái `LIVE`/`ENDED`).
2. **Xác thực WebSocket Handshake**: Khi vào `/classrooms/:id/meeting`, client mở kết nối `/ws/meeting?token=<JWT>&classroomId=<id>`. Server kiểm tra JWT và quyền thành viên (phải là Giáo viên chủ phòng hoặc Học sinh đã ghi danh) trước khi nâng cấp kết nối.
3. **Truyền thông đa phương tiện WebRTC (Mesh P2P)**: Các thành viên thiết lập `RTCPeerConnection` trực tiếp với nhau thông qua tín hiệu `OFFER`, `ANSWER`, `ICE_CANDIDATE` chuyển tiếp qua Spring WebSocket. Mỗi kết nối luôn khởi tạo sẵn transceiver `audio` + `video` (`direction: 'sendrecv'`) để người tham gia vẫn nghe/xem được kể cả khi không có webcam/micro, đồng thời đổi luồng mượt mà khi chia sẻ màn hình hoặc bật lại camera qua `sender.replaceTrack(...)`.

| Tính năng trong Meeting | Mô tả hoạt động | Hàm xử lý Backend | Hàm xử lý Frontend |
| --- | --- | --- | --- |
| **Bắt đầu buổi họp (GV)** | Chỉ GV chủ phòng ở lớp `ACTIVE` mới mở được; sinh mã họp `MT-XXXXXXXX` hoặc trả về phiên `LIVE` hiện tại | `MeetingController.startMeeting` → `MeetingService.startMeeting` (`generateUniqueMeetingCode`) | `ClassroomDetailPage.handleStartMeeting` → `meetingApi.start` |
| **Kiểm tra trạng thái & lịch sử họp** | Lấy buổi họp đang mở (`LIVE`) và tối đa 8 buổi họp gần nhất; liệt kê các lớp đang họp của tôi | `MeetingController.getOverview` → `MeetingService.getMeetingOverview`; `MeetingController.listMyLiveMeetings` → `MeetingService.listMyLiveMeetings` | `ClassroomDetailPage.loadMeetingOverview` → `meetingApi.getOverview`; `DashboardPage.loadDashboard` → `meetingApi.listLive` |
| **Xác thực & tham gia phòng họp WebSocket** | Kiểm tra JWT hợp lệ, chưa thu hồi, người dùng thuộc lớp và buổi họp đang `LIVE`; trả `ROOM_STATE` + lịch sử chat, phát `PARTICIPANT_JOINED` cho người khác; tự thay thế kết nối cũ nếu cùng user mở 2 tab | `MeetingWebSocketHandshakeInterceptor.beforeHandshake` → `MeetingService.verifyMeetingJoinAccess`; `MeetingSignalingHandler.afterConnectionEstablished` → `MeetingRoomRegistry.registerParticipant` | `getMeetingWsUrl` (`api.ts`) → `useMeetingRoom` (`useEffect` init + `ws.onmessage` xử lý `ROOM_STATE`, `PARTICIPANT_JOINED`, `PARTICIPANT_LEFT`, `SESSION_REPLACED`) |
| **Thiết lập kết nối Video/Audio P2P** | Người mới vào gửi `OFFER` tới các thành viên sẵn có; trao đổi `ANSWER` và `ICE_CANDIDATE` (hàng đợi ICE nếu chưa có `remoteDescription`) | `MeetingSignalingHandler.handleTextMessage` (`OFFER`/`ANSWER`/`ICE_CANDIDATE`) → `MeetingRoomRegistry.relaySignal` | `useMeetingRoom`: `createPeerConnection`, `sendOfferToPeer`, `handleOfferFromPeer`, `handleAnswerFromPeer`, `handleIceCandidateFromPeer` |
| **Bật / Tắt Micro & Camera** | Khởi tạo media với fallback tự động (AV → chỉ Audio → chế độ xem/chat); bật tắt micro ngay lập tức hoặc tắt hẳn đèn camera và đồng bộ `MEDIA_STATE` | `MeetingSignalingHandler.handleTextMessage` (`MEDIA_STATE`) → `MeetingRoomRegistry.updateMediaState` | `useMeetingRoom`: `toggleAudio`, `toggleVideo`, `replaceTrackForAllPeers`, `syncMediaState`, `rebuildLocalPreviewStream` |
| **Chia sẻ màn hình (Screen Share)** | Chọn màn hình/cửa sổ qua `getDisplayMedia`, thay thế video track cho toàn bộ peer và tự khôi phục camera khi dừng | `MeetingSignalingHandler.handleTextMessage` (`MEDIA_STATE` với `screenSharing`) → `MeetingRoomRegistry.updateMediaState` | `useMeetingRoom`: `toggleScreenShare`, `stopScreenShare` |
| **Giơ tay phát biểu** | Bật/tắt cờ giơ tay, hiển thị huy hiệu nổi bật trên ô video và danh sách thành viên | `MeetingSignalingHandler.handleTextMessage` (`MEDIA_STATE` với `handRaised`) → `MeetingRoomRegistry.updateMediaState` | `useMeetingRoom.toggleHandRaise` → hiển thị trong `VideoTile` & danh sách thành viên (`MeetingRoomPage`) |
| **Chat trực tiếp trong buổi họp** | Gửi tin nhắn thời gian thực, lưu tối đa 100 tin nhắn gần nhất của phiên đang chạy và đếm tin chưa đọc khi đóng panel chat | `MeetingSignalingHandler.handleTextMessage` (`CHAT_MESSAGE`) → `MeetingRoomRegistry.appendAndBroadcastChat` | `useMeetingRoom.sendChatMessage` → `MeetingRoomPage.handleSendChat` |
| **Ghim / Phóng lớn khung hình** | Tự ưu tiên khung hình người đang chia sẻ màn hình hoặc ghim thủ công bất kỳ thành viên nào | — *(xử lý ở client)* | `MeetingRoomPage` (`effectivePinnedId`, `VideoTile.onTogglePin`) |
| **Rời họp & Kết thúc họp cho tất cả** | Rời họp giải phóng camera/mic & đóng peer; GV kết thúc họp chuyển DB sang `ENDED`, phát `MEETING_ENDED` và đóng toàn bộ WebSocket | `MeetingController.endMeeting` → `MeetingService.endMeeting` → `MeetingRoomRegistry.broadcastMeetingEnded`; ngắt kết nối gọi `MeetingSignalingHandler.afterConnectionClosed` → `MeetingRoomRegistry.unregisterParticipant` | `useMeetingRoom.leaveRoom`, `useMeetingRoom.endMeetingForAll`, `cleanupAllResources`; `MeetingRoomPage.handleLeave`, `MeetingRoomPage.handleConfirmEndMeeting` |

---

## 7. Danh sách RESTful API & Giao thức WebSocket

Tất cả REST API (trừ `/api/auth/register`, `/api/auth/login` và `/ws/meeting`) yêu cầu header `Authorization: Bearer <accessToken>`.

### Authentication (`/api/auth`)
| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Công khai | Đăng ký tài khoản (`TEACHER` hoặc `STUDENT`) |
| `POST` | `/api/auth/login` | Công khai | Đăng nhập bằng email & mật khẩu |
| `POST` | `/api/auth/logout` | Đã đăng nhập | Đăng xuất và thu hồi JWT token hiện tại |
| `GET` | `/api/auth/me` | Đã đăng nhập | Lấy thông tin người dùng hiện tại |

### Dashboard (`/api/dashboard`)
| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard/teacher` | `TEACHER` | Thống kê phòng học, số học sinh & phòng học gần đây |
| `GET` | `/api/dashboard/student` | `STUDENT` | Thống kê số phòng đã tham gia, danh sách lớp & tài khoản |

### Quản lý phòng học (`/api/classrooms`)
| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/classrooms?search=&status=` | Đã đăng nhập | Danh sách tất cả phòng học (tìm kiếm, lọc trạng thái & trạng thái đang họp) |
| `GET` | `/api/classrooms/my` | Đã đăng nhập | Phòng học do giáo viên tạo / Phòng học sinh đã tham gia |
| `GET` | `/api/classrooms/{id}` | Đã đăng nhập | Chi tiết phòng học, danh sách học sinh & trạng thái đang họp |
| `POST` | `/api/classrooms` | `TEACHER` | Tạo phòng học mới (tự sinh mã phòng `roomCode`) |
| `PUT` | `/api/classrooms/{id}` | `TEACHER` (Chủ phòng) | Cập nhật tên, mô tả, trạng thái (`ACTIVE` / `CLOSED`) |
| `DELETE` | `/api/classrooms/{id}` | `TEACHER` (Chủ phòng) | Xóa phòng học, toàn bộ lượt ghi danh & phiên họp liên quan |
| `POST` | `/api/classrooms/join-by-code` | `STUDENT` | Tham gia phòng học bằng mã phòng (`roomCode`) |
| `POST` | `/api/classrooms/{id}/join` | `STUDENT` | Tham gia phòng học theo ID |
| `DELETE` | `/api/classrooms/{id}/leave` | `STUDENT` | Rời khỏi phòng học |

### Họp trực tuyến (`/api/meetings` & `/api/classrooms/{classroomId}/meeting`)
| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/meetings/live` | Đã đăng nhập | Danh sách các buổi họp đang `LIVE` trong lớp bạn sở hữu hoặc đã tham gia |
| `GET` | `/api/classrooms/{classroomId}/meeting` | Chủ phòng / HS đã tham gia | Trạng thái phiên họp hiện tại, người đang online và lịch sử buổi họp gần đây |
| `POST` | `/api/classrooms/{classroomId}/meeting/start` | `TEACHER` (Chủ phòng) | Bắt đầu (hoặc lấy lại) buổi họp trực tuyến đang mở trong lớp `ACTIVE` |
| `POST` | `/api/classrooms/{classroomId}/meeting/end` | `TEACHER` (Chủ phòng) | Kết thúc buổi họp hiện tại, lưu `endedAt` và ngắt toàn bộ kết nối trong phòng |

### WebSocket Signaling (`/ws/meeting?token=<JWT>&classroomId=<id>`)
- **Client → Server:** `PING`, `OFFER`, `ANSWER`, `ICE_CANDIDATE`, `MEDIA_STATE`, `CHAT_MESSAGE`
- **Server → Client:** `PONG`, `ROOM_STATE`, `PARTICIPANT_JOINED`, `PARTICIPANT_LEFT`, `OFFER`, `ANSWER`, `ICE_CANDIDATE`, `MEDIA_STATE`, `CHAT_MESSAGE`, `MEETING_ENDED`, `SESSION_REPLACED`, `ERROR`

---

## 8. Hướng dẫn kiểm thử

### Kiểm thử tự động (Backend)
```powershell
cd backend
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Split-Path (Split-Path (Get-Command javac).Source -Parent) -Parent }
.\mvnw.cmd test
```
Gồm 3 bộ test:
- [`StudyRoomApplicationTests`](backend/src/test/java/com/studyroom/StudyRoomApplicationTests.java): kiểm tra khởi tạo Spring context.
- [`StudyRoomApiIntegrationTest`](backend/src/test/java/com/studyroom/StudyRoomApiIntegrationTest.java): kiểm tra đăng ký, BCrypt, đăng nhập, thu hồi JWT, phân quyền, CRUD phòng học, ghi danh theo mã và Dashboard.
- [`StudyRoomMeetingIntegrationTest`](backend/src/test/java/com/studyroom/StudyRoomMeetingIntegrationTest.java): kiểm tra toàn bộ vòng đời Meeting REST API, phân quyền bắt đầu/kết thúc họp, từ chối WebSocket trái phép (`401`/`403`), kết nối WebSocket thực tế, đồng bộ `ROOM_STATE`, `PARTICIPANT_JOINED`, `MEDIA_STATE`, relay `OFFER`, `CHAT_MESSAGE` và sự kiện `MEETING_ENDED`.

### Kiểm thử build Frontend
```powershell
cd frontend
npm.cmd run build
```

### Kiểm thử thủ công trên trình duyệt (bao gồm Họp trực tuyến 2 người)
1. **Kiểm tra luồng lớp học cơ bản:**
   - Truy cập `http://localhost:5173/login`, đăng nhập Giáo viên (`teacher@studyroom.edu.vn` / `Teacher@123`), thử tạo/sửa/xóa lớp và kiểm tra Dashboard.
2. **Kiểm tra họp trực tuyến giữa Giáo viên và Học sinh trên cùng máy:**
   - **Cửa sổ 1 (Trình duyệt thường):** Đăng nhập Giáo viên (`teacher@studyroom.edu.vn`), vào chi tiết lớp **`JAVA25`**, nhập tên buổi họp (tùy chọn) và nhấn **Bắt đầu họp online** → tự chuyển vào phòng họp `/classrooms/{id}/meeting`.
   - **Cửa sổ 2 (Cửa sổ ẩn danh / Incognito hoặc trình duyệt khác):** Truy cập `http://localhost:5173/login`, đăng nhập Học sinh (`student@studyroom.edu.vn` / `Student@123`). Trên **Dashboard** sẽ thấy banner **"Buổi họp trực tuyến đang diễn ra"** hoặc vào lớp **`JAVA25`** nhấn **Tham gia họp online**.
   - **Thử tương tác thời gian thực giữa 2 cửa sổ:**
     - Kiểm tra hiển thị 2 khung hình Video/Avatar cùng trạng thái kết nối.
     - Thử bật/tắt **Micro**, **Camera**, nhấn **Giơ tay**, gửi **Chat** qua lại, thử **Chia sẻ màn hình** ở cửa sổ Giáo viên và **Ghim khung hình** ở cửa sổ Học sinh.
     - Ở cửa sổ Giáo viên nhấn **Kết thúc cho tất cả** → xác nhận cả 2 phía nhận thông báo kết thúc, quay về trang chi tiết lớp thấy phiên họp vừa đóng trong mục **Lịch sử buổi họp gần đây**.
