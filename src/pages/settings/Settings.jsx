import { useState } from "react";
import { Save, UserRound, Bell } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";

const defaultPreferences = { inApp: true, email: false, dueSoon: { enabled: true, daysBefore: [3, 1, 0] } };

function Settings() {
  const { currentUser, updateProfile, updateNotificationPreferences } = useWorkspace();
  const [nameDraft, setNameDraft] = useState(null);
  const [preferencesDraft, setPreferencesDraft] = useState(null);
  const name = nameDraft ?? currentUser?.name ?? "";
  const storedPreferences = currentUser?.notificationPreferences ?? defaultPreferences;
  const preferences = preferencesDraft ?? { ...defaultPreferences, ...storedPreferences, dueSoon: { ...defaultPreferences.dueSoon, ...(storedPreferences.dueSoon || {}) } };
  const [profileSaving, setProfileSaving] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [error, setError] = useState("");


  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");
    setError("");
    try {
      await updateProfile(name);
      setNameDraft(null);
      setProfileMessage("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError.message || "Could not update your profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePreferenceChange = async (key, value) => {
    const nextPreferences = { ...preferences, [key]: value };
    setPreferencesDraft(nextPreferences);
    setPreferencesSaving(true);
    setPreferencesMessage("");
    setError("");
    try {
      await updateNotificationPreferences({ [key]: value });
      setPreferencesDraft(null);
      setPreferencesMessage("Notification preferences saved.");
    } catch (saveError) {
      setPreferencesDraft(null);
      setError(saveError.message || "Could not save notification preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleDueSoonChange = async (updates) => {
    const dueSoon = { ...preferences.dueSoon, ...updates };
    const nextPreferences = { ...preferences, dueSoon };
    setPreferencesDraft(nextPreferences);
    setPreferencesSaving(true);
    setPreferencesMessage("");
    setError("");
    try {
      await updateNotificationPreferences({ dueSoon });
      setPreferencesDraft(null);
      setPreferencesMessage("Reminder preferences saved.");
    } catch (saveError) {
      setPreferencesDraft(null);
      setError(saveError.message || "Could not save reminder preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your profile and notification preferences.</p>
      </div>

      <form onSubmit={handleProfileSave} className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <UserRound size={19} className="text-primary-600" />
          <h2 className="font-semibold text-heading">Profile information</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-heading">Full name</label>
            <input
              id="profile-name"
              required
              maxLength={60}
              value={name}
              onChange={(event) => setNameDraft(event.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-heading">Email address</label>
            <input
              id="profile-email"
              type="email"
              disabled
              value={currentUser?.email || ""}
              className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm text-muted"
            />
            <p className="mt-1 text-xs text-muted">Email changes are disabled because this address is used to sign in.</p>
          </div>
          <div>
            <label htmlFor="profile-role" className="mb-1 block text-sm font-medium text-heading">Current workspace role</label>
            <input
              id="profile-role"
              disabled
              value={currentUser?.role || ""}
              className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm text-muted"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-green-700">{profileMessage}</p>
          <button disabled={profileSaving || !name.trim() || name.trim() === currentUser?.name} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Save size={16} />{profileSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Bell size={19} className="text-primary-600" />
          <h2 className="font-semibold text-heading">Notifications</h2>
        </div>
        <div className="space-y-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-heading">In-app notifications</span>
              <span className="mt-1 block text-xs text-muted">Receive task, project, workspace, and overdue notifications in TeamSync.</span>
            </span>
            <input type="checkbox" checked={preferences.inApp} disabled={preferencesSaving} onChange={(event) => handlePreferenceChange("inApp", event.target.checked)} className="h-4 w-4 accent-indigo-600" />
          </label>
          <div className="border-t border-border pt-5">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-heading">Due-soon reminders</span>
                <span className="mt-1 block text-xs text-muted">Get in-app reminders for assigned tasks and projects you own or administer.</span>
              </span>
              <input type="checkbox" checked={preferences.dueSoon.enabled} disabled={preferencesSaving} onChange={(event) => handleDueSoonChange({ enabled: event.target.checked })} className="h-4 w-4 accent-indigo-600" />
            </label>
            <div className={`mt-4 flex flex-wrap gap-x-6 gap-y-3 ${preferences.dueSoon.enabled ? "" : "opacity-50"}`}>
              {[{ value: 3, label: "3 days before" }, { value: 1, label: "1 day before" }, { value: 0, label: "On the due date" }].map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-body">
                  <input type="checkbox" checked={preferences.dueSoon.daysBefore.includes(option.value)} disabled={preferencesSaving || !preferences.dueSoon.enabled} onChange={(event) => {
                    const daysBefore = event.target.checked
                      ? [...preferences.dueSoon.daysBefore, option.value].sort((a, b) => b - a)
                      : preferences.dueSoon.daysBefore.filter((day) => day !== option.value);
                    handleDueSoonChange({ daysBefore });
                  }} className="h-4 w-4 accent-indigo-600" />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">These settings apply to future reminder delivery. Already delivered notifications remain in your history.</p>
          </div>
          <div className="border-t border-border pt-5">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-heading">Email notifications</span>
                <span className="mt-1 block text-xs text-muted">Save your preference for future email notifications.</span>
              </span>
              <input type="checkbox" checked={preferences.email} disabled={preferencesSaving} onChange={(event) => handlePreferenceChange("email", event.target.checked)} className="h-4 w-4 accent-indigo-600" />
            </label>
            <p className="mt-2 text-xs text-muted">Email delivery is not configured yet. This preference is saved to your account but does not send emails.</p>
          </div>
        </div>
        <p role="status" className="mt-4 text-sm text-green-700">{preferencesSaving ? "Saving preferences..." : preferencesMessage}</p>
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export default Settings;
