import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { MapPage } from './pages/map/MapPage';
import { CompanyList } from './pages/companies/CompanyList';
import { CompanyForm } from './pages/companies/CompanyForm';
import { StakeholderList } from './pages/stakeholders/StakeholderList';
import { StakeholderForm } from './pages/stakeholders/StakeholderForm';
import { ArchivedStakeholders } from './pages/stakeholders/ArchivedStakeholders';
import { AuditLog } from './pages/audit/AuditLog';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<MapPage />} />
          <Route path="companies" element={<CompanyList />} />
          <Route path="companies/new" element={<CompanyForm />} />
          <Route path="companies/:id/edit" element={<CompanyForm />} />
          <Route path="stakeholders" element={<StakeholderList />} />
          <Route path="stakeholders/new" element={<StakeholderForm />} />
          <Route path="stakeholders/archived" element={<ArchivedStakeholders />} />
          <Route path="stakeholders/:id/edit" element={<StakeholderForm />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
