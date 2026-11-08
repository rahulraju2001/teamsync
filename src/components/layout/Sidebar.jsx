import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Settings,
  Users,
  ChevronDown,
  BriefcaseBusiness,
  LogOut,
  Plus,
  Check,
  X,
} from "lucide-react";

function Sidebar({ isCollapsed, isMobileOpen, setIsMobileOpen }) {
  const navigate = useNavigate();

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [workspaceError, setWorkspaceError] = useState("");

  const {
    workspaceInfo,
    currentUser,
    workspaces,
    switchWorkspace,
    createWorkspace,
  } = useWorkspace();

  const userId = currentUser?._id || currentUser?.id;

  const getOwnerId = (workspace) =>
    typeof workspace.owner === "object"
      ? workspace.owner?._id
      : workspace.owner;

  const activeWorkspaceId = workspaceInfo?._id;
  
  const uniqueWorkspaces = Array.from(
    new Map(
      (workspaces || []).map((workspace) => [String(workspace._id), workspace]),
    ).values(),
  );
  const availableWorkspaces = uniqueWorkspaces.filter(
    (workspace) => String(workspace._id) !== String(activeWorkspaceId),
  );

  const ownedWorkspaces = availableWorkspaces.filter(
    (workspace) => String(getOwnerId(workspace)) === String(userId),
  );

  const teamWorkspaces = availableWorkspaces.filter(
    (workspace) => String(getOwnerId(workspace)) !== String(userId),
  );

  const userInitials =
    (currentUser?.name || "User")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Projects",
      path: "/projects",
      icon: FolderKanban,
    },
    {
      name: "My Tasks",
      path: "/tasks",
      icon: CheckSquare,
    },
    {
      name: "Team",
      path: "/team",
      icon: Users,
    },
  ];

  const handleSwitchWorkspace = async (workspaceId) => {
    if (!workspaceId || String(workspaceId) === String(activeWorkspaceId)) {
      setWorkspaceOpen(false);
      return;
    }

    try {
      setSwitchingId(workspaceId);
      setWorkspaceError("");

      await switchWorkspace(workspaceId);

      setWorkspaceOpen(false);
      setIsMobileOpen(false);
    } catch (error) {
      setWorkspaceError(error.message || "Could not switch workspace.");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCreateWorkspace = async (event) => {
    event.preventDefault();

    const trimmedName = workspaceName.trim();

    if (!trimmedName) {
      setWorkspaceError("Please enter a workspace name.");
      return;
    }

    if (trimmedName.length > 80) {
      setWorkspaceError("Workspace name cannot exceed 80 characters.");
      return;
    }

    try {
      setCreating(true);
      setWorkspaceError("");

      await createWorkspace(trimmedName);

      setWorkspaceName("");
      setCreateOpen(false);
      setWorkspaceOpen(false);
      setIsMobileOpen(false);
    } catch (error) {
      setWorkspaceError(error.message || "Could not create workspace.");
    } finally {
      setCreating(false);
    }
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setWorkspaceName("");
    setWorkspaceError("");
  };

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          w-64 min-h-screen bg-white text-slate-600
          flex flex-col border-r border-border
          transition-all duration-300
          ${isCollapsed ? "lg:w-20" : "lg:w-64"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:shrink-0
        `}
      >
        {/* Logo */}
        <div
          className={`h-16 flex items-center border-b border-border ${
            isCollapsed ? "justify-center px-0" : "px-6"
          }`}
        >
          <BriefcaseBusiness size={24} className="text-primary-600 shrink-0" />

          {!isCollapsed && (
            <span className="text-heading text-xl font-bold ml-3">
              TeamSync
            </span>
          )}
        </div>

        {/* Workspace selector */}
        <div className={isCollapsed ? "p-2" : "p-4"}>
          <button
            type="button"
            onClick={() => setWorkspaceOpen((open) => !open)}
            className={`w-full flex items-center rounded-lg bg-slate-50 hover:bg-slate-100 ${
              isCollapsed ? "justify-center p-2" : "justify-between p-3"
            }`}
          >
            <div
              className={`flex items-center ${
                isCollapsed ? "justify-center" : "gap-3 min-w-0"
              }`}
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold">
                {(workspaceInfo?.name || "T").charAt(0).toUpperCase()}
              </div>

              {!isCollapsed && (
                <div className="text-left min-w-0">
                  <p className="text-sm text-heading font-medium truncate">
                    {workspaceInfo?.name || "My Workspace"}
                  </p>

                  <p className="text-xs text-muted">
                    {workspaceInfo?.role || currentUser?.role || "Workspace"}
                  </p>
                </div>
              )}
            </div>

            {!isCollapsed && <ChevronDown size={16} />}
          </button>

          {workspaceOpen && !isCollapsed && (
            <div className="mt-2 p-2 bg-white border border-border rounded-lg shadow-md">
              {workspaceError && !createOpen && (
                <p className="text-xs text-red-600 px-2 py-1">
                  {workspaceError}
                </p>
              )}

              {/* Owned workspaces */}
              {ownedWorkspaces.length > 0 && (
                <>
                  <p className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    My Workspaces
                  </p>

                  {ownedWorkspaces.map((workspace) => (
                    <button
                      key={workspace._id}
                      type="button"
                      disabled={Boolean(switchingId)}
                      onClick={() => handleSwitchWorkspace(workspace._id)}
                      className="w-full flex items-center justify-between gap-2 p-2 text-sm text-left hover:bg-slate-50 rounded"
                    >
                      <span className="truncate">{workspace.name}</span>

                      {String(workspace._id) === String(activeWorkspaceId) && (
                        <Check
                          size={15}
                          className="text-primary-600 shrink-0"
                        />
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Workspaces joined through invitations */}
              {teamWorkspaces.length > 0 && (
                <>
                  <p className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    Team Workspaces
                  </p>

                  {teamWorkspaces.map((workspace) => (
                    <button
                      key={workspace._id}
                      type="button"
                      disabled={Boolean(switchingId)}
                      onClick={() => handleSwitchWorkspace(workspace._id)}
                      className="w-full flex items-center justify-between gap-2 p-2 text-sm text-left hover:bg-slate-50 rounded"
                    >
                      <span className="truncate">{workspace.name}</span>

                      {String(workspace._id) === String(activeWorkspaceId) ? (
                        <Check
                          size={15}
                          className="text-primary-600 shrink-0"
                        />
                      ) : switchingId === workspace._id ? (
                        <span className="text-xs text-muted">Switching...</span>
                      ) : null}
                    </button>
                  ))}
                </>
              )}

              {workspaces?.length === 0 && (
                <p className="px-2 py-2 text-xs text-muted">
                  No workspaces found.
                </p>
              )}

              <div className="border-t border-border mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceError("");
                    setCreateOpen(true);
                  }}
                  className="w-full flex items-center gap-2 p-2 text-sm text-primary-600 hover:bg-primary-50 rounded"
                >
                  <Plus size={16} />
                  Create Workspace
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2">
          {!isCollapsed && (
            <p className="text-xs uppercase tracking-wider text-muted px-3 mb-3">
              Menu
            </p>
          )}

          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center ${
                      isCollapsed ? "justify-center" : "gap-3"
                    } px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-primary-50 text-primary-600 font-medium"
                        : "text-slate-600 hover:bg-slate-50 hover:text-heading"
                    }`
                  }
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon size={19} />
                  {!isCollapsed && <span>{item.name}</span>}
                </NavLink>
              );
            })}
          </div>

          <div className="mt-8">
            {!isCollapsed && (
              <p className="text-xs uppercase tracking-wider text-muted px-3 mb-3">
                Preferences
              </p>
            )}

            <NavLink
              to="/settings"
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed ? "Settings" : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isCollapsed ? "justify-center" : "gap-3"
                } px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary-50 text-primary-600 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-heading"
                }`
              }
            >
              <Settings size={19} />
              {!isCollapsed && <span>Settings</span>}
            </NavLink>
          </div>
        </nav>

        {/* User profile */}
        <div
          className={`p-4 border-t border-border ${
            isCollapsed ? "flex justify-center" : ""
          }`}
        >
          <div
            className={`flex items-center ${
              isCollapsed ? "flex-col gap-3" : "justify-between gap-3"
            }`}
          >
            <div
              className="w-9 h-9 shrink-0 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold"
              title={currentUser?.name || "User"}
            >
              {userInitials}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm text-heading font-medium truncate">
                  {currentUser?.name || "User"}
                </p>

                <p className="text-xs text-muted">
                  {workspaceInfo?.role || currentUser?.role || "Member"}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("workspace-token");
                localStorage.removeItem("workspace-user");
                window.dispatchEvent(new Event("workspace-auth-changed"));
                navigate("/login");
              }}
              className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Create workspace dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-heading">
                Create workspace
              </h2>

              <button
                type="button"
                onClick={closeCreateDialog}
                disabled={creating}
                className="p-1 rounded hover:bg-slate-100 text-muted"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <label
                htmlFor="workspace-name"
                className="block text-sm font-medium text-heading mb-2"
              >
                Workspace name
              </label>

              <input
                id="workspace-name"
                type="text"
                autoFocus
                maxLength={80}
                value={workspaceName}
                onChange={(event) => {
                  setWorkspaceName(event.target.value);
                  setWorkspaceError("");
                }}
                placeholder="e.g. Development Team"
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />

              {workspaceError && (
                <p className="text-sm text-red-600 mt-2">{workspaceError}</p>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeCreateDialog}
                  disabled={creating}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
