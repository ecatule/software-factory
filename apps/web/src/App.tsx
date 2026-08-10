import { Routes, Route } from "react-router-dom";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { Projects } from "./pages/Projects";
import { Technologies } from "./pages/Technologies";
import { Demands } from "./pages/Demands";
import { Workspaces } from "./pages/Workspaces";
import { Artifacts } from "./pages/Artifacts";
import { SpecificationWorkspace } from "./pages/SpecificationWorkspace";
import { Agents } from "./pages/Agents";
import { Executions } from "./pages/Executions";
import { Tests } from "./pages/Tests";
import { Repositories } from "./pages/Repositories";
import { GitActivity } from "./pages/GitActivity";
import { Audit } from "./pages/Audit";
import { Settings } from "./pages/Settings";
import { DemandCockpit } from "./pages/DemandCockpit";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { NavShell } from "./components/NavShell";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <NavShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/technologies" element={<Technologies />} />
                <Route path="/demands" element={<Demands />} />
                <Route path="/workspaces" element={<Workspaces />} />
                <Route path="/artifacts" element={<Artifacts />} />
                <Route path="/specifications/:specificationId" element={<SpecificationWorkspace />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/executions" element={<Executions />} />
                <Route path="/tests" element={<Tests />} />
                <Route path="/repositories" element={<Repositories />} />
                <Route path="/git" element={<GitActivity />} />
                <Route
                  path="/audit"
                  element={
                    <ProtectedRoute permission="AUDIT_READ">
                      <Audit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute roles={["admin"]}>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route path="/demands/:demandId" element={<DemandCockpit />} />
                <Route path="/demands/:demandId/:tab" element={<DemandCockpit />} />
              </Routes>
            </NavShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
