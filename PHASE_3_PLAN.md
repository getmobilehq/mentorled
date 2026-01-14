# Phase 3 - Advanced Features & Polish

**Status**: Starting
**Estimated Time**: 10-15 hours
**Priority**: High-value enhancements for production readiness

---

## 🎯 Phase 3 Goals

Transform the functional platform into a production-ready application with:
- User authentication and authorization
- Advanced table features (search, filters, pagination)
- Real-time updates and notifications
- Export capabilities
- Error handling and loading states

---

## 📋 Implementation Plan

### Part 1: Authentication & Authorization (Priority 1)
**Estimated Time**: 4-5 hours

#### Backend Tasks:
1. **User Model & Authentication** (1.5h)
   - Create User model with roles (admin, program_manager, mentor, fellow)
   - Password hashing with bcrypt
   - JWT token generation and validation
   - Refresh token mechanism

2. **Auth Endpoints** (1h)
   - POST /api/auth/signup - User registration
   - POST /api/auth/login - Login with JWT
   - POST /api/auth/refresh - Token refresh
   - POST /api/auth/logout - Logout
   - GET /api/auth/me - Get current user

3. **Authorization Middleware** (1h)
   - JWT verification dependency
   - Role-based access control (RBAC)
   - Permission decorators (@require_role, @require_permission)

4. **Protected Routes** (0.5h)
   - Apply auth to existing endpoints
   - Role permissions matrix

#### Frontend Tasks:
1. **Auth Context & State** (1h)
   - Create AuthContext for global auth state
   - Token storage (httpOnly cookies or localStorage)
   - Automatic token refresh

2. **Auth Pages** (1.5h)
   - Login page with form validation
   - Signup page (admin only for creating users)
   - Logout functionality
   - Protected route wrapper

3. **UI Updates** (0.5h)
   - Add user menu to header
   - Show current user info
   - Role-based UI visibility

**Files to Create/Modify**:
```
Backend:
- backend/app/models/user.py (new)
- backend/app/api/auth.py (new)
- backend/app/core/auth.py (new) - JWT utilities
- backend/app/core/security.py (new) - Password hashing
- backend/app/dependencies.py (modify) - Add auth dependencies

Frontend:
- frontend/contexts/AuthContext.tsx (new)
- frontend/app/login/page.tsx (new)
- frontend/app/signup/page.tsx (new)
- frontend/components/auth/ProtectedRoute.tsx (new)
- frontend/components/layout/Header.tsx (modify)
- frontend/lib/api.ts (modify) - Add token handling
```

---

### Part 2: Search, Filters & Pagination (Priority 2)
**Estimated Time**: 3-4 hours

#### Backend Tasks:
1. **Pagination Utilities** (0.5h)
   - Create pagination response model
   - Add pagination parameters to list endpoints

2. **Search & Filter Logic** (1h)
   - Add search to: applicants, fellows, opportunities
   - Add filters: status, role, cohort, risk level, date range

#### Frontend Tasks:
1. **Table Component Enhancements** (1.5h)
   - Add search input
   - Add filter dropdowns
   - Add pagination controls
   - Add sort by column

2. **Update All Table Pages** (1h)
   - Applicants page
   - Fellows page
   - Opportunities list (Placement page)

**Features**:
- **Search**: Text search across name, email
- **Filters**: Multi-select for status, role, cohort
- **Pagination**: 10/25/50/100 items per page
- **Sorting**: Click column headers to sort

**Files to Create/Modify**:
```
Backend:
- backend/app/schemas/pagination.py (new)
- backend/app/api/applicants.py (modify)
- backend/app/api/fellows.py (modify)
- backend/app/api/placement.py (modify)

Frontend:
- frontend/components/ui/SearchInput.tsx (new)
- frontend/components/ui/FilterDropdown.tsx (new)
- frontend/components/ui/Pagination.tsx (new)
- frontend/components/ui/Table.tsx (modify)
- frontend/app/applicants/page.tsx (modify)
- frontend/app/fellows/page.tsx (modify)
- frontend/app/placement/page.tsx (modify)
```

---

### Part 3: Export Functionality (Priority 3)
**Estimated Time**: 2 hours

#### Backend Tasks:
1. **Export Endpoints** (1h)
   - GET /api/export/applicants/csv
   - GET /api/export/fellows/csv
   - GET /api/export/risk-report/pdf

2. **Export Utilities** (1h)
   - CSV generation helper
   - PDF generation with ReportLab
   - File download response

#### Frontend Tasks:
1. **Export Buttons** (0.5h)
   - Add "Export CSV" buttons to table pages
   - Add "Export PDF" for risk reports

**Files to Create/Modify**:
```
Backend:
- backend/app/api/export.py (new)
- backend/app/utils/csv_export.py (new)
- backend/app/utils/pdf_export.py (new)
- requirements.txt (add reportlab)

Frontend:
- frontend/components/ui/ExportButton.tsx (new)
- frontend/app/applicants/page.tsx (modify)
- frontend/app/fellows/page.tsx (modify)
- frontend/app/delivery/page.tsx (modify)
```

---

### Part 4: Real-time Updates (Priority 4)
**Estimated Time**: 3-4 hours

#### Backend Tasks:
1. **WebSocket Setup** (1.5h)
   - Configure FastAPI WebSocket support
   - Create WebSocket manager
   - Broadcasting utilities

