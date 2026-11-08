import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, LoaderCircle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const invitationToken = location.state?.from?.startsWith("/invite/") ? location.state.from.split("/").pop() : null;
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault(); setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, password: form.password, ...(invitationToken ? { invitationToken } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create your account.");
      localStorage.setItem("workspace-token", data.token);
      localStorage.setItem("workspace-user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("workspace-auth-changed"));
      navigate(invitationToken ? "/team" : "/dashboard", { replace: true });
    } catch (err) { setError(err.message || "Could not connect to the server. Make sure the backend is running."); }
    finally { setLoading(false); }
  };
  return <div className="flex min-h-screen items-center justify-center bg-background p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-white p-7 shadow-sm sm:p-9"><div className="mb-7 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white"><BriefcaseBusiness size={25} /></div><h1 className="text-2xl font-bold text-heading">Create your account</h1><p className="mt-2 text-sm text-muted">Get your team organized with TeamSync.</p></div><form onSubmit={handleSubmit} className="space-y-4"><div><label className="mb-1.5 block text-sm font-medium text-heading">Full name</label><input required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" /></div><div><label className="mb-1.5 block text-sm font-medium text-heading">Email address</label><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" /></div><div><label className="mb-1.5 block text-sm font-medium text-heading">Password</label><input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" /></div><div><label className="mb-1.5 block text-sm font-medium text-heading">Confirm password</label><input type="password" required autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Re-enter your password" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm" /></div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">{loading && <LoaderCircle size={17} className="animate-spin" />}{loading ? "Creating account..." : "Create account"}</button></form><p className="mt-6 text-center text-sm text-muted">Already have an account? <Link to="/login" state={location.state} className="font-medium text-primary-600 hover:text-primary-700">Sign in</Link></p></div></div>;
}

export default Register;
