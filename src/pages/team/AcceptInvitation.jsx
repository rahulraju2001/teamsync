import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BriefcaseBusiness, LoaderCircle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(() =>
    localStorage.getItem("workspace-token") ? "working" : "login",
  );
  const [message, setMessage] = useState(() =>
    localStorage.getItem("workspace-token")
      ? "Checking your invitation..."
      : "Sign in or create an account using the email address this invitation was sent to, then open this invitation link again.",
  );

  useEffect(() => {
    const authToken = localStorage.getItem("workspace-token");
    if (!authToken) return;
    let cancelled = false;
    fetch(`${API_URL}/workspace/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not accept this invitation.");
        if (cancelled) return;
        setMessage(data.message || "You joined the workspace.");
        setStatus("success");
        const user = JSON.parse(localStorage.getItem("workspace-user") || "{}");
        localStorage.setItem("workspace-user", JSON.stringify({ ...user, role: "Member" }));
        window.dispatchEvent(new Event("workspace-auth-changed"));
        setTimeout(() => navigate("/team", { replace: true }), 1200);
      })
      .catch((error) => { if (!cancelled) { setMessage(error.message); setStatus("error"); } });
    return () => { cancelled = true; };
  }, [token, navigate]);

  return <div className="flex min-h-screen items-center justify-center bg-background p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white"><BriefcaseBusiness size={24} /></div><h1 className="text-xl font-bold text-heading">Workspace invitation</h1><p className="mt-3 text-sm text-body">{message}</p>{status === "working" && <LoaderCircle className="mx-auto mt-5 animate-spin text-primary-600" />}{status === "success" && <p className="mt-4 text-sm font-medium text-green-700">Redirecting to your team...</p>}{status === "login" && <div className="mt-5 flex justify-center gap-4 text-sm"><Link className="font-medium text-primary-600" to="/login" state={{ from: `/invite/${token}` }}>Sign in</Link><Link className="font-medium text-primary-600" to="/register" state={{ from: `/invite/${token}` }}>Create account</Link></div>}{status === "error" && <Link className="mt-5 inline-block text-sm font-medium text-primary-600" to="/team">Back to TeamSync</Link>}</div></div>;
}

export default AcceptInvitation;
