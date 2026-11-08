import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";

function Tasks() {
  const { tasks, projects, teamMembers, updateTask } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [assignee, setAssignee] = useState("All");
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase().trim());
    return matchesSearch && (status === "All" || task.status === status) && (priority === "All" || task.priority === priority) && (assignee === "All" || task.assignee === assignee);
  }), [tasks, search, status, priority, assignee]);
  const getProject = (id) => projects.find((project) => String(project.id) === String(id));
  const getMember = (initials) => teamMembers.find((member) => member.initials === initials)?.name || "Unassigned";
  const statusStyles = { "To Do": "bg-slate-100 text-slate-700", "In Progress": "bg-indigo-50 text-indigo-700", Completed: "bg-green-50 text-green-700" };
  const priorityStyles = { High: "bg-red-50 text-red-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-green-50 text-green-700" };
  const formatDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-heading">My Tasks</h1><p className="mt-1 text-sm text-muted">View and update tasks across all projects.</p></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="relative sm:col-span-2 xl:col-span-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm" /></div><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm"><option>All</option><option>To Do</option><option>In Progress</option><option>Completed</option></select><select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm"><option>All</option><option>High</option><option>Medium</option><option>Low</option></select><select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm"><option value="All">All assignees</option>{teamMembers.map((member) => <option key={member.id} value={member.initials}>{member.name}</option>)}</select></div>
    <div className="overflow-hidden rounded-xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="font-semibold text-heading">All tasks</h2><span className="text-sm text-muted">{filteredTasks.length} tasks</span></div>{filteredTasks.length ? <div className="divide-y divide-border">{filteredTasks.map((task) => { const project = getProject(task.projectId); return <div key={task.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium text-heading">{task.title}</p><p className="mt-1 text-xs text-muted">{project?.name || "Unknown project"} · {getMember(task.assignee)} · Due {formatDate(task.dueDate)}</p><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[task.status]}`}>{task.status}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>{task.priority}</span></div></div><div className="flex items-center gap-2"><select aria-label={`Update ${task.title} status`} value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value })} className="rounded-lg border border-border bg-white px-2 py-2 text-xs"><option>To Do</option><option>In Progress</option><option>Completed</option></select>{project && <Link to={`/projects/${project.id}`} className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-primary-600" title="Open project"><ExternalLink size={17} /></Link>}</div></div>; })}</div> : <div className="p-10 text-center"><p className="font-medium text-heading">No tasks found</p><p className="mt-1 text-sm text-muted">Try changing your filters.</p></div>}</div>
  </div>;
}

export default Tasks;
