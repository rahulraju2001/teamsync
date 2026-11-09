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
- Team overview and account profile settings persisted through the backend
- Dashboard greeting uses the authenticated user profile
- Persistent per-user in-app and email-notification preferences
- Socket.IO real-time task and project updates
- Persistent in-app notifications for task assignment, reassignment and comments on assigned tasks
- Workspace-scoped, JWT-authenticated Socket.IO connections

## Current limitations
- Invitations generate shareable links; they are not emailed automatically.
- File attachments, email delivery for invitations, password reset and outbound email notifications are not implemented.
- Email notifications are stored as a preference only; outbound email delivery is not configured. Email address changes are disabled in Settings because the address is used for sign-in.
- Legacy task assignments must be migrated once from initials to User references; ambiguous initials are intentionally converted to Unassigned rather than guessed.

## Workspace roles and invitations

TeamSync uses workspace membership for authorization. Each person who registers normally becomes the Administrator of a new personal workspace. To collaborate, an Administrator creates an invitation link from the Team page and shares it with the teammate. The link expires after 7 days. The invited person must register or sign in with the email address the invitation was created for.

### Roles

- **Administrator:** rename the workspace; invite, remove and promote/demote members; create, edit and delete projects and tasks; assign and reassign tasks.
- **Member:** view all workspace projects and tasks; update the status and add comments only on tasks assigned to them. Members cannot create tasks, edit task details, reassign or delete tasks, or administer projects.

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

Project changes and task changes are broadcast to connected members of the active workspace. Assignment and reassignment notifications go to the affected assignees; comments on assigned tasks notify the assignee when another user comments. Notifications are stored per recipient and workspace and can be marked read individually or all at once.

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

Administrators can assign or unassign tasks using the workspace member list. Task API responses populate the assignee's name and email, while the database stores only the User ObjectId reference.

## Task permissions and notifications

- All workspace members can view all workspace tasks.
- Administrators can create, edit, assign/reassign, and delete any task.
- Members can change the status and add comments only on tasks assigned to them.
- Members cannot create tasks or edit task details, priority, due date, or assignment.
- Newly assigned users receive a persisted in-app notification. On reassignment, both the previous and new assignees are notified (unless the actor is the recipient).
- When another user comments on an assigned task, its assignee receives a persisted in-app notification.
- Notifications are stored in MongoDB and delivered live through Socket.IO when the recipient has enabled in-app notifications.
- Each user can persistently enable or disable in-app notifications and save an email-notification preference in Settings. The email preference does not send email until an email provider is configured.

These permissions are enforced by the Express API as well as reflected in the React interface.
