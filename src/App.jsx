import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/dashboard/Dashboard";
import Projects from "./pages/projects/Projects";
import ProjectDetails from "./pages/projects/ProjectDetails";
import Tasks from "./pages/tasks/Tasks";
import Team from "./pages/team/Team";
import AcceptInvitation from "./pages/team/AcceptInvitation";
import Settings from "./pages/settings/Settings";
import MainLayout from "./layouts/MainLayout";
import NotFound from "./pages/NotFound";
import { WorkspaceProvider } from "./context/WorkspaceContext";

function ProtectedLayout() {
  return localStorage.getItem("workspace-token") ? <MainLayout /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/invite/:token" element={<AcceptInvitation />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </WorkspaceProvider>
  );
}

export default App;
