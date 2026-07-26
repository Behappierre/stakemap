import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { MapPage } from './pages/map/MapPage';
import { CompanyList } from './pages/companies/CompanyList';
import { CompanyForm } from './pages/companies/CompanyForm';
import { StakeholderList } from './pages/stakeholders/StakeholderList';
import { StakeholderForm } from './pages/stakeholders/StakeholderForm';
import { ArchivedStakeholders } from './pages/stakeholders/ArchivedStakeholders';
import { AuditLog } from './pages/audit/AuditLog';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { CanonicalWriteBoundary } from './components/shared/CanonicalWriteBoundary';
import {
  canonicalReadsEnabled,
  canonicalWritesEnabled,
} from './lib/canonical';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<MapPage />} />
              <Route path="companies" element={<CompanyList />} />
              <Route
                path="companies/new"
                element={
                  canonicalReadsEnabled && !canonicalWritesEnabled ? (
                    <CanonicalWriteBoundary entity="company" />
                  ) : (
                    <CompanyForm />
                  )
                }
              />
              <Route
                path="companies/:id/edit"
                element={
                  canonicalReadsEnabled && !canonicalWritesEnabled ? (
                    <CanonicalWriteBoundary entity="company" />
                  ) : (
                    <CompanyForm />
                  )
                }
              />
              <Route path="stakeholders" element={<StakeholderList />} />
              <Route
                path="stakeholders/archived"
                element={<ArchivedStakeholders />}
              />
              <Route
                path="stakeholders/:id/edit"
                element={
                  canonicalReadsEnabled && !canonicalWritesEnabled ? (
                    <CanonicalWriteBoundary entity="stakeholder" />
                  ) : (
                    <StakeholderForm />
                  )
                }
              />
              <Route
                path="stakeholders/new"
                element={
                  canonicalReadsEnabled && !canonicalWritesEnabled ? (
                    <CanonicalWriteBoundary entity="stakeholder" />
                  ) : (
                    <StakeholderForm />
                  )
                }
              />
              <Route path="audit" element={<AuditLog />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
