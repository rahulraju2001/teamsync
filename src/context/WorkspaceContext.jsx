/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const WorkspaceContext = createContext(null);

const initialProjects = [
  {
    id: 1,
    name: "E-commerce Website",
    description: "Building an online shopping platform",
    status: "In Progress",
    deadline: "2026-12-15",
    members: ["R", "A", "J"],
    createdAt: "2026-10-20T09:00:00.000Z",
  },
  {
    id: 2,
    name: "Team Collaboration App",
    description: "Developing team management features",
    status: "In Progress",
    deadline: "2026-12-17",
    members: ["R", "M"],
    createdAt: "2026-10-22T09:00:00.000Z",
  },
  {
    id: 3,
    name: "Portfolio Website",
    description: "Personal portfolio redesign",
    status: "Completed",
    deadline: "2026-12-19",
    members: ["R", "A"],
    createdAt: "2026-10-24T09:00:00.000Z",
  },
  {
    id: 4,
    name: "Mobile Banking App",
    description: "Designing a secure banking experience",
    status: "On Hold",
    deadline: "2026-12-28",
    members: ["R", "J", "M"],
    createdAt: "2026-10-26T09:00:00.000Z",
  },
];

const initialTasks = [
  {
    id: 101,
    projectId: 1,
    title: "Design homepage",
    description: "Create the responsive homepage layout and visual system.",
    status: "Completed",
    priority: "High",
    assignee: "R",
    dueDate: "2026-11-05",
    comments: [
      {
        id: 1001,
        author: "Rahul",
        text: "The first design draft is ready.",
        createdAt: "2026-11-01T10:00:00.000Z",
      },
    ],
    createdAt: "2026-10-28T09:00:00.000Z",
  },
  {
    id: 102,
    projectId: 1,
    title: "Build authentication",
    description: "Implement registration, login and protected routes.",
    status: "In Progress",
    priority: "High",
    assignee: "A",
    dueDate: "2026-11-10",
    comments: [],
    createdAt: "2026-10-29T09:00:00.000Z",
  },
  {
    id: 103,
    projectId: 1,
    title: "Create product listing",
    description: "Build product cards, filters and pagination.",
    status: "To Do",
    priority: "Medium",
    assignee: "J",
    dueDate: "2026-11-12",
    comments: [],
    createdAt: "2026-10-30T09:00:00.000Z",
  },
  {
    id: 104,
    projectId: 2,
    title: "Create project workspace",
    description: "Set up the main workspace view.",
    status: "In Progress",
    priority: "Medium",
    assignee: "R",
    dueDate: "2026-11-14",
    comments: [],
    createdAt: "2026-11-01T09:00:00.000Z",
  },
  {
    id: 105,
    projectId: 2,
    title: "Add team invitations",
    description: "Allow workspace admins to invite teammates.",
    status: "To Do",
    priority: "Low",
    assignee: "M",
    dueDate: "2026-11-18",
    comments: [],
    createdAt: "2026-11-02T09:00:00.000Z",
  },
];

const initialTeamMembers = [
  {
    id: 1,
    name: "Rahul",
    email: "rahul@example.com",
    role: "Administrator",
    initials: "R",
  },
  {
    id: 2,
    name: "Ananya",
    email: "ananya@example.com",
    role: "Member",
    initials: "A",
  },
  {
    id: 3,
    name: "John",
    email: "john@example.com",
    role: "Member",
    initials: "J",
  },
  {
    id: 4,
    name: "Meera",
    email: "meera@example.com",
    role: "Member",
    initials: "M",
  },
];

const STORAGE_KEY = "workspace-app-data-v1";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("workspace-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "API request failed.");
  return data;
}

const normalizeProject = (project) => ({
  ...project,
  id: project._id || project.id,
});
const normalizeTask = (task) => ({
  ...task,
  id: task._id || task.id,
  projectId: task.project?._id || task.project || task.projectId,
  assignee: task.assignee || null,
  assigneeId:
    task.assignee && typeof task.assignee === "object"
      ? String(task.assignee._id || task.assignee.id)
      : typeof task.assignee === "string" && /^[a-f0-9]{24}$/i.test(task.assignee)
        ? task.assignee
        : null,
  comments: (task.comments || []).map((comment) => ({
    ...comment,
    id: comment._id || comment.id,
    author:
      typeof comment.author === "string"
        ? comment.author
        : comment.author?.name || "Team member",
    createdAt: comment.createdAt || comment.updatedAt,
  })),
});


function readStoredData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { projects: initialProjects, tasks: initialTasks };
    const parsed = JSON.parse(stored);
    return {
      projects: Array.isArray(parsed.projects)
        ? parsed.projects
        : initialProjects,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : initialTasks,
    };
  } catch {
    return { projects: initialProjects, tasks: initialTasks };
  }
}

