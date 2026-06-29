import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/lib/useCurrentUser';

/**
 * Opens the OS/browser mail client pre-filled via mailto:.
 * Sends from the agent's own email — no backend, no API.
 */
export default function EmailComposeButton({ toEmail, toName, contextLabel, size = 'sm', className = '' }) {
  const { user } = useCurrentUser();

  const hasEmail = !!toEmail?.trim();

  const handleClick = () => {
    if (!hasEmail) return;
    const agentName = user?.full_name || user?.email || 'Erudite Agent';
    const subject = toName
      ? `Erudite Real Estate — ${toName}`
      : 'Erudite Real Estate';
    const body = `Hi ${toName || ''},\n\n\n\nBest regards,\n${agentName}\nErudite Real Estate`;
    const mailto = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  if (!hasEmail) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        title="No email on file"
        className={className}
      >
        <Mail className="w-4 h-4 mr-1" /> Email
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleClick}
      title={`Email ${toName || toEmail}`}
      className={`text-blue-400 hover:text-blue-500 hover:bg-blue-50/10 ${className}`}
    >
      <Mail className="w-4 h-4 mr-1" /> Email
    </Button>
  );
}