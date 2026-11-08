import { useEffect, useState } from "react";
import { Copy, Mail, ShieldCheck, Users, UserMinus, LoaderCircle, Check, RefreshCw } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";

function Team() {
  const {
    teamMembers, tasks, workspaceInfo, currentUser, isAdmin,
    refreshWorkspace, inviteMember, updateMemberRole, removeMember, renameWorkspace,
  } = useWorkspace();
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refreshWorkspace()
      .catch((err) => setError(err.message || "Could not load workspace members."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setWorkspaceName(workspaceInfo?.name || "");
  }, [workspaceInfo?.name]);

  const handleInvite = async (event) => {
    event.preventDefault();
    setError(""); setNotice(""); setInviteUrl(""); setBusy(true);
    try {
      const result = await inviteMember(email);
      setInviteUrl(result.invitationUrl);
      setEmail("");
      setNotice(`Invitation link created for ${result.email}. Share the link with them.`);
    } catch (err) { setError(err.message || "Could not create invitation."); }
    finally { setBusy(false); }
  };

  const handleRoleChange = async (member, role) => {
    setError(""); setNotice("");
    try { await updateMemberRole(member.id, role); setNotice(`${member.name}'s role was updated.`); }
    catch (err) { setError(err.message || "Could not update member role."); }
  };

  const handleRemove = async (member) => {
    if (!window.confirm(`Remove ${member.name} from this workspace?`)) return;
    setError(""); setNotice("");
    try { await removeMember(member.id); setNotice(`${member.name} was removed from the workspace.`); }
    catch (err) { setError(err.message || "Could not remove member."); }
  };

  const handleRename = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    try { await renameWorkspace(workspaceName); setNotice("Workspace name updated."); }
    catch (err) { setError(err.message || "Could not update workspace name."); }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setError("Could not copy automatically. Select and copy the invitation link."); }
  };

  const pendingInvites = workspaceInfo?.invitations || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-bold text-heading">Team</h1><p className="mt-1 text-sm text-muted">Manage workspace members, roles and invitations.</p></div>
        <button onClick={() => refreshWorkspace().catch((err) => setError(err.message))} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-body hover:bg-slate-50"><RefreshCw size={15} />Refresh</button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex items-center gap-2"><Users size={19} className="text-primary-600" /><h2 className="font-semibold text-heading">Workspace members</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted">{teamMembers.length}</span></div>
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted"><LoaderCircle size={18} className="animate-spin" />Loading team...</div> : teamMembers.length === 0 ? <p className="py-6 text-sm text-muted">No members found.</p> : (
          <div className="divide-y divide-border">
            {teamMembers.map((member) => {
              const assigned = tasks.filter((task) => task.assignee === member.initials);
              const completed = assigned.filter((task) => task.status === "Completed").length;
              const isSelf = String(member.id) === String(currentUser?.id);
              return <div key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">{member.initials}</div><div className="min-w-0"><p className="truncate font-medium text-heading">{member.name}{isSelf ? " (You)" : ""}</p><p className="truncate text-sm text-muted">{member.email}</p><p className="mt-0.5 text-xs text-muted">{completed} of {assigned.length} assigned tasks completed</p></div></div>
                <div className="flex items-center gap-2">
                  {isAdmin && !isSelf && String(member.id) !== String(workspaceInfo?.owner) ? <>
                    <select aria-label={`Role for ${member.name}`} value={member.role} onChange={(e) => handleRoleChange(member, e.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><option value="Member">Member</option><option value="Administrator">Administrator</option></select>
                    <button onClick={() => handleRemove(member)} title={`Remove ${member.name}`} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"><UserMinus size={17} /></button>
                  </> : <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${member.role === "Administrator" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{member.role === "Administrator" && <ShieldCheck size={13} />}{member.role}</span>}
                </div>
              </div>;
            })}
          </div>
        )}
      </section>

      {isAdmin && <section className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-semibold text-heading">Invite a teammate</h2>
        <p className="mt-1 text-sm text-muted">Create a secure invitation link. Share it with the person you want to add; invitations expire after 7 days.</p>
        <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-500" /><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}Create invitation</button></form>
        {inviteUrl && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3"><p className="mb-2 text-sm font-medium text-green-800">Invitation link ready</p><div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={inviteUrl} className="min-w-0 flex-1 rounded-md border border-green-200 bg-white px-3 py-2 text-xs text-slate-700" /><button onClick={handleCopy} className="inline-flex items-center justify-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy link"}</button></div></div>}
        {pendingInvites.length > 0 && <div className="mt-5"><h3 className="mb-2 text-sm font-semibold text-heading">Pending invitations</h3><div className="space-y-2">{pendingInvites.map((invite) => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span className="text-sm text-body">{invite.email}</span><span className="text-xs text-muted">Expires {new Date(invite.expiresAt).toLocaleDateString()}</span></div>)}</div></div>}
      </section>}

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="mb-3 flex items-center gap-2"><ShieldCheck size={18} className="text-primary-600" /><h2 className="font-semibold text-heading">Workspace permissions</h2></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-amber-50 p-4"><p className="font-semibold text-amber-800">Administrator</p><p className="mt-1 text-sm text-amber-900">Manage workspace settings, invite and remove members, change roles, and create, edit or delete projects and tasks.</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="font-semibold text-slate-800">Member</p><p className="mt-1 text-sm text-slate-600">View shared projects, create tasks, update task status and participate in task discussions. Project administration and destructive actions are restricted.</p></div></div>
      </section>

      {isAdmin && <section className="rounded-xl border border-border bg-white p-5"><h2 className="font-semibold text-heading">Workspace settings</h2><form onSubmit={handleRename} className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} maxLength={80} required className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2.5 text-sm" /><button className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-body hover:bg-slate-50">Save name</button></form></section>}
    </div>
  );
}

export default Team;
