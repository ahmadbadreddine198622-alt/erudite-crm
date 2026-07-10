// Email Automations has been merged into the Automations Hub — the single place
// to manage every template and every automation rule. This route now redirects.
import { Navigate } from 'react-router-dom';

export default function EmailAutomations() {
  return <Navigate to="/automations-hub" replace />;
}