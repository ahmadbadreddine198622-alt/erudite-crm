// Template Hub has been unified into the Automations Hub — the single place to
// manage every template (channel + access control). This route now redirects.
import { Navigate } from 'react-router-dom';

export default function EmailTemplates() {
  return <Navigate to="/automations-hub" replace />;
}