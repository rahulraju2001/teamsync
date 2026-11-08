import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, X, MessageSquare } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";

const emptyTask = { title: "", description: "", priority: "Medium", status: "To Do", dueDate: "", assignee: "R" };

function ProjectDetails() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { projects, tasks, teamMembers, addTask, updateTask, deleteTask, addComment, updateProject, isAdmin } = useWorkspace();
  const project = projects.find((item) => String(item.id) === String(projectId));
  const projectTasks = useMemo(() => tasks.filter((task) => String(task.projectId) === String(projectId)), [tasks, projectId]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const tasksPerPage = 5;

  const filteredTasks = useMemo(() => projectTasks.filter((task) => {
    const matchesStatus = statusFilter === "All" || task.status === statusFilter;
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase().trim());
    return matchesStatus && matchesSearch;
  }), [projectTasks, statusFilter, search]);

  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    if (sort === "dueDate") {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (sort === "priority") return ({ High: 1, Medium: 2, Low: 3 }[a.priority] || 4) - ({ High: 1, Medium: 2, Low: 3 }[b.priority] || 4);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  }), [filteredTasks, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / tasksPerPage));
  const paginatedTasks = sortedTasks.slice((page - 1) * tasksPerPage, page * tasksPerPage);
  const completedTasks = projectTasks.filter((task) => task.status === "Completed").length;
  const progress = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
  const selectedTask = projectTasks.find((task) => task.id === selectedTaskId);

  const openCreateModal = () => { setEditingTaskId(null); setTaskForm(emptyTask); setIsTaskModalOpen(true); };
  const openEditModal = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({ title: task.title, description: task.description || "", priority: task.priority, status: task.status, dueDate: task.dueDate || "", assignee: task.assignee || "R" });
    setIsTaskModalOpen(true);
  };
  const handleTaskSubmit = (event) => {
    event.preventDefault();
    const payload = { ...taskForm, title: taskForm.title.trim(), description: taskForm.description.trim(), projectId: projectId };
    if (editingTaskId) updateTask(editingTaskId, payload); else addTask(payload);
    setIsTaskModalOpen(false); setEditingTaskId(null); setTaskForm(emptyTask);
  };
  const formatDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No deadline";
  const getAssigneeName = (initials) => teamMembers.find((member) => member.initials === initials)?.name || "Unassigned";
  const statusStyles = { "To Do": "bg-slate-100 text-slate-700", "In Progress": "bg-indigo-50 text-indigo-700", Completed: "bg-green-50 text-green-700" };
  const priorityStyles = { High: "bg-red-50 text-red-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-green-50 text-green-700" };

  if (!project) return <div className="rounded-xl border border-border bg-white p-8"><h1 className="text-xl font-semibold text-heading">Project not found</h1><button onClick={() => navigate("/projects")} className="mt-4 text-sm font-medium text-primary-600">Back to Projects</button></div>;

  const handleAddComment = (event) => {
    event.preventDefault();
    if (!commentText.trim() || !selectedTask) return;
    addComment(selectedTask.id, { author: "Rahul", text: commentText.trim() });
    setCommentText("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><button onClick={() => navigate("/projects")} className="mb-3 inline-flex items-center gap-2 text-sm text-body hover:text-primary-600"><ArrowLeft size={16} />Back to Projects</button><p className="mb-1 text-sm text-muted">Projects / {project.name}</p><h1 className="text-2xl font-bold text-heading">{project.name}</h1><p className="mt-1 text-sm text-body">{project.description || "No description provided."}</p></div>
        {isAdmin ? <select aria-label="Project status" value={project.status} onChange={(e) => updateProject(project.id, { status: e.target.value })} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><option>In Progress</option><option>Completed</option><option>On Hold</option></select> : <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">{project.status}</span>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5"><p className="text-sm text-muted">Project status</p><p className="mt-2 text-lg font-semibold text-heading">{project.status}</p></div>
        <div className="rounded-xl border border-border bg-white p-5"><div className="flex justify-between text-sm"><p className="text-muted">Task progress</p><p className="font-semibold text-heading">{progress}%</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary-600" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-muted">{completedTasks} of {projectTasks.length} tasks completed</p></div>
        <div className="rounded-xl border border-border bg-white p-5"><p className="text-sm text-muted">Deadline</p><p className="mt-2 text-lg font-semibold text-heading">{formatDate(project.deadline)}</p></div>
      </div>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-heading">Project Tasks</h2><p className="mt-1 text-sm text-muted">Create, assign and track work for this project.</p></div><button onClick={openCreateModal} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><Plus size={17} />Add Task</button></div>
        <div className="mb-4 flex flex-wrap gap-2">{["All", "To Do", "In Progress", "Completed"].map((status) => <button key={status} onClick={() => { setStatusFilter(status); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === status ? "bg-primary-600 text-white" : "bg-slate-100 text-body hover:bg-slate-200"}`}>{status}</button>)}</div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search tasks..." className="min-w-0 flex-1 rounded-lg border border-border px-4 py-2 text-sm outline-none focus:border-primary-500" /><select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><option value="default">Default order</option><option value="dueDate">Due date</option><option value="priority">Priority</option></select></div>

        <div className="space-y-3">{paginatedTasks.length ? paginatedTasks.map((task) => <div key={task.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><button onClick={() => setSelectedTaskId(task.id)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-heading">{task.title}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[task.status]}`}>{task.status}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>{task.priority}</span></div><p className="mt-1 text-xs text-muted">Assigned to {getAssigneeName(task.assignee)} · Due {formatDate(task.dueDate)} · {(task.comments || []).length} comments</p></button><div className="flex items-center gap-2"><select aria-label={`Change status for ${task.title}`} value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value })} className="rounded-md border border-border bg-white px-2 py-1.5 text-xs"><option>To Do</option><option>In Progress</option><option>Completed</option></select>{isAdmin && <><button onClick={() => openEditModal(task)} className="rounded-md p-2 text-muted hover:bg-indigo-50 hover:text-primary-600" title="Edit task"><Pencil size={16} /></button><button onClick={() => { if (window.confirm(`Delete task '${task.title}'?`)) deleteTask(task.id); }} className="rounded-md p-2 text-muted hover:bg-red-50 hover:text-red-600" title="Delete task"><Trash2 size={16} /></button></>}</div></div>) : <div className="rounded-lg bg-slate-50 p-8 text-center"><p className="font-medium text-heading">No tasks found</p><p className="mt-1 text-sm text-muted">Create a task or adjust your filters.</p></div>}</div>
        {sortedTasks.length > tasksPerPage && <div className="mt-5 flex items-center justify-between"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-muted">Page {page} of {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40">Next</button></div>}
      </section>

      {isTaskModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setIsTaskModalOpen(false)}><div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold text-heading">{editingTaskId ? "Edit Task" : "Create Task"}</h2><button onClick={() => setIsTaskModalOpen(false)} aria-label="Close"><X size={20} /></button></div><form onSubmit={handleTaskSubmit} className="space-y-4"><div><label className="mb-1 block text-sm font-medium text-heading">Task title</label><input required maxLength={100} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" placeholder="Enter task title" /></div><div><label className="mb-1 block text-sm font-medium text-heading">Description</label><textarea rows={3} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" placeholder="Describe the task" /></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-heading">Priority</label><select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"><option>Low</option><option>Medium</option><option>High</option></select></div><div><label className="mb-1 block text-sm font-medium text-heading">Status</label><select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"><option>To Do</option><option>In Progress</option><option>Completed</option></select></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-heading">Due date</label><input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" /></div><div><label className="mb-1 block text-sm font-medium text-heading">Assignee</label><select value={taskForm.assignee} onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm">{teamMembers.map((member) => <option key={member.id} value={member.initials}>{member.name}</option>)}</select></div></div><div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setIsTaskModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button><button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">{editingTaskId ? "Save Changes" : "Create Task"}</button></div></form></div></div>}

      {selectedTask && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setSelectedTaskId(null); setCommentText(""); }}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-heading">Task Details</h2><button onClick={() => { setSelectedTaskId(null); setCommentText(""); }} aria-label="Close"><X size={20} /></button></div><h3 className="text-base font-semibold text-heading">{selectedTask.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-body">{selectedTask.description || "No description provided."}</p><div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[selectedTask.status]}`}>{selectedTask.status}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityStyles[selectedTask.priority]}`}>{selectedTask.priority} priority</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted">Assignee</p><p className="mt-1 font-medium text-heading">{getAssigneeName(selectedTask.assignee)}</p></div><div><p className="text-muted">Due date</p><p className="mt-1 font-medium text-heading">{formatDate(selectedTask.dueDate)}</p></div></div><div className="mt-6 border-t border-border pt-5"><h4 className="mb-3 flex items-center gap-2 font-semibold text-heading"><MessageSquare size={17} />Comments ({(selectedTask.comments || []).length})</h4><div className="mb-4 space-y-3">{(selectedTask.comments || []).length ? selectedTask.comments.map((comment) => <div key={comment.id} className="rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-medium text-heading">{comment.author}</span><span className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-body">{comment.text}</p></div>) : <p className="text-sm text-muted">No comments yet.</p>}</div><form onSubmit={handleAddComment} className="space-y-2"><textarea rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500" /><div className="flex justify-end"><button disabled={!commentText.trim()} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add comment</button></div></form></div></div></div>}
    </div>
  );
}

export default ProjectDetails;
