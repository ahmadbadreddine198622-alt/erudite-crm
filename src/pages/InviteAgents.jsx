import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Mail, Plus, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function InviteAgents() {
  const [emails, setEmails] = useState([
    { email: 'Malik@erudite-estate.com', invited: false },
    { email: 'Ajwa@erudite-estate.com', invited: false },
    { email: 'Sameie@erudite-estate.com', invited: false },
  ]);
  const [newEmail, setNewEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async (email) => {
    setIsInviting(true);
    try {
      await base44.users.inviteUser(email, 'user');
      setEmails(prev => prev.map(e => 
        e.email === email ? { ...e, invited: true } : e
      ));
      toast.success(`Invitation sent to ${email}`);
    } catch (error) {
      toast.error(`Failed to invite ${email}: ${error.message}`);
    } finally {
      setIsInviting(false);
    }
  };

  const handleAddEmail = () => {
    if (newEmail && !emails.find(e => e.email === newEmail)) {
      setEmails(prev => [...prev, { email: newEmail, invited: false }]);
      setNewEmail('');
    }
  };

  const handleInviteAll = async () => {
    setIsInviting(true);
    const pendingEmails = emails.filter(e => !e.invited);
    
    for (const { email } of pendingEmails) {
      try {
        await base44.users.inviteUser(email, 'user');
        setEmails(prev => prev.map(e => 
          e.email === email ? { ...e, invited: true } : e
        ));
        toast.success(`Invitation sent to ${email}`);
      } catch (error) {
        toast.error(`Failed to invite ${email}: ${error.message}`);
      }
    }
    
    setIsInviting(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
          <Users className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Invite Team Members</h1>
          <p className="text-sm text-muted-foreground">Add agents to your Erudite Estate team</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Agent Emails
          </CardTitle>
          <CardDescription>
            Invitations will be sent to the email addresses below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email List */}
          <div className="space-y-2">
            {emails.map((item) => (
              <div
                key={item.email}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    item.invited ? 'bg-emerald-500/10' : 'bg-accent/10'
                  }`}>
                    {item.invited ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Mail className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.invited ? 'Invitation sent' : 'Pending invitation'}
                    </p>
                  </div>
                </div>
                {!item.invited && (
                  <Button
                    size="sm"
                    onClick={() => handleInvite(item.email)}
                    disabled={isInviting}
                    className="text-xs"
                  >
                    {isInviting ? (
                      <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Sending...</>
                    ) : (
                      'Invite'
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add New Email */}
          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="agent@erudite-estate.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
              className="flex-1"
            />
            <Button onClick={handleAddEmail} variant="outline" size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Invite All Button */}
          <Button
            onClick={handleInviteAll}
            disabled={isInviting || emails.every(e => e.invited)}
            className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isInviting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending Invitations...</>
            ) : (
              <><Mail className="w-4 h-4 mr-2" /> Send All Invitations</>
            )}
          </Button>

          {emails.every(e => e.invited) && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-sm font-medium text-emerald-600">All invitations sent successfully!</p>
              <p className="text-xs text-emerald-500 mt-0.5">
                Team members will receive an email to set up their accounts
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center">
        Invited agents will receive an email with instructions to create their account and access the CRM.
      </div>
    </div>
  );
}