2. **Real-time Events** (1h)
   - Emit events on: new applicant, status change, risk update, warning sent
   - Create event types and payloads

#### Frontend Tasks:
1. **WebSocket Client** (1h)
   - Create WebSocket hook
   - Connection management with reconnect
   - Event listeners

2. **Live Updates** (1h)
   - Auto-refresh dashboards on events
   - Toast notifications for important events
   - Real-time status badges

**Files to Create/Modify**:
```
Backend:
- backend/app/websocket/manager.py (new)
- backend/app/websocket/events.py (new)
- backend/app/main.py (modify) - Add WebSocket route

Frontend:
- frontend/hooks/useWebSocket.ts (new)
- frontend/contexts/WebSocketContext.tsx (new)
- frontend/components/ui/Toast.tsx (new)
- frontend/app/page.tsx (modify) - Dashboard live updates
- frontend/app/fellows/page.tsx (modify)
```

---

### Part 5: Notification System (Priority 5)
**Estimated Time**: 2 hours

#### Backend Tasks:
1. **Notification Model** (0.5h)
   - Create Notification model
   - Types: info, warning, success, error

2. **Notification Endpoints** (0.5h)
   - GET /api/notifications - List notifications
   - PATCH /api/notifications/{id}/read - Mark as read
   - DELETE /api/notifications/{id} - Delete notification

#### Frontend Tasks:
1. **Notification UI** (1h)
   - Notification bell icon in header
   - Notification dropdown
   - Unread badge count

**Files to Create/Modify**:
```
Backend:
- backend/app/models/notification.py (new)
- backend/app/api/notifications.py (new)

Frontend:
- frontend/components/layout/NotificationBell.tsx (new)
- frontend/components/ui/NotificationDropdown.tsx (new)
- frontend/components/layout/Header.tsx (modify)
```

---

### Part 6: Error Handling & Loading States (Priority 6)
**Estimated Time**: 2 hours

#### Frontend Tasks:
1. **Error Boundaries** (1h)
   - Create ErrorBoundary component
   - Wrap app with error boundary
   - Error page UI

2. **Loading Skeletons** (1h)
   - Create skeleton components for tables, cards, lists
   - Replace loading spinners with skeletons
   - Add to all data-fetching pages

**Files to Create/Modify**:
```
Frontend:
- frontend/components/ErrorBoundary.tsx (new)
- frontend/components/ui/Skeleton.tsx (new)
- frontend/app/error.tsx (new)
- frontend/app/loading.tsx (new)
- All page components (modify) - Add loading states
```

---

## 🎯 Implementation Order

**Week 1** (8-10 hours):
1. ✅ Authentication & Authorization (4-5h)
2. ✅ Search, Filters & Pagination (3-4h)

**Week 2** (5-7 hours):
3. ✅ Export Functionality (2h)
4. ✅ Error Handling & Loading States (2h)
5. ✅ Real-time Updates (3-4h)
6. ✅ Notification System (2h)

---

## 📊 Feature Priority Matrix

| Feature | Impact | Effort | Priority | Status |
|---------|--------|--------|----------|--------|
| Authentication | High | High | P0 | Pending |
| Search & Filters | High | Medium | P1 | Pending |
| Pagination | High | Low | P1 | Pending |
| Error Boundaries | High | Low | P1 | Pending |
| Loading Skeletons | Medium | Low | P2 | Pending |
| Export CSV | Medium | Low | P2 | Pending |
| Export PDF | Low | Medium | P3 | Pending |
| Real-time Updates | Medium | High | P3 | Pending |
| Notifications | Low | Medium | P4 | Pending |

---

## 🔧 Technical Stack Additions

### Backend:
- **python-jose** - JWT encoding/decoding
- **passlib[bcrypt]** - Password hashing
- **python-multipart** - Form data handling
- **reportlab** - PDF generation
- **websockets** - WebSocket support (built into FastAPI)

### Frontend:
- **No new dependencies needed** (all can be built with existing stack)
- Optional: **react-hot-toast** for notifications (if preferred over custom)

---

## 🧪 Testing Strategy

### Authentication:
- [ ] User can sign up
- [ ] User can log in
- [ ] Token is stored and sent with requests
- [ ] Protected routes redirect to login
- [ ] Logout clears token
- [ ] Role-based access works

### Search & Filters:
- [ ] Search returns matching results
- [ ] Filters apply correctly
- [ ] Pagination works
- [ ] Sorting works

### Real-time:
- [ ] WebSocket connection established
- [ ] Events trigger updates
- [ ] Reconnect on disconnect

### Error Handling:
- [ ] Errors are caught and displayed
- [ ] App doesn't crash on errors
- [ ] Loading states show during data fetch

---

## 📝 Success Criteria

Phase 3 is complete when:
- ✅ Users can log in and authenticate
- ✅ All tables have search, filter, and pagination
- ✅ Data can be exported to CSV
- ✅ Error boundaries prevent crashes
- ✅ Loading states provide feedback
- ✅ (Optional) Real-time updates working
- ✅ (Optional) Notifications working

---

## 🚀 Getting Started

**Step 1**: Start with Authentication (most foundational)
**Step 2**: Add Search/Filters/Pagination (quick wins)
**Step 3**: Add Error Handling & Loading States (polish)
**Step 4**: Add Export (value-add)
**Step 5**: Add Real-time features (advanced)

---

**Ready to begin Phase 3!**
