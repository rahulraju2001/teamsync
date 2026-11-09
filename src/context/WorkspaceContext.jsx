/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const WorkspaceContext = createContext(null);

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


export function WorkspaceProvider({ children }) {
  const [data, setData] = useState({ projects: [], tasks: [] });
  const [token, setToken] = useState(() =>
    localStorage.getItem("workspace-token"),
  );
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersStatus, setTeamMembersStatus] = useState(() =>
    localStorage.getItem("workspace-token") ? "loading" : "idle",
  );
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    if (!localStorage.getItem("workspace-token")) return null;
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
      if (localStorage.getItem("workspace-token")) {
        setTeamMembersStatus("loading");
      } else {
        setData({ projects: [], tasks: [] });
        setTeamMembers([]);
        setTeamMembersStatus("idle");
        setWorkspaceInfo(null);
        setWorkspaces([]);
        setNotifications([]);
        setCurrentUser(null);
        localStorage.removeItem("workspace-user");
      }
    };
    window.addEventListener("workspace-auth-changed", syncAuth);
    return () => window.removeEventListener("workspace-auth-changed", syncAuth);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
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
          setTeamMembersStatus("loaded");

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
      .catch((error) => {
        if (cancelled) return;
        setTeamMembers([]);
        setTeamMembersStatus("error");
        console.error("Could not load workspace data:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const addProject = async (projectData) => {
    const result = await apiRequest("/projects", {
      method: "POST",
      body: JSON.stringify(projectData),
    });
    const project = normalizeProject(result.project);
    setData((current) => ({ ...current, projects: [project, ...current.projects] }));
    return project;
  };

  const updateProject = async (projectId, updates) => {
    const result = await apiRequest(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    const project = normalizeProject(result.project);
    setData((current) => ({
      ...current,
      projects: current.projects.map((item) => String(item.id) === String(projectId) ? project : item),
    }));
  };

  const deleteProject = async (projectId) => {
    await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
    setData((current) => ({
      projects: current.projects.filter((project) => String(project.id) !== String(projectId)),
      tasks: current.tasks.filter((task) => String(task.projectId) !== String(projectId)),
    }));
  };

  const addTask = async (taskData) => {
    const result = await apiRequest("/tasks", {
      method: "POST",
      body: JSON.stringify({ ...taskData, projectId: taskData.projectId }),
    });
    const task = normalizeTask(result.task);
    setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    return task;
  };

  const updateTask = async (taskId, updates) => {
    const result = await apiRequest(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    const task = normalizeTask(result.task);
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => String(item.id) === String(taskId) ? task : item),
    }));
  };

  const deleteTask = async (taskId) => {
    await apiRequest(`/tasks/${taskId}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => String(task.id) !== String(taskId)),
    }));
  };

  const addComment = async (taskId, commentData) => {
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
      tasks: current.tasks.map((task) => String(task.id) === String(taskId) ? { ...task, comments } : task),
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
    setTeamMembersStatus("loaded");
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
    setTeamMembersStatus("loaded");

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

  const leaveWorkspace = async () => {
    await apiRequest("/workspace/leave", { method: "POST" });
    setNotifications([]);
    await refreshWorkspaceData();
  };

  const transferWorkspaceOwnership = async (userId) => {
    const result = await apiRequest("/workspace/transfer-ownership", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    await refreshWorkspaceData();
    return result;
  };

  const deleteWorkspace = async () => {
    await apiRequest("/workspace", { method: "DELETE" });
    setNotifications([]);
    await refreshWorkspaceData();
  };

  const renameWorkspace = async (name) => {
    const result = await apiRequest("/workspace", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setWorkspaceInfo((current) => ({ ...current, ...result.workspace }));
  };

  const updateProfile = async (name) => {
    const result = await apiRequest("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setCurrentUser(result.user);
    localStorage.setItem("workspace-user", JSON.stringify(result.user));
    await refreshWorkspaceData();
    return result.user;
  };

  const updateNotificationPreferences = async (preferences) => {
    const result = await apiRequest("/auth/preferences", {
      method: "PATCH",
      body: JSON.stringify(preferences),
    });
    setCurrentUser((current) => {
      const updated = current ? { ...current, notificationPreferences: result.notificationPreferences } : current;
      if (updated) localStorage.setItem("workspace-user", JSON.stringify(updated));
      return updated;
    });
    return result.notificationPreferences;
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
    socket.on("workspace:changed", (event = {}) => {
      const deletedDifferentWorkspace =
        event.action === "deleted" &&
        String(event.deletedWorkspaceId) !== String(activeWorkspaceId);

      // A workspace can be deleted while this user is active in another one.
      // Refresh the workspace list without clearing notifications in that case.
      if (event.action !== "ownership_transferred" && !deletedDifferentWorkspace) {
        setNotifications([]);
      }
      refreshWorkspaceData().catch((error) =>
        console.error("Could not sync workspace changes:", error),
      );
    });
    socket.on("workspace:member_changed", () => {
      refreshWorkspaceData().catch((error) =>
        console.error("Could not sync workspace members:", error),
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
      teamMembersStatus,
      workspaceInfo,
      currentUser,
      updateProfile,
      updateNotificationPreferences,
      isAdmin: workspaceInfo
        ? workspaceInfo.role === "Administrator"
        : currentUser?.role === "Administrator",
      refreshWorkspace,
      inviteMember,
      updateMemberRole,
      removeMember,
      renameWorkspace,
      leaveWorkspace,
      transferWorkspaceOwnership,
      deleteWorkspace,
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
