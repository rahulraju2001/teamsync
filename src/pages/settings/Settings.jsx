
import { useState } from "react";
import { Save, UserRound, Bell } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";

const defaultPreferences = { inApp: true };

function Settings() {
  const { currentUser, updateProfile, updateNotificationPreferences } =
    useWorkspace();

  const [nameDraft, setNameDraft] = useState(null);
  const [preferencesDraft, setPreferencesDraft] = useState(null);

  const name = nameDraft ?? currentUser?.name ?? "";
  const preferences =
    preferencesDraft ??
    currentUser?.notificationPreferences ??
    defaultPreferences;

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

  const handlePreferenceChange = async (value) => {
    setPreferencesDraft({ ...preferences, inApp: value });
    setPreferencesSaving(true);
    setPreferencesMessage("");
    setError("");

    try {
      await updateNotificationPreferences({ inApp: value });
      setPreferencesDraft(null);
      setPreferencesMessage("Notification preferences saved.");
    } catch (saveError) {
      setPreferencesDraft(null);
      setError(
        saveError.message || "Could not save notification preferences."
      );
    } finally {
      setPreferencesSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your profile and notification preferences.
        </p>
      </div>

      <form
        onSubmit={handleProfileSave}
        className="rounded-xl border border-border bg-white p-5 sm:p-6"
      >
        <div className="mb-5 flex items-center gap-2">
          <UserRound size={19} className="text-primary-600" />
          <h2 className="font-semibold text-heading">Profile information</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-name"
              className="mb-1 block text-sm font-medium text-heading"
            >
              Full name
            </label>
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
            <label
              htmlFor="profile-email"
              className="mb-1 block text-sm font-medium text-heading"
            >
              Email address
            </label>
            <input
              id="profile-email"
              type="email"
              disabled
              value={currentUser?.email || ""}
              className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm text-muted"
            />
            <p className="mt-1 text-xs text-muted">
              Email changes are disabled because this address is used to sign
              in.
            </p>
          </div>

          <div>
            <label
              htmlFor="profile-role"
              className="mb-1 block text-sm font-medium text-heading"
            >
              Current workspace role
            </label>
            <input
              id="profile-role"
              disabled
              value={currentUser?.role || ""}
              className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm text-muted"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-green-700">
            {profileMessage}
          </p>
          <button
            type="submit"
            disabled={
              profileSaving ||
              !name.trim() ||
              name.trim() === currentUser?.name
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {profileSaving ? "Saving..." : "Save changes"}
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
              <span className="block text-sm font-medium text-heading">
                In-app notifications
              </span>
              <span className="mt-1 block text-xs text-muted">
                Receive and save task assignment and comment notifications in
                TeamSync.
              </span>
            </span>

            <input
              type="checkbox"
              checked={preferences.inApp ?? true}
              disabled={preferencesSaving}
              onChange={(event) =>
                handlePreferenceChange(event.target.checked)
              }
              className="h-4 w-4 accent-indigo-600"
            />
          </label>
        </div>

        <p role="status" className="mt-4 text-sm text-green-700">
          {preferencesSaving ? "Saving preferences..." : preferencesMessage}
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default Settings;
