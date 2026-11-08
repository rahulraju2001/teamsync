# TeamSync – Project Management & Team Collaboration

A project management app built with React, Vite, Tailwind CSS, Express and MongoDB.

## Requirements
- Node.js 20.19+ or 22.12+
- MongoDB local installation or a MongoDB Atlas connection string

## 1. Start the backend

```bash
cd server
npm install
```

Copy `server/.env.example` to `server/.env`, then set `MONGODB_URI` and a long random `JWT_SECRET`.

```bash
npm run dev
```

The API runs at `http://localhost:5000`. Test it at `http://localhost:5000/api/health`.

## 2. Start the frontend

Open another terminal in the project root:

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

If your API uses another URL, copy `.env.example` to `.env` in the project root and update `VITE_API_URL`.

## Implemented
- Registration and login with bcrypt password hashing and JWT authentication
- Protected API endpoints
- Project create, read, update and delete
- Task create, read, update and delete
- Task status, priority, assignee, due date and comments
- Shared workspace state across Dashboard, Projects, Project Details and My Tasks
- Dashboard statistics calculated from the user's projects and tasks
- Project progress calculated from completed tasks
- Task search, filtering, sorting and pagination
- Team overview and profile settings UI

## Current limitations
- Invitations generate shareable links; they are not emailed automatically.
- Real-time updates, file attachments, email notifications and password reset are not implemented.
- Profile settings are currently stored in the browser rather than persisted through a profile API.

## Workspace roles and invitations

TeamSync uses workspace membership for authorization. Each person who registers normally becomes the Administrator of a new personal workspace. To collaborate, an Administrator creates an invitation link from the Team page and shares it with the teammate. The link expires after 7 days. The invited person must register or sign in with the email address the invitation was created for.

### Roles

- **Administrator:** rename the workspace; invite, remove and promote/demote members; create, edit and delete projects; edit and delete tasks; assign tasks.
- **Member:** view workspace projects; create tasks; update task statuses; add task comments. Members cannot create/edit/delete projects, delete tasks, edit task details or assign tasks.

Role checks are enforced by Express middleware and route handlers, not only by hiding frontend controls. A workspace always retains at least one Administrator, and the workspace owner cannot be removed or demoted.

### Important setup notes

- Keep the actual `server/.env` private and out of Git. Use `server/.env.example` as the template.
- Set `CLIENT_URL` to the frontend origin. Invitation links use this value.
- The invitation feature creates a shareable link; it does not send email automatically.
- Existing users are provisioned with a workspace on their next authenticated API request. Their older projects are attached to that workspace when they have no workspace assigned.
- A newly registered account becomes Administrator of its own workspace. To become a Member of another workspace, register through that workspace's invitation link or accept the link while signed in with the invited email address.

### Role / invitation API

- `GET /api/workspace` – workspace details, members, pending invitations and current role.
- `PATCH /api/workspace` – rename workspace (Administrator).
- `POST /api/workspace/invitations` – create a 7-day invitation link (Administrator).
- `POST /api/workspace/invitations/accept` – accept an invitation (authenticated user).
- `PATCH /api/workspace/members/:userId/role` – change a member's role (Administrator).
- `DELETE /api/workspace/members/:userId` – remove a member (Administrator).
