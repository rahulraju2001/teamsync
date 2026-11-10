import { useMemo, useState } from "react";
import { Plus, Search, FolderKanban, Trash2, Pencil, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import ActionDialog from "../../components/ui/ActionDialog";

const emptyForm = { name: "", description: "", deadline: "", status: "In Progress" };

function Projects() {
  const navigate = useNavigate();
  const { projects, tasks, addProject, updateProject, deleteProject, isAdmin } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const minDate = today.toISOString().split("T")[0];

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch = project.name.toLowerCase().includes(query)
      || (project.description || "").toLowerCase().includes(query);
    return matchesSearch && (statusFilter === "All" || project.status === statusFilter);
  }), [projects, searchTerm, statusFilter]);

  const getProjectProgress = (projectId) => {
    const projectTasks = tasks.filter((task) => String(task.projectId) === String(projectId));
    if (!projectTasks.length) return 0;
    return Math.round((projectTasks.filter((task) => task.status === "Completed").length / projectTasks.length) * 100);
  };

  const openCreateModal = () => {
    setEditingProjectId(null);
    setFormData(emptyForm);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (event, project) => {
    event.stopPropagation();
    setEditingProjectId(project.id);
    setFormData({
      name: project.name || "",
      description: project.description || "",
      deadline: project.deadline || "",
      status: project.status || "In Progress",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingProjectId(null);
    setFormData(emptyForm);
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);
    const payload = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
    };

    try {
      if (editingProjectId) {
        await updateProject(editingProjectId, payload);
      } else {
        await addProject(payload);
      }
      setIsModalOpen(false);
      setEditingProjectId(null);
      setFormData(emptyForm);
    } catch (error) {
      setFormError(error.message || "Could not save the project. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (event, project) => {
    event.stopPropagation();
    setDialog({
      variant: "danger",
      title: "Delete project?",
      message: `Are you sure you want to delete “${project.name}”? All tasks in this project will also be deleted. This action cannot be undone.`,
      confirmLabel: "Delete project",
      onConfirm: async () => {
        setDialogBusy(true);
        try {
          await deleteProject(project.id);
          setDialog(null);
        } catch (error) {
          setDialog({ variant: "alert", title: "Could not delete project", message: error.message || "Please try again." });
        } finally {
          setDialogBusy(false);
        }
      },
    });
  };

  const todayDate = new Date();
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
  const isProjectOverdue = (project) => project.status !== "Completed" && Boolean(project.deadline && /^\d{4}-\d{2}-\d{2}$/.test(project.deadline) && project.deadline < todayKey);
  const formatDate = (date) => date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "No deadline";
  const statusStyles = {
    "In Progress": "bg-indigo-50 text-indigo-700",
    Completed: "bg-green-50 text-green-700",
    "On Hold": "bg-amber-50 text-amber-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Projects</h1>
          <p className="mt-1 text-sm text-muted">Manage and track all your workspace projects.</p>
        </div>
        {isAdmin && <button onClick={openCreateModal} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
          <Plus size={18} />Create Project
        </button>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search projects..." className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500" />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm">
          <option>All</option><option>In Progress</option><option>Completed</option><option>On Hold</option>
        </select>
      </div>

      {filteredProjects.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const progress = getProjectProgress(project.id);
            return (
              <article key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="cursor-pointer rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600"><FolderKanban size={20} /></div>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-heading">{project.name}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{project.description || "No description"}</p>
                    </div>
                  </div>
                  {isAdmin && <div className="flex shrink-0 items-center gap-1">
                    <button onClick={(event) => openEditModal(event, project)} className="rounded-md p-2 text-muted hover:bg-indigo-50 hover:text-primary-600" title="Edit project" aria-label={`Edit ${project.name}`}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={(event) => handleDelete(event, project)} className="rounded-md p-2 text-muted hover:bg-red-50 hover:text-red-600" title="Delete project" aria-label={`Delete ${project.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>}
                </div>
                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-sm"><span className="text-muted">Progress</span><span className="font-medium text-heading">{progress}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[project.status] || "bg-slate-100 text-slate-600"}`}>{project.status}</span>
                  <span className={`text-xs ${isProjectOverdue(project) ? "font-semibold text-red-600" : "text-muted"}`}>{isProjectOverdue(project) ? "Overdue · " : "Due "}{formatDate(project.deadline)}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-10 text-center">
          <h2 className="font-semibold text-heading">No projects found</h2>
          <p className="mt-1 text-sm text-muted">Try changing your search or status filter.</p>
        </div>
      )}

      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-heading">{editingProjectId ? "Edit Project" : "Create Project"}</h2>
              <button onClick={closeModal} disabled={isSaving} className="text-muted hover:text-heading disabled:opacity-50" aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-heading">Project Name</label>
                <input required maxLength={80} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Enter project name" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-heading">Description</label>
                <textarea rows={3} maxLength={500} value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="What is this project about?" className="w-full resize-none rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-heading">Deadline</label>
                <input type="date" required min={minDate} value={formData.deadline} onChange={(event) => setFormData({ ...formData, deadline: event.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-heading">Status</label>
                <select value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value })} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm">
                  <option>In Progress</option><option>Completed</option><option>On Hold</option>
                </select>
              </div>
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} disabled={isSaving} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
                <button disabled={isSaving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {isSaving ? "Saving..." : editingProjectId ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </form>
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

export default Projects;
