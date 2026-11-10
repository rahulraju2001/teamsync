import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Trash2 } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import ActionDialog from "../../components/ui/ActionDialog";

function WorkspaceSettings() {
  const { workspaceInfo, currentUser, teamMembers, deleteWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const ownerId = typeof workspaceInfo?.owner === "object"
    ? workspaceInfo.owner?._id
    : workspaceInfo?.owner;
  const currentUserId = currentUser?._id || currentUser?.id;
  const isOwner = Boolean(currentUserId && ownerId) && String(currentUserId) === String(ownerId);
  const currentOwner = (teamMembers || []).find(
    (member) => String(member.id || member._id) === String(ownerId),
  );

  const handleDeleteWorkspace = async () => {
    try {
      setDeleting(true);
      setDeleteError("");
      await deleteWorkspace();
      setDeleteConfirmOpen(false);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setDeleteError(error.message || "Could not delete this workspace.");
    } finally {
      setDeleting(false);
    }
  };

  if (!workspaceInfo) {
    return <div className="mx-auto max-w-3xl"><p className="text-sm text-muted">Loading workspace settings...</p></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm text-muted transition hover:text-primary-600">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-heading">Workspace settings</h1>
        <p className="mt-1 text-sm text-muted">Manage {workspaceInfo.name}.</p>
      </div>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Crown size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-heading">Workspace owner</h2>
            <p className="mt-1 text-sm leading-6 text-body">
              Each workspace has one permanent owner. The owner is an Administrator and is the only person who can delete the workspace. Ownership cannot be transferred.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-border bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current owner</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {(currentOwner?.name || (isOwner ? currentUser?.name : "O") || "O").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-heading">
                {currentOwner?.name || (isOwner ? currentUser?.name : "Workspace owner")}{isOwner ? " (You)" : ""}
              </p>
              <p className="truncate text-xs text-muted">{currentOwner?.email || (isOwner ? currentUser?.email : "Workspace owner")}</p>
            </div>
            <span className="ml-auto rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">Owner</span>
          </div>
        </div>
        {!isOwner && (
          <p className="mt-4 text-sm text-muted">Only the workspace owner can delete this workspace. Contact them if deletion is required.</p>
        )}
      </section>

      {isOwner && (
        <section className="rounded-xl border border-red-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-heading">Danger zone</h2>
              <p className="mt-1 text-sm leading-6 text-body">
                Permanently delete this workspace and its projects, tasks, and notifications. Members will lose access and be moved to another workspace or a new personal workspace.
              </p>
              <button type="button" onClick={() => { setDeleteError(""); setDeleteConfirmOpen(true); }} disabled={deleting}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 size={16} /> Delete workspace
              </button>
              {deleteError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
            </div>
          </div>
        </section>
      )}

      <ActionDialog
        open={deleteConfirmOpen}
        variant="danger"
        title="Delete workspace permanently?"
        message={`This will permanently delete ${workspaceInfo.name}, including its projects, tasks, comments, and notifications. All members will lose access. This action cannot be undone.`}
        confirmLabel="Delete workspace"
        busy={deleting}
        error={deleteError}
        onConfirm={handleDeleteWorkspace}
        onClose={() => { if (!deleting) { setDeleteConfirmOpen(false); setDeleteError(""); } }}
      />
    </div>
  );
}

export default WorkspaceSettings;
