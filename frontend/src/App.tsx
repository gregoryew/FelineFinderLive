import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './services/auth'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Bookings from './pages/Bookings'
import OnBoarding from './pages/OnBoarding'
import Admin from './pages/Admin'
import AuthCallback from './pages/AuthCallback'
import AccessDenied from './pages/AccessDenied'
import AdminConfirmation from './pages/AdminConfirmation'
import VerifyOrganization from './pages/VerifyOrganization'
import InviteAcceptance from './pages/InviteAcceptance'
import OrganizationEntry from './pages/OrganizationEntry'
import SetupConfirmation from './pages/SetupConfirmation'
import OrganizationJWTVerification from './pages/OrganizationJWTVerification'
import WorkSchedule from './pages/WorkSchedule'
import CatRulesList from './pages/CatRulesList'
import CatRulesDetail from './pages/CatRulesDetail'
import ErrorPage from './pages/ErrorPage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/onboarding" element={<OnBoarding />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/admin-confirmation" element={<AdminConfirmation />} />
                <Route path="/verify-organization" element={<VerifyOrganization />} />
                <Route path="/invite" element={<InviteAcceptance />} />
                <Route path="/organization-entry" element={<OrganizationEntry />} />
                <Route path="/setup-confirmation" element={<SetupConfirmation />} />
                <Route path="/jwt-verification" element={<OrganizationJWTVerification />} />
                <Route path="/work-schedule" element={<WorkSchedule />} />
                <Route path="/cat-rules" element={<CatRulesList />} />
                <Route path="/cat-rules/:catId" element={<CatRulesDetail />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
