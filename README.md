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
- Task status, priority, due date and comments
- Task assignments stored as MongoDB User ObjectId references, with workspace-member validation and populated user details
- Shared workspace state across Dashboard, Projects, Project Details and My Tasks
- Dashboard statistics calculated from the user's projects and tasks
- Project progress calculated from completed tasks
- Task search, filtering, sorting and pagination
- Team overview and profile settings UI
- Socket.IO real-time task and project updates
- Persistent in-app notifications for task creation, updates, deletion and comments
- Workspace-scoped, JWT-authenticated Socket.IO connections

## Current limitations
- Invitations generate shareable links; they are not emailed automatically.
- File attachments, email delivery for invitations, password reset and email notifications are not implemented.
- Profile settings are currently stored in the browser rather than persisted through a profile API.
- Legacy task assignments must be migrated once from initials to User references; ambiguous initials are intentionally converted to Unassigned rather than guessed.

## Workspace roles and invitations

TeamSync uses workspace membership for authorization. Each person who registers normally becomes the Administrator of a new personal workspace. To collaborate, an Administrator creates an invitation link from the Team page and shares it with the teammate. The link expires after 7 days. The invited person must register or sign in with the email address the invitation was created for.

### Roles

- **Administrator:** rename the workspace; invite, remove and promote/demote members; create, edit and delete projects; edit and delete tasks; assign tasks.
- **Member:** view workspace projects; create tasks (automatically assigned to themselves); update task statuses; add task comments. Members cannot create/edit/delete projects, delete tasks, edit task details or reassign tasks.

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


## Real-time updates and notifications

Socket.IO is used for live task activity. The server authenticates each socket with the same JWT used by the REST API and derives the active workspace from the authenticated user record. Clients cannot choose workspace rooms themselves.

Project creation, updates and deletion, plus task creation, updates, deletion and comments, are broadcast to connected members of the active workspace. Persistent in-app notifications are stored per recipient and workspace and can be marked read individually or all at once.

Install dependencies after pulling or extracting this update:

```bash
# In the project root
npm install

# In the server folder
cd server
npm install
```


## Migrating task assignments

After updating an existing TeamSync installation to this version, run the one-time migration **before starting the updated backend**. It maps legacy initials to a unique member in each task's workspace. If initials match zero or multiple members, the task is left Unassigned so the migration never assigns work to the wrong person.

```bash
cd server
npm install
npm run migrate:assignees
```

The command uses `server/.env` and its `MONGODB_URI`. Back up your database first. The migration only updates legacy string-valued task `assignee` fields; it does not delete tasks or modify users. After it completes, start the backend normally with `npm run dev`.

Administrators can assign or unassign tasks using the workspace member list. Members who create tasks are automatically assigned those tasks themselves. Task API responses populate the assignee's name and email, while the database stores only the User ObjectId reference.
