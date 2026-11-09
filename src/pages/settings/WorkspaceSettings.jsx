import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, Crown, ShieldCheck, Trash2, Users } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import ActionDialog from "../../components/ui/ActionDialog";

function WorkspaceSettings() {
  const {
    workspaceInfo,
    currentUser,
    teamMembers,
    transferWorkspaceOwnership,
    deleteWorkspace,
  } = useWorkspace();
  const navigate = useNavigate();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ownerId =
    typeof workspaceInfo?.owner === "object"
      ? workspaceInfo.owner?._id
      : workspaceInfo?.owner;
  const currentUserId = currentUser?._id || currentUser?.id;
  const isOwner =
    Boolean(currentUserId && ownerId) &&
    String(currentUserId) === String(ownerId);

  const eligibleAdministrators = useMemo(
    () =>
      (teamMembers || []).filter(
        (member) =>
          member.role === "Administrator" &&
          String(member.id || member._id) !== String(ownerId),
      ),
    [teamMembers, ownerId],
  );

  const selectedMember = eligibleAdministrators.find(
    (member) => String(member.id || member._id) === String(selectedUserId),
  );
  const currentOwner = (teamMembers || []).find(
    (member) => String(member.id || member._id) === String(ownerId),
  );

  const handleTransfer = async () => {
    if (!selectedUserId) return;

    try {
      setSaving(true);
      setError("");
      await transferWorkspaceOwnership(selectedUserId);
      setConfirmOpen(false);
      setSelectedUserId("");
      setSuccess("Workspace ownership transferred successfully. You are now an Administrator.");
    } catch (transferError) {
      setError(transferError.message || "Could not transfer workspace ownership.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    try {
      setDeleting(true);
      setDeleteError("");
      await deleteWorkspace();
      setDeleteConfirmOpen(false);
      navigate("/dashboard", { replace: true });
    } catch (deleteFailure) {
      setDeleteError(deleteFailure.message || "Could not delete this workspace.");
    } finally {
      setDeleting(false);
    }
  };

  if (!workspaceInfo) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted">Loading workspace settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/dashboard"
          className="mb-3 inline-flex items-center gap-2 text-sm text-muted transition hover:text-primary-600"
        >
          <ArrowLeft size={15} />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-heading">Workspace settings</h1>
        <p className="mt-1 text-sm text-muted">Manage ownership for {workspaceInfo.name}.</p>
      </div>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Crown size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-heading">Workspace ownership</h2>
            <p className="mt-1 text-sm leading-6 text-body">
              The owner has full control over this workspace, including the ability to delete it.
              Ownership can be transferred to another Administrator. After the transfer, you
              will remain an Administrator and can leave the workspace if another Administrator
              remains.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current owner</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {(currentOwner?.name || "O").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-heading">
                {currentOwner?.name || (isOwner ? currentUser?.name : "Workspace owner")}
                {isOwner ? " (You)" : ""}
              </p>
              <p className="truncate text-xs text-muted">{currentOwner?.email || "Workspace owner"}</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              <ShieldCheck size={13} /> Owner
            </span>
          </div>
        </div>

        {isOwner ? (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-workspace-owner" className="mb-1.5 block text-sm font-medium text-heading">
                Transfer ownership to
              </label>
              <select
                id="new-workspace-owner"
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                  setError("");
                  setSuccess("");
                }}
                disabled={eligibleAdministrators.length === 0 || saving}
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-heading outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted"
              >
                <option value="">Select an Administrator</option>
                {eligibleAdministrators.map((member) => (
                  <option key={member.id || member._id} value={member.id || member._id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
              {eligibleAdministrators.length === 0 && (
                <p className="mt-2 text-sm text-muted">
                  There are no other Administrators in this workspace. <Link to="/team" className="font-medium text-primary-700 hover:underline">Go to the Team page</Link> and promote a member to Administrator before transferring ownership.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted">
                The selected Administrator will become the owner. Your role will remain Administrator.
              </p>
              <button
                type="button"
                onClick={() => { setError(""); setConfirmOpen(true); }}
                disabled={!selectedUserId || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeftRight size={16} />
                Transfer ownership
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-border bg-slate-50 p-4">
            <div className="flex items-start gap-2">
              <Users size={17} className="mt-0.5 shrink-0 text-muted" />
              <p className="text-sm text-body">Only the current workspace owner can transfer ownership. Contact the owner if this change is needed.</p>
            </div>
          </div>
        )}

        {success && (
          <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </p>
        )}
        {error && !confirmOpen && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
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
                Permanently delete this workspace and its projects, tasks, comments, and notifications. Members will lose access to this workspace.
              </p>
              <button
                type="button"
                onClick={() => { setDeleteError(""); setDeleteConfirmOpen(true); }}
                disabled={deleting}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={16} />
                Delete workspace
              </button>
              {deleteError && (
                <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {deleteError}
                </p>
              )}
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
        onClose={() => {
          if (!deleting) {
            setDeleteConfirmOpen(false);
            setDeleteError("");
          }
        }}
      />

      <ActionDialog
        open={confirmOpen}
        variant="warning"
        title="Transfer workspace ownership?"
        message={`Are you sure you want to make ${selectedMember?.name || "this Administrator"} the owner of ${workspaceInfo.name}? You will remain an Administrator, but you will no longer be able to delete the workspace or transfer ownership.`}
        confirmLabel="Transfer ownership"
        busy={saving}
        error={error}
        onConfirm={handleTransfer}
        onClose={() => {
          if (!saving) {
            setConfirmOpen(false);
            setError("");
          }
        }}
      />
    </div>
  );
}

export default WorkspaceSettings;
