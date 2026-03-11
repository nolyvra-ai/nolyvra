import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage.jsx";
import JobsPage from "../pages/JobsPage";
import CreateJobPage from "../pages/CreateJobPage";
import CandidatesPage from "../pages/CandidatesPage";
import AddCandidatePage from "../pages/AddCandidatePage";
import AnalysisPage from "../pages/AnalysisPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/new" element={<CreateJobPage />} />
      <Route path="/candidates" element={<CandidatesPage />} />
      <Route path="/candidates/new" element={<AddCandidatePage />} />
      <Route path="/analysis/:candidateId" element={<AnalysisPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
