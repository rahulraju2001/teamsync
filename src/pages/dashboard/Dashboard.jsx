import { useMemo } from "react";
import { FolderKanban, ListTodo, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";

function Dashboard() {
  const { projects, tasks, currentUser } = useWorkspace();
  const today = new Date();
  const overdueTasks = tasks.filter((task) => task.status !== "Completed" && task.dueDate && new Date(`${task.dueDate}T23:59:59`) < today);
  const activeTasks = tasks.filter((task) => task.status !== "Completed");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const statusGroups = [
    { status: "To Do", color: "bg-slate-400" },
    { status: "In Progress", color: "bg-primary-500" },
    { status: "Completed", color: "bg-green-500" },
  ].map((item) => ({ ...item, count: tasks.filter((task) => task.status === item.status).length }));
  const recentTasks = useMemo(() => [...tasks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4), [tasks]);
  const weeklyCompletions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return {
        date,
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        dateLabel: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        count: 0,
      };
    });
    const counts = new Map(days.map((day) => [day.key, day]));

    tasks.forEach((task) => {
      if (!task.completedAt) return;
      const completedDate = new Date(task.completedAt);
      if (Number.isNaN(completedDate.getTime())) return;
      const key = `${completedDate.getFullYear()}-${completedDate.getMonth()}-${completedDate.getDate()}`;
      const day = counts.get(key);
      if (day) day.count += 1;
    });

    return days;
  }, [tasks]);
  const weeklyCompletionMax = Math.max(...weeklyCompletions.map((day) => day.count), 1);
  const weeklyCompletionTotal = weeklyCompletions.reduce((total, day) => total + day.count, 0);
  const stats = [
    { title: "Total Projects", value: projects.length, icon: FolderKanban, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Active Tasks", value: activeTasks.length, icon: ListTodo, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Completed Tasks", value: completedTasks.length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { title: "Overdue Tasks", value: overdueTasks.length, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];
  const getProjectProgress = (projectId) => {
    const items = tasks.filter((task) => String(task.projectId) === String(projectId));
    return items.length ? Math.round((items.filter((task) => task.status === "Completed").length / items.length) * 100) : 0;
  };
  const formatDate = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No deadline";

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-heading">Welcome back, {currentUser?.name?.trim()?.split(/\s+/)[0] || "there"}!</h1><p className="mt-1 text-sm text-muted">Here's what's happening with your workspace today.</p></div><Link to="/projects" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">Manage Projects <ArrowUpRight size={17} /></Link></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => { const Icon = stat.icon; return <div key={stat.title} className="rounded-xl border border-border bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted">{stat.title}</p><p className="mt-2 text-2xl font-bold text-heading">{stat.value}</p></div><div className={`${stat.bg} ${stat.color} rounded-lg p-3`}><Icon size={22} /></div></div></div>; })}</div>
    <section className="rounded-xl border border-border bg-white p-5">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-heading">Weekly completed tasks</h2>
          <p className="mt-1 text-sm text-muted">Tasks moved to Completed over the last 7 days</p>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-bold text-heading">{weeklyCompletionTotal}</p>
          <p className="text-xs text-muted">Completed this week</p>
        </div>
      </div>
      <div className="grid h-48 grid-cols-7 gap-2 sm:gap-4" role="img" aria-label={`Bar chart showing ${weeklyCompletionTotal} tasks completed in the last seven days`}>
        {weeklyCompletions.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-col items-center justify-end gap-2">
            <span className="text-xs font-medium text-heading">{day.count}</span>
            <div className="flex h-32 w-full items-end justify-center rounded-t-md bg-slate-50">
              <div
                className="w-full max-w-10 rounded-t-md bg-primary-600 transition-all duration-300"
                style={{ height: `${day.count ? Math.max((day.count / weeklyCompletionMax) * 100, 5) : 0}%` }}
                title={`${day.count} task${day.count === 1 ? "" : "s"} completed on ${day.dateLabel}`}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-body">{day.label}</p>
              <p className="text-[10px] text-muted">{day.dateLabel}</p>
            </div>
          </div>
        ))}
      </div>
      {weeklyCompletionTotal === 0 && (
        <p className="mt-3 text-center text-xs text-muted">No tasks were recorded as completed in this period yet.</p>
      )}
    </section>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-border bg-white p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold text-heading">Projects overview</h2><Link to="/projects" className="text-sm font-medium text-primary-600 hover:text-primary-700">View all</Link></div><div className="space-y-5">{projects.slice(0, 5).map((project) => { const progress = getProjectProgress(project.id); return <div key={project.id}><div className="flex items-start justify-between gap-3"><div><Link to={`/projects/${project.id}`} className="font-medium text-heading hover:text-primary-600">{project.name}</Link><p className="mt-1 text-xs text-muted">Due {formatDate(project.deadline)}</p></div><span className="text-sm font-semibold text-heading">{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary-600" style={{ width: `${progress}%` }} /></div></div>; })}{projects.length === 0 && <p className="text-sm text-muted">No projects yet. Create your first project to get started.</p>}</div></section>
      <section className="rounded-xl border border-border bg-white p-5"><h2 className="mb-5 text-lg font-semibold text-heading">Task overview</h2><div className="space-y-5">{statusGroups.map((item) => { const percentage = tasks.length ? (item.count / tasks.length) * 100 : 0; return <div key={item.status}><div className="mb-2 flex justify-between text-sm"><span className="text-body">{item.status}</span><span className="font-medium text-heading">{item.count}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`${item.color} h-2 rounded-full`} style={{ width: `${percentage}%` }} /></div></div>; })}</div><div className="mt-6 border-t border-border pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-heading">Recently added tasks</h3><Link to="/tasks" className="text-sm font-medium text-primary-600">View all</Link></div><div className="space-y-3">{recentTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-heading">{task.title}</p><p className="text-xs text-muted">{projects.find((project) => String(project.id) === String(task.projectId))?.name || "Unknown project"}</p></div><span className="shrink-0 text-xs text-muted">{task.status}</span></div>)}{recentTasks.length === 0 && <p className="text-sm text-muted">No tasks yet.</p>}</div></div></section>
    </div>
  </div>;
}

export default Dashboard;
