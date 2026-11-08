import { useState } from "react";
import { Save, UserRound, Bell } from "lucide-react";

function Settings() {
  const [profile, setProfile] = useState(() => {
    try {
      const savedProfile = JSON.parse(localStorage.getItem("workspace-profile"));
      const currentUser = JSON.parse(localStorage.getItem("workspace-user"));
      return savedProfile || { name: currentUser?.name || "Rahul", email: currentUser?.email || "rahul@example.com", role: currentUser?.role || "Administrator" };
    } catch { return { name: "Rahul", email: "rahul@example.com", role: "Administrator" }; }
  });
  const [notifications, setNotifications] = useState(true);
  const [saved, setSaved] = useState(false);
  const handleSave = (event) => { event.preventDefault(); localStorage.setItem("workspace-profile", JSON.stringify(profile)); localStorage.setItem("workspace-user", JSON.stringify(profile)); setSaved(true); window.setTimeout(() => setSaved(false), 2500); };
  return <div className="max-w-3xl space-y-6"><div><h1 className="text-2xl font-bold text-heading">Settings</h1><p className="mt-1 text-sm text-muted">Manage your profile and workspace preferences.</p></div><form onSubmit={handleSave} className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="mb-5 flex items-center gap-2"><UserRound size={19} className="text-primary-600" /><h2 className="font-semibold text-heading">Profile information</h2></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-heading">Full name</label><input required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" /></div><div><label className="mb-1 block text-sm font-medium text-heading">Email address</label><input type="email" required value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" /></div><div><label className="mb-1 block text-sm font-medium text-heading">Role</label><input disabled value={profile.role} className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm text-muted" /></div></div><div className="mt-6 flex items-center justify-between"><p className="text-sm text-green-700">{saved ? "Settings saved." : " "}</p><button className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><Save size={16} />Save changes</button></div></form><section className="rounded-xl border border-border bg-white p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><Bell size={19} className="text-primary-600" /><h2 className="font-semibold text-heading">Notifications</h2></div><label className="flex cursor-pointer items-center justify-between gap-4"><span><span className="block text-sm font-medium text-heading">Email notifications</span><span className="mt-1 block text-xs text-muted">Receive updates about task assignments and project activity.</span></span><input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} className="h-4 w-4 accent-indigo-600" /></label><p className="mt-3 text-xs text-muted">Notification delivery will be enabled when the backend email service is configured.</p></section></div>;
}

export default Settings;
