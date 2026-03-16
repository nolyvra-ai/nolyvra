import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import JobsPage from "../pages/JobsPage";
import CreateJobPage from "../pages/CreateJobPage";
import CandidatesPage from "../pages/CandidatesPage";
import AddCandidatePage from "../pages/AddCandidatePage";
import AnalysisPage from "../pages/AnalysisPage";
// MVP2 new pages
import TalentSearchPage from "../pages/TalentSearchPage";
import CandidateWorkflowPage from "../pages/CandidateWorkflowPage";
import SchedulerPage from "../pages/SchedulerPage";
import EmailCentrePage from "../pages/EmailCentrePage";
import RemindersPage from "../pages/RemindersPage";

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
      {/* MVP2 */}
      <Route path="/talent-search" element={<TalentSearchPage />} />
      <Route path="/candidates/:candidateId/workflow" element={<CandidateWorkflowPage />} />
      <Route path="/scheduler" element={<SchedulerPage />} />
      <Route path="/email" element={<EmailCentrePage />} />
      <Route path="/reminders" element={<RemindersPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      <Route path="/jobs/:jobId/edit" element={<CreateJobPage />} />
    </Routes>
  );
}
