import { Link } from 'react-router-dom';

interface CanonicalWriteBoundaryProps {
  entity: 'company' | 'stakeholder';
}

export function CanonicalWriteBoundary({
  entity,
}: CanonicalWriteBoundaryProps) {
  const destination = entity === 'company' ? '/companies' : '/stakeholders';

  return (
    <div className="glass-card-solid mx-auto max-w-lg p-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">
        Canonical data is read-only in this preview
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        {entity === 'company' ? 'Company' : 'Stakeholder'} changes are paused
        while reads are validated against the shared workspace. Relationships,
        layouts and interaction history continue to use the legacy StakeMap
        feature store.
      </p>
      <Link to={destination} className="btn-primary mt-5 inline-flex">
        Back to {entity === 'company' ? 'companies' : 'stakeholders'}
      </Link>
    </div>
  );
}
