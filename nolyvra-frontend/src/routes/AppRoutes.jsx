import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage            from "../pages/LandingPage";
import PricingPage            from "../pages/PricingPage";
import LoginPage              from "../pages/LoginPage";
import ForgotPasswordPage     from "../pages/ForgotPasswordPage";
import ResetPasswordPage      from "../pages/ResetPasswordPage";
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
import NexusMessagesPage      from "../pages/NexusMessagesPage";
import CandidateWorkflowPage  from "../pages/CandidateWorkflowPage";
import SchedulerPage          from "../pages/SchedulerPage";
import EmailCentrePage        from "../pages/EmailCentrePage";
import RemindersPage          from "../pages/RemindersPage";
import SettingsPage           from "../pages/SettingsPage";
import CoWorkerPage           from "../pages/CoWorkerPage";
import AgentEconomyPage       from "../pages/AgentEconomyPage";
import StackAuditPage         from "../pages/StackAuditPage";
import InterviewAnalysisPage  from "../pages/InterviewAnalysisPage";
import ClientTrackerPage       from "../pages/ClientTrackerPage";
import ContactDetailPage       from "../pages/ContactDetailPage";
import ContactsListPage        from "../pages/ContactsListPage";
import PrivacyPage             from "../pages/PrivacyPage";
import TermsPage               from "../pages/TermsPage";
import RecruitmentUnitedPage    from "../pages/RecruitmentUnitedPage";
import CrmEmployeesPage        from "../pages/CrmEmployeesPage";
import CrmEmployeeDetailPage   from "../pages/CrmEmployeeDetailPage";
import CrmDepartmentsPage      from "../pages/CrmDepartmentsPage";
import CrmOnboardingPage          from "../pages/CrmOnboardingPage";
import CrmOnboardingTemplatesPage from "../pages/CrmOnboardingTemplatesPage";
import CrmLeavePage               from "../pages/CrmLeavePage";
import CrmWorkflowsPage           from "../pages/CrmWorkflowsPage";
import CrmExpensePage             from "../pages/CrmExpensePage";
import CrmGrievancePage           from "../pages/CrmGrievancePage";
import CrmDisciplinaryPage        from "../pages/CrmDisciplinaryPage";
import CrmCoWorkerPage            from "../pages/CrmCoWorkerPage";
import CrmMyLeavePage             from "../pages/CrmMyLeavePage";
import CrmMyExpensePage           from "../pages/CrmMyExpensePage";
import CrmMyGrievancePage         from "../pages/CrmMyGrievancePage";
import CrmTimesheetsPage          from "../pages/CrmTimesheetsPage";
import CrmMyTimesheetPage         from "../pages/CrmMyTimesheetPage";
import AdminContactListBuilderPage from "../pages/AdminContactListBuilderPage";
import HelpCenterPage             from "../pages/HelpCenterPage";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public pages — no sidebar/topbar */}
      <Route path="/"                                   element={<LandingPage />} />
      <Route path="/pricing"                            element={<PricingPage />} />
      <Route path="/login"                              element={<LoginPage />} />
      <Route path="/forgot-password"                    element={<ForgotPasswordPage />} />
      <Route path="/reset-password"                     element={<ResetPasswordPage />} />
      <Route path="/ai-in-recruitment"                  element={<AgentEconomyPage />} />
      <Route path="/stack-audit"                        element={<StackAuditPage />} />
      <Route path="/privacy"                            element={<PrivacyPage />} />
      <Route path="/terms"                              element={<TermsPage />} />
      <Route path="/recruitment-united"                 element={<RecruitmentUnitedPage />} />

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
      <Route path="/nexus-messages"                     element={<NexusMessagesPage />} />
      <Route path="/candidates/:candidateId/workflow"           element={<CandidateWorkflowPage />} />
      <Route path="/candidates/:candidateId/interview-analysis" element={<InterviewAnalysisPage />} />
      <Route path="/scheduler"                          element={<SchedulerPage />} />
      <Route path="/email"                              element={<EmailCentrePage />} />
      <Route path="/reminders"                          element={<RemindersPage />} />
      <Route path="/settings"                           element={<Navigate to="/settings/account" replace />} />
      <Route path="/settings/tools/contact-list-builder" element={<AdminContactListBuilderPage />} />
      <Route path="/settings/:section"                  element={<SettingsPage />} />
      <Route path="/settings/:section/:templateKey"     element={<SettingsPage />} />
      <Route path="/coworker"                           element={<CoWorkerPage />} />
      <Route path="/help"                               element={<HelpCenterPage />} />
      <Route path="/clients"                            element={<ClientTrackerPage />} />
      <Route path="/contacts"                           element={<ContactsListPage />} />
      <Route path="/contacts/:id"                       element={<ContactDetailPage />} />
      <Route path="/crm/employees"                      element={<CrmEmployeesPage />} />
      <Route path="/crm/employees/:id"                  element={<CrmEmployeeDetailPage />} />
      <Route path="/crm/departments"                    element={<CrmDepartmentsPage />} />
      <Route path="/crm/onboarding"                     element={<CrmOnboardingPage />} />
      <Route path="/crm/onboarding/templates"           element={<CrmOnboardingTemplatesPage />} />
      <Route path="/crm/leave"                          element={<CrmLeavePage />} />
      <Route path="/crm/workflows"                      element={<CrmWorkflowsPage />} />
      <Route path="/crm/expenses"                       element={<CrmExpensePage />} />
      <Route path="/crm/grievances"                     element={<CrmGrievancePage />} />
      <Route path="/crm/disciplinary"                   element={<CrmDisciplinaryPage />} />
      <Route path="/crm/coworker"                        element={<CrmCoWorkerPage />} />
      <Route path="/crm/my-leave"                        element={<CrmMyLeavePage />} />
      <Route path="/crm/my-expenses"                     element={<CrmMyExpensePage />} />
      <Route path="/crm/my-grievances"                   element={<CrmMyGrievancePage />} />
      <Route path="/crm/timesheets"                      element={<CrmTimesheetsPage />} />
      <Route path="/crm/my-timesheet"                     element={<CrmMyTimesheetPage />} />
      <Route path="*"                                   element={<Navigate to="/" replace />} />
    </Routes>
  );
}