export function WorkspaceProvider({ children }) {
  const [data, setData] = useState(readStoredData);
  const [token, setToken] = useState(() =>
    localStorage.getItem("workspace-token"),
  );
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("workspace-user"));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const syncAuth = () => {
      setToken(localStorage.getItem("workspace-token"));
      try {
        setCurrentUser(JSON.parse(localStorage.getItem("workspace-user")));
      } catch {
        setCurrentUser(null);
      }
    };
    window.addEventListener("workspace-auth-changed", syncAuth);
    return () => window.removeEventListener("workspace-auth-changed", syncAuth);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      apiRequest("/projects"),
      apiRequest("/tasks"),
      apiRequest("/workspace"),
      apiRequest("/auth/me"),
      apiRequest("/workspace/list"),
    ])
      .then(
        ([
          projectResult,
          taskResult,
          workspaceResult,
          meResult,
          workspaceListResult,
        ]) => {
          if (cancelled) return;

          setData({
            projects: (projectResult.projects || []).map(normalizeProject),
            tasks: (taskResult.tasks || []).map(normalizeTask),
          });

          const members = (workspaceResult.members || []).map((member) => ({
            ...member,
            initials: (member.name || "?")
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
          }));

          setTeamMembers(members);

          setWorkspaceInfo({
            ...workspaceResult.workspace,
            role: workspaceResult.role,
            invitations: workspaceResult.invitations || [],
          });

          setWorkspaces(workspaceListResult.workspaces || []);

          setCurrentUser(meResult.user);
          localStorage.setItem("workspace-user", JSON.stringify(meResult.user));
        },
      )
      .catch((error) => console.error("Could not load workspace data:", error));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const addProject = async (projectData) => {
    if (token) {
      const result = await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify(projectData),
      });
      const project = normalizeProject(result.project);
      setData((current) => ({
        ...current,
        projects: [project, ...current.projects],
      }));
      return project;
    }
    const project = {
      ...projectData,
      id: Date.now(),
      status: projectData.status || "In Progress",
      members: projectData.members || ["R"],
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      projects: [project, ...current.projects],
    }));
    return project;
  };

  const updateProject = async (projectId, updates) => {
    if (token) {
      const result = await apiRequest(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      updates = normalizeProject(result.project);
    }
    setData((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        String(project.id) === String(projectId)
          ? { ...project, ...updates }
          : project,
      ),
    }));
  };

  const deleteProject = async (projectId) => {
    if (token) await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
    setData((current) => ({
      projects: current.projects.filter(
        (project) => String(project.id) !== String(projectId),
      ),
      tasks: current.tasks.filter(
        (task) => String(task.projectId) !== String(projectId),
      ),
    }));
  };

  const addTask = async (taskData) => {
    if (token) {
      const result = await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({ ...taskData, projectId: taskData.projectId }),
      });
      const task = normalizeTask(result.task);
      setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
      return task;
    }
    const task = {
      ...taskData,
      id: Date.now() + Math.floor(Math.random() * 1000),
      comments: taskData.comments || [],
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    return task;
  };

  const updateTask = async (taskId, updates) => {
    if (token) {
      const result = await apiRequest(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      updates = normalizeTask(result.task);
    }
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        String(task.id) === String(taskId) ? { ...task, ...updates } : task,
      ),
    }));
  };

  const deleteTask = async (taskId) => {
    if (token) await apiRequest(`/tasks/${taskId}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => String(task.id) !== String(taskId)),
    }));
  };

  const addComment = async (taskId, commentData) => {
    let comment = {
      ...commentData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    if (token) {
      const result = await apiRequest(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: commentData.text }),
      });
      const comments = (result.comments || []).map((item) => ({
        ...item,
        id: item._id,
        author: item.author?.name || "Team member",
      }));
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          String(task.id) === String(taskId) ? { ...task, comments } : task,
        ),
      }));
      return;
    }
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        String(task.id) === String(taskId)
          ? { ...task, comments: [...(task.comments || []), comment] }
          : task,
      ),
    }));
  };

  const refreshWorkspace = useCallback(async () => {
    const result = await apiRequest("/workspace");
    const members = (result.members || []).map((member) => ({
      ...member,
      initials: (member.name || "?")
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    }));
    setTeamMembers(members);
    setWorkspaceInfo({
      ...result.workspace,
      role: result.role,
      invitations: result.invitations || [],
    });
    setCurrentUser((current) => {
      const updated = current ? { ...current, role: result.role } : current;
      if (updated)
        localStorage.setItem("workspace-user", JSON.stringify(updated));
      return updated;
    });
    return result;
  }, []);

  const refreshWorkspaceData = useCallback(async () => {
    const [
      projectResult,
      taskResult,
      workspaceResult,
      meResult,
      workspaceListResult,
    ] = await Promise.all([
      apiRequest("/projects"),
      apiRequest("/tasks"),
      apiRequest("/workspace"),
      apiRequest("/auth/me"),
      apiRequest("/workspace/list"),
    ]);

    setData({
      projects: (projectResult.projects || []).map(normalizeProject),
      tasks: (taskResult.tasks || []).map(normalizeTask),
    });

    const members = (workspaceResult.members || []).map((member) => ({
      ...member,
      initials: (member.name || "?")
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    }));

    setTeamMembers(members);

    setWorkspaceInfo({
      ...workspaceResult.workspace,
      role: workspaceResult.role,
      invitations: workspaceResult.invitations || [],
    });

    setWorkspaces(workspaceListResult.workspaces || []);
    setCurrentUser(meResult.user);
    localStorage.setItem("workspace-user", JSON.stringify(meResult.user));
  }, []);

  const switchWorkspace = async (workspaceId) => {
    setNotifications([]);
    await apiRequest(`/workspace/switch/${workspaceId}`, {
      method: "POST",
    });

    await refreshWorkspaceData();
  };

  const createWorkspace = async (name) => {
    setNotifications([]);
    const result = await apiRequest("/workspace/create", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    await refreshWorkspaceData();

    return result.workspace;
  };

  const inviteMember = async (email) => {
    const result = await apiRequest("/workspace/invitations", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    await refreshWorkspace();
    return result;
  };

  const updateMemberRole = async (userId, role) => {
    await apiRequest(`/workspace/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    await refreshWorkspace();
  };

  const removeMember = async (userId) => {
    await apiRequest(`/workspace/members/${userId}`, { method: "DELETE" });
    await refreshWorkspace();
  };

  const renameWorkspace = async (name) => {
    const result = await apiRequest("/workspace", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setWorkspaceInfo((current) => ({ ...current, ...result.workspace }));
  };

  const refreshNotifications = async () => {
    if (!token) return;
    const result = await apiRequest("/notifications");
    setNotifications(result.notifications || []);
  };

  const markNotificationRead = async (notificationId) => {
    await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" });
    setNotifications((current) => current.map((item) =>
      String(item._id) === String(notificationId)
        ? { ...item, readAt: item.readAt || new Date().toISOString() }
        : item,
    ));
  };

  const markAllNotificationsRead = async () => {
    await apiRequest("/notifications/read-all", { method: "PATCH" });
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
  };

  const activeWorkspaceId = workspaceInfo?._id || workspaceInfo?.id;

  useEffect(() => {
    if (!token || !activeWorkspaceId) return undefined;

    let disposed = false;
    apiRequest("/notifications")
      .then((result) => {
        if (!disposed) {
          setNotifications((current) => {
            const merged = new Map((result.notifications || []).map((item) => [String(item._id), item]));
            current.forEach((item) => merged.set(String(item._id), merged.get(String(item._id)) || item));
            return [...merged.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
          });
        }
      })
      .catch((error) => console.error("Could not load notifications:", error));

    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
    });

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", (error) => {
      setSocketConnected(false);
      console.warn("Live connection unavailable:", error.message);
    });
    socket.on("workspace:changed", () => {
      setNotifications([]);
      refreshWorkspaceData().catch((error) =>
        console.error("Could not sync the active workspace:", error),
      );
    });
    socket.on("notification:new", (notification) => {
      setNotifications((current) => [
        notification,
        ...current.filter((item) => String(item._id) !== String(notification._id)),
      ].slice(0, 100));
    });
    const syncWorkspaceData = (event) => {
      if (String(event.workspaceId) !== String(activeWorkspaceId)) return;
      refreshWorkspaceData().catch((error) =>
        console.error("Could not sync live workspace changes:", error),
      );
    };
    socket.on("task:changed", syncWorkspaceData);
    socket.on("project:changed", syncWorkspaceData);

    return () => {
      disposed = true;
      socket.disconnect();
    };
  }, [token, activeWorkspaceId, refreshWorkspaceData]);

  const value = {
      projects: data.projects,
      tasks: data.tasks,
      teamMembers,
      workspaceInfo,
      currentUser,
      isAdmin: workspaceInfo
        ? workspaceInfo.role === "Administrator"
        : currentUser?.role === "Administrator",
      refreshWorkspace,
      inviteMember,
      updateMemberRole,
      removeMember,
      renameWorkspace,
      workspaces,
      switchWorkspace,
      createWorkspace,
      notifications,
      unreadNotificationCount: notifications.filter((item) => !item.readAt).length,
      socketConnected,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      deleteTask,
      addComment,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
