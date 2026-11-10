import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Columns3,
  GripVertical,
  LayoutList,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import ActionDialog from "../../components/ui/ActionDialog";

const emptyTask = {
  title: "",
  description: "",
  priority: "Medium",
  status: "To Do",
  dueDate: "",
  assigneeId: "",
};

const statusColumns = ["To Do", "In Progress", "Completed"];

const sortTaskItems = (items, sort) => [...items].sort((a, b) => {
  if (sort === "dueDate") {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  }
  if (sort === "priority") {
    return (
      ({ High: 1, Medium: 2, Low: 3 }[a.priority] || 4) -
      ({ High: 1, Medium: 2, Low: 3 }[b.priority] || 4)
    );
  }
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
});

function ProjectDetails() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const {
    projects,
    tasks,
    teamMembers,
    teamMembersStatus,
    currentUser,
    addTask,
    updateTask,
    deleteTask,
    addComment,
    updateProject,
    isAdmin,
    socketConnected,
  } = useWorkspace();

  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const project = projects.find((item) => String(item.id) === String(projectId));
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const todayKey = today.toISOString().split("T")[0];
  const projectTasks = useMemo(
    () => tasks.filter((task) => String(task.projectId) === String(projectId)),
    [tasks, projectId],
  );

  const [viewMode, setViewMode] = useState("list");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [dialog, setDialog] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dropTargetStatus, setDropTargetStatus] = useState(null);
  const [movingTaskIds, setMovingTaskIds] = useState(() => new Set());

  const isAssignedToCurrentUser = (task) => {
    const assigneeId =
      task.assigneeId ||
      task.assignee?._id ||
      (typeof task.assignee === "string" ? task.assignee : "");
    return String(assigneeId) === currentUserId;
  };
  const canUpdateTaskStatus = (task) => isAdmin || isAssignedToCurrentUser(task);
  const canCommentOnTask = (task) => isAdmin || isAssignedToCurrentUser(task);

  const searchedTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projectTasks.filter((task) => !query || task.title.toLowerCase().includes(query));
  }, [projectTasks, search]);

  const filteredTasks = useMemo(
    () => sortTaskItems(
      searchedTasks.filter((task) => statusFilter === "All" || task.status === statusFilter),
      sort,
    ),
    [searchedTasks, statusFilter, sort],
  );
  const boardTasks = useMemo(
    () => sortTaskItems(searchedTasks, sort),
    [searchedTasks, sort],
  );

  const tasksPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / tasksPerPage));
  const paginatedTasks = filteredTasks.slice((page - 1) * tasksPerPage, page * tasksPerPage);
  const completedTasks = projectTasks.filter((task) => task.status === "Completed").length;
  const progress = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
  const selectedTask = projectTasks.find((task) => String(task.id) === String(selectedTaskId));

  const formatDate = (date) => {
    if (!date) return "No deadline";
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "No deadline";
    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue = (date) => {
    if (!date) return false;
    const due = new Date(`${date}T00:00:00`);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };
  const projectOverdue = Boolean(
    project && project.status !== "Completed" && isOverdue(project.deadline),
  );

  const getAssigneeInfo = (task) => {
    const assignee = task.assignee;
    if (assignee && typeof assignee === "object") {
      return {
        name: assignee.name || "Workspace member",
        id: String(assignee._id || assignee.id || task.assigneeId || ""),
      };
    }
    const member = teamMembers.find(
      (item) =>
        String(item.id || item._id) === String(task.assigneeId || assignee || "") ||
        item.initials === assignee,
    );
    return member
      ? { name: member.name, id: String(member.id || member._id || "") }
      : { name: "Unassigned", id: "" };
  };

  const getInitials = (name) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  const statusStyles = {
    "To Do": "bg-slate-100 text-slate-700",
    "In Progress": "bg-primary-50 text-primary-700",
    Completed: "bg-green-50 text-green-700",
  };
  const priorityStyles = {
    High: "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-green-50 text-green-700",
  };

  const openCreateModal = () => {
    if (!isAdmin) return;
    setEditingTaskId(null);
    setTaskForm({ ...emptyTask, assigneeId: "" });
    setIsTaskModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate || "",
      assigneeId:
        task.assigneeId ||
        task.assignee?._id ||
        teamMembers.find((member) => member.initials === task.assignee)?.id ||
        "",
    });
    setIsTaskModalOpen(true);
  };

  const handleTaskSubmit = async (event) => {
    event.preventDefault();
    if (!taskForm.dueDate) {
      setDialog({
        variant: "alert",
        title: "Due date required",
        message: "Please select a due date for this task.",
      });
      return;
    }
    if (taskForm.dueDate < todayKey) {
      setDialog({
        variant: "alert",
        title: "Invalid task due date",
        message: "A task's due date cannot be earlier than today.",
      });
      return;
    }
    if (project?.deadline && taskForm.dueDate > project.deadline) {
      setDialog({
        variant: "alert",
        title: "Invalid task due date",
        message: "A task's due date cannot be later than its project deadline.",
      });
      return;
    }
    const payload = {
      ...taskForm,
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      assigneeId: taskForm.assigneeId || null,
    };
    try {
      if (editingTaskId) await updateTask(editingTaskId, payload);
      else await addTask({ ...payload, projectId });
      setIsTaskModalOpen(false);
      setEditingTaskId(null);
      setTaskForm(emptyTask);
    } catch (error) {
      setDialog({
        variant: "alert",
        title: "Could not save task",
        message: error.message || "Please try again.",
      });
    }
  };

  const handleTaskStatusChange = async (task, nextStatus) => {
    if (
      task.status === nextStatus ||
      !statusColumns.includes(nextStatus) ||
      !canUpdateTaskStatus(task) ||
      movingTaskIds.has(String(task.id))
    ) {
      return;
    }

    const taskKey = String(task.id);
    setMovingTaskIds((current) => new Set(current).add(taskKey));
    try {
      await updateTask(task.id, { status: nextStatus });
    } catch (error) {
      setDialog({
        variant: "alert",
        title: "Could not move task",
        message: error.message || "The task status could not be updated. Please try again.",
      });
    } finally {
      setMovingTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskKey);
        return next;
      });
    }
  };

  const handleDragStart = (event, task) => {
    if (!canUpdateTaskStatus(task) || movingTaskIds.has(String(task.id))) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(task.id));
    setDraggedTaskId(String(task.id));
  };

  const handleDrop = (event, nextStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const task = projectTasks.find((item) => String(item.id) === String(taskId));
    setDraggedTaskId(null);
    setDropTargetStatus(null);
    if (task) void handleTaskStatusChange(task, nextStatus);
  };

  const handleDeleteTask = (task) => {
    setDialog({
      variant: "danger",
      title: "Delete task?",
      message: `Are you sure you want to delete “${task.title}”? This action cannot be undone.`,
      confirmLabel: "Delete task",
      onConfirm: async () => {
        setDialogBusy(true);
        try {
          await deleteTask(task.id);
          setDialog(null);
        } catch (error) {
          setDialog({
            variant: "alert",
            title: "Could not delete task",
            message: error.message || "Please try again.",
          });
        } finally {
          setDialogBusy(false);
        }
      },
    });
  };

  const handleAddComment = (event) => {
    event.preventDefault();
    if (!commentText.trim() || !selectedTask) return;
    addComment(selectedTask.id, { text: commentText.trim() })
      .then(() => setCommentText(""))
      .catch((error) =>
        setDialog({
          variant: "alert",
          title: "Could not add comment",
          message: error.message || "Please try again.",
        }),
      );
  };

  if (teamMembersStatus === "loading") {
    return (
      <div className="rounded-xl border border-border bg-white p-8" role="status" aria-live="polite">
        <p className="text-sm text-muted">Loading project...</p>
      </div>
    );
  }

  if (teamMembersStatus === "error") {
    return (
      <div className="rounded-xl border border-border bg-white p-8">
        <h1 className="text-xl font-semibold text-heading">Could not load project</h1>
        <p className="mt-2 text-sm text-muted">Please check your connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-primary-600"
        >
          Try again
        </button>
        <button
          onClick={() => navigate("/projects")}
          className="ml-4 mt-4 text-sm font-medium text-primary-600"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-border bg-white p-8">
        <h1 className="text-xl font-semibold text-heading">Project not found</h1>
        <p className="mt-2 text-sm text-muted">This project may have been deleted or you may not have access to it.</p>
        <button
          onClick={() => navigate("/projects")}
          className="mt-4 text-sm font-medium text-primary-600"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const renderTaskActions = (task) => (
    <div className="flex shrink-0 items-center gap-1">
      <select
        aria-label={`Change status for ${task.title}`}
        value={task.status}
        disabled={!canUpdateTaskStatus(task) || movingTaskIds.has(String(task.id))}
        onChange={(event) => void handleTaskStatusChange(task, event.target.value)}
        className="rounded-md border border-border bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted"
      >
        {statusColumns.map((status) => <option key={status}>{status}</option>)}
      </select>
      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => openEditModal(task)}
            className="rounded-md p-2 text-muted hover:bg-primary-50 hover:text-primary-700"
            title="Edit task"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteTask(task)}
            className="rounded-md p-2 text-muted hover:bg-red-50 hover:text-red-600"
            title="Delete task"
          >
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );

  const renderBoardCard = (task) => {
    const assignee = getAssigneeInfo(task);
    const overdue = isOverdue(task.dueDate) && task.status !== "Completed";
    const isMoving = movingTaskIds.has(String(task.id));
    const canDrag = canUpdateTaskStatus(task) && !isMoving;

    return (
      <article
        key={task.id}
        draggable={canDrag}
        onDragStart={(event) => handleDragStart(event, task)}
        onDragEnd={() => {
          setDraggedTaskId(null);
          setDropTargetStatus(null);
        }}
        className={`rounded-xl border bg-white p-4 shadow-sm transition ${
          draggedTaskId === String(task.id)
            ? "border-primary-300 opacity-50"
            : "border-border hover:border-primary-200 hover:shadow-md"
        } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${isMoving ? "opacity-60" : ""}`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {canDrag && <GripVertical size={16} className="shrink-0 text-slate-300" aria-hidden="true" />}
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${priorityStyles[task.priority] || priorityStyles.Medium}`}>
              {task.priority || "Medium"}
            </span>
          </div>
          {isMoving ? (
            <span className="text-[11px] font-medium text-primary-700">Moving…</span>
          ) : (
            <span className="text-[11px] text-muted">{(task.comments || []).length} comments</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSelectedTaskId(task.id)}
          className="block w-full text-left"
        >
          <h3 className="break-words text-sm font-semibold leading-5 text-heading">{task.title}</h3>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-body">{task.description}</p>
          )}
        </button>

        {canUpdateTaskStatus(task) && (
          <div className="mt-3 border-t border-border pt-3" onClick={(event) => event.stopPropagation()}>
            <label className="mb-1 block text-[11px] font-medium text-muted" htmlFor={`board-status-${task.id}`}>
              Move task to
            </label>
            <select
              id={`board-status-${task.id}`}
              aria-label={`Move ${task.title} to another status`}
              value={task.status}
              disabled={isMoving}
              onChange={(event) => void handleTaskStatusChange(task, event.target.value)}
              className="min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {statusColumns.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex min-w-0 items-center gap-2" title={assignee.name}>
            {assignee.id ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                {getInitials(assignee.name)}
              </span>
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <UserRound size={14} />
              </span>
            )}
            <span className="truncate text-xs text-body">{assignee.name}</span>
          </div>
          <div className={`flex shrink-0 items-center gap-1 text-[11px] ${overdue ? "font-semibold text-red-600" : "text-muted"}`}>
            <CalendarDays size={13} />
            <span>{task.dueDate ? `${overdue ? "Overdue · " : ""}${formatDate(task.dueDate)}` : "No due date"}</span>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-3 flex justify-end gap-1 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => openEditModal(task)}
              className="rounded-md p-1.5 text-muted hover:bg-primary-50 hover:text-primary-700"
              title="Edit task"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteTask(task)}
              className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
              title="Delete task"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            onClick={() => navigate("/projects")}
            className="mb-3 inline-flex items-center gap-2 text-sm text-body hover:text-primary-600"
          >
            <ArrowLeft size={16} /> Back to Projects
          </button>
          <p className="mb-1 text-sm text-muted">Projects / {project.name}</p>
          <h1 className="text-2xl font-bold text-heading">{project.name}</h1>
          <p className="mt-1 text-sm text-body">{project.description || "No description provided."}</p>
        </div>
        {isAdmin ? (
          <select
            aria-label="Project status"
            value={project.status}
            onChange={(event) => updateProject(project.id, { status: event.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option>In Progress</option>
            <option>Completed</option>
            <option>On Hold</option>
          </select>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">{project.status}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Project status</p>
          <p className="mt-2 text-lg font-semibold text-heading">{project.status}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex justify-between text-sm">
            <p className="text-muted">Task progress</p>
            <p className="font-semibold text-heading">{progress}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary-600" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">{completedTasks} of {projectTasks.length} tasks completed</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Deadline</p>
          <p className={`mt-2 text-lg font-semibold ${projectOverdue ? "text-red-600" : "text-heading"}`}>{formatDate(project.deadline)}</p>{projectOverdue && <span className="mt-2 inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Overdue</span>}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-heading">Project Tasks</h2>
            <p className="mt-1 text-sm text-muted">Create, assign and track work for this project.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-slate-50 p-1" aria-label="Task view">
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${viewMode === "list" ? "bg-white text-primary-700 shadow-sm" : "text-body hover:text-heading"}`}
              >
                <LayoutList size={16} /> List
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "board"}
                onClick={() => setViewMode("board")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${viewMode === "board" ? "bg-white text-primary-700 shadow-sm" : "text-body hover:text-heading"}`}
              >
                <Columns3 size={16} /> Board
              </button>
            </div>
            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus size={17} /> Add Task
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tasks..."
            className="min-w-0 flex-1 rounded-lg border border-border px-4 py-2 text-sm outline-none focus:border-primary-500"
          />
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="default">Default order</option>
            <option value="dueDate">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        {viewMode === "list" ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {["All", ...statusColumns].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === status ? "bg-primary-600 text-white" : "bg-slate-100 text-body hover:bg-slate-200"}`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {paginatedTasks.length ? (
                paginatedTasks.map((task) => (
                  <div key={task.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={() => setSelectedTaskId(task.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-heading">{task.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[task.status]}`}>{task.status}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>{task.priority}</span>
                        {isOverdue(task.dueDate) && task.status !== "Completed" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Overdue</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Assigned to {getAssigneeInfo(task).name} · <span className={isOverdue(task.dueDate) && task.status !== "Completed" ? "font-semibold text-red-600" : ""}>{task.dueDate ? `${isOverdue(task.dueDate) && task.status !== "Completed" ? "Overdue · " : "Due "}${formatDate(task.dueDate)}` : "No due date"}</span> · {(task.comments || []).length} comments
                      </p>
                    </button>
                    {renderTaskActions(task)}
                  </div>
                ))
              ) : (
                <div className="rounded-lg bg-slate-50 p-8 text-center">
                  <p className="font-medium text-heading">No tasks found</p>
                  <p className="mt-1 text-sm text-muted">Create a task or adjust your filters.</p>
                </div>
              )}
            </div>

            {filteredTasks.length > tasksPerPage && (
              <div className="mt-5 flex items-center justify-between">
                <button disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
                <span className="text-sm text-muted">Page {page} of {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                On desktop, drag cards between columns. On touchscreens, use the status selector on each card. {isAdmin ? "You can move any task." : "You can move tasks assigned to you."}
              </p>
              <span className={`inline-flex items-center gap-1.5 text-xs ${socketConnected ? "text-green-700" : "text-muted"}`}>
                <span className={`h-2 w-2 rounded-full ${socketConnected ? "bg-green-500" : "bg-slate-300"}`} />
                {socketConnected ? "Live updates connected" : "Reconnecting to live updates…"}
              </span>
            </div>

            {boardTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-slate-50 px-6 py-12 text-center">
                <Columns3 className="mx-auto text-muted" size={28} />
                <p className="mt-3 font-medium text-heading">No tasks to display</p>
                <p className="mt-1 text-sm text-muted">Create a task or change your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
                {statusColumns.map((status) => {
                  const columnTasks = boardTasks.filter((task) => task.status === status);
                  const isDropTarget = dropTargetStatus === status;
                  return (
                    <section
                      key={status}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTargetStatus((current) => current === status ? current : status);
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetStatus(null);
                      }}
                      onDrop={(event) => handleDrop(event, status)}
                      className={`min-h-64 rounded-xl border p-3 transition ${isDropTarget ? "border-primary-400 bg-primary-50/70" : "border-border bg-slate-50/80"}`}
                    >
                      <div className="mb-3 flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${status === "To Do" ? "bg-slate-400" : status === "In Progress" ? "bg-primary-600" : "bg-green-500"}`} />
                          <h3 className="text-sm font-semibold text-heading">{status}</h3>
                        </div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-muted shadow-sm">{columnTasks.length}</span>
                      </div>
                      <div className="space-y-3">
                        {columnTasks.map(renderBoardCard)}
                        {columnTasks.length === 0 && (
                          <div className={`flex min-h-28 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs ${isDropTarget ? "border-primary-300 text-primary-700" : "border-slate-200 text-muted"}`}>
                            {isDropTarget ? "Drop task here" : "No tasks in this column"}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsTaskModalOpen(false)}>
          <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-heading">{editingTaskId ? "Edit Task" : "Create Task"}</h2>
              <button onClick={() => setIsTaskModalOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-heading">Task title</label>
                <input required maxLength={100} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" placeholder="Enter task title" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-heading">Description</label>
                <textarea rows={3} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" placeholder="Describe the task" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-heading">Priority</label>
                  <select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"><option>Low</option><option>Medium</option><option>High</option></select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-heading">Status</label>
                  <select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm">{statusColumns.map((status) => <option key={status}>{status}</option>)}</select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-heading">Due date <span className="text-red-600">*</span></label>
                  <input type="date" required min={todayKey} max={project?.deadline || undefined} value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" />
                  <p className="mt-1 text-xs text-muted">Required. Choose today or a future date{project?.deadline ? `, on or before the project deadline (${formatDate(project.deadline)})` : ""}.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-heading">Assignee</label>
                  <select disabled={!isAdmin || teamMembersStatus !== "loaded"} value={taskForm.assigneeId} onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-muted">
                    <option value="">Unassigned</option>
                    {teamMembersStatus === "loading" && <option disabled>Loading workspace members...</option>}
                    {teamMembersStatus === "error" && <option disabled>Could not load members. Refresh the page.</option>}
                    {teamMembersStatus === "loaded" && teamMembers.length === 0 && <option disabled>No workspace members found</option>}
                    {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">{editingTaskId ? "Save Changes" : "Create Task"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => { setSelectedTaskId(null); setCommentText(""); }}>
          <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-heading">Task Details</h2>
              <button onClick={() => { setSelectedTaskId(null); setCommentText(""); }} aria-label="Close"><X size={20} /></button>
            </div>
            <h3 className="text-base font-semibold text-heading">{selectedTask.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-body">{selectedTask.description || "No description provided."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[selectedTask.status]}`}>{selectedTask.status}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityStyles[selectedTask.priority]}`}>{selectedTask.priority} priority</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted">Assignee</p><p className="mt-1 font-medium text-heading">{getAssigneeInfo(selectedTask).name}</p></div>
              <div><p className="text-muted">Due date</p><p className="mt-1 font-medium text-heading">{formatDate(selectedTask.dueDate)}</p></div>
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-heading"><MessageSquare size={17} />Comments ({(selectedTask.comments || []).length})</h4>
              <div className="mb-4 space-y-3">
                {(selectedTask.comments || []).length ? selectedTask.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-sm font-medium text-heading">{comment.author}</span>
                      <span className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-body">{comment.text}</p>
                  </div>
                )) : <p className="text-sm text-muted">No comments yet.</p>}
              </div>
              {canCommentOnTask(selectedTask) ? (
                <form onSubmit={handleAddComment} className="space-y-2">
                  <textarea rows={2} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Write a comment..." className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  <div className="flex justify-end"><button disabled={!commentText.trim()} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add comment</button></div>
                </form>
              ) : (
                <p className="text-xs text-muted">Only the assigned member or an Administrator can comment on this task.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ActionDialog
        open={Boolean(dialog)}
        variant={dialog?.variant || "danger"}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        busy={dialogBusy}
        onConfirm={dialog?.onConfirm}
        onClose={() => { if (!dialogBusy) setDialog(null); }}
      />
    </div>
  );
}

export default ProjectDetails;
