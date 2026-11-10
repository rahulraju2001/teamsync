import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, LoaderCircle } from "lucide-react";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to sign in.");
      localStorage.setItem("workspace-token", data.token);
      localStorage.setItem("workspace-user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("workspace-auth-changed"));
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) { setError(getFriendlyErrorMessage(err, "Unable to sign in. Please try again.")); }
    finally { setLoading(false); }
  };
  return <div className="flex min-h-screen items-center justify-center bg-background p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-white p-7 shadow-sm sm:p-9"><div className="mb-8 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white"><BriefcaseBusiness size={25} /></div><h1 className="text-2xl font-bold text-heading">Welcome back</h1><p className="mt-2 text-sm text-muted">Sign in to your TeamSync account.</p></div><form onSubmit={handleSubmit} className="space-y-4"><div><label className="mb-1.5 block text-sm font-medium text-heading">Email address</label><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-500" /></div><div><label className="mb-1.5 block text-sm font-medium text-heading">Password</label><input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-500" /></div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">{loading && <LoaderCircle size={17} className="animate-spin" />}{loading ? "Signing in..." : "Sign in"}</button></form><p className="mt-6 text-center text-sm text-muted">Don't have an account? <Link to="/register" state={location.state} className="font-medium text-primary-600 hover:text-primary-700">Create one</Link></p></div></div>;
}

export default Login;
