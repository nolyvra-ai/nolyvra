import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage            from "../pages/LandingPage";
import PricingPage            from "../pages/PricingPage";
import LoginPage              from "../pages/LoginPage";
import DashboardPage          from "../pages/DashboardPage";
import JobsPage               from "../pages/JobsPage";
import CreateJobPage          from "../pages/CreateJobPage";
import CreateJobPageModern    from "../pages/CreateJobPageModern";
import AddCandidatesModernPage from "../pages/AddCandidatesModernPage";
import AddCandidateModernPage  from "../pages/AddCandidateModernPage";
import CandidatesPage         from "../pages/CandidatesPage";
import AddCandidatePage       from "../pages/AddCandidatePage";
import AnalysisPage           from "../pages/AnalysisPage";
import TalentSearchPage       from "../pages/TalentSearchPage";
import CandidateWorkflowPage  from "../pages/CandidateWorkflowPage";
import SchedulerPage          from "../pages/SchedulerPage";
import EmailCentrePage        from "../pages/EmailCentrePage";
import RemindersPage          from "../pages/RemindersPage";
import SettingsPage           from "../pages/SettingsPage";
import CoWorkerPage           from "../pages/CoWorkerPage";
import AgentEconomyPage       from "../pages/AgentEconomyPage";
import InterviewAnalysisPage  from "../pages/InterviewAnalysisPage";
import ClientTrackerPage       from "../pages/ClientTrackerPage";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public pages — no sidebar/topbar */}
      <Route path="/"                                   element={<LandingPage />} />
      <Route path="/pricing"                            element={<PricingPage />} />
      <Route path="/login"                              element={<LoginPage />} />
      <Route path="/ai-in-recruitment"                  element={<AgentEconomyPage />} /> {/* ← NEW */}

      {/* App pages */}
      <Route path="/dashboard"                          element={<DashboardPage />} />
      <Route path="/jobs"                               element={<JobsPage />} />
      <Route path="/jobs/new"                              element={<CreateJobPageModern />} />
      <Route path="/jobs/new-modern"                    element={<CreateJobPageModern />} />
      <Route path="/jobs/new-classic"                   element={<CreateJobPage />} />
      <Route path="/jobs/:jobId/add-candidates-modern"  element={<AddCandidatesModernPage />} />
      <Route path="/jobs/:jobId/edit"                   element={<CreateJobPage />} />
      <Route path="/candidates"                         element={<CandidatesPage />} />
      <Route path="/candidates/new-modern"              element={<AddCandidateModernPage />} />
      <Route path="/candidates/new"                     element={<AddCandidatePage />} />
      <Route path="/analysis/:candidateId"              element={<AnalysisPage />} />
      <Route path="/talent-search"                      element={<TalentSearchPage />} />
      <Route path="/candidates/:candidateId/workflow"           element={<CandidateWorkflowPage />} />
      <Route path="/candidates/:candidateId/interview-analysis" element={<InterviewAnalysisPage />} />
      <Route path="/scheduler"                          element={<SchedulerPage />} />
      <Route path="/email"                              element={<EmailCentrePage />} />
      <Route path="/reminders"                          element={<RemindersPage />} />
      <Route path="/settings"                           element={<SettingsPage />} />
      <Route path="/coworker"                           element={<CoWorkerPage />} />
      <Route path="/clients"                            element={<ClientTrackerPage />} />
      <Route path="*"                                   element={<Navigate to="/" replace />} />
    </Routes>
  );
}
