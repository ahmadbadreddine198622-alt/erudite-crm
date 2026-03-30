import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import ContactFolders from '@/components/contacts/ContactFolders';
import ContactList from '@/components/contacts/ContactList';
import ContactDetail from '@/components/contacts/ContactDetail';
import AddContactDialog from '@/components/contacts/AddContactDialog';
import AIInsightsPanel from '@/components/contacts/AIInsightsPanel';
import { Users } from 'lucide-react';

export default function ContactsPage() {
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contacts"
        subtitle="Manage and organize your contact database"
        icon={<Users className="w-6 h-6" />}
      />

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-200px)]">
        {/* Folders Sidebar */}
        <div className="col-span-1 border rounded-lg bg-card overflow-hidden">
          <ContactFolders selectedFolderId={selectedFolderId} onSelectFolder={setSelectedFolderId} />
        </div>

        {/* Contact List */}
        <div className="col-span-1 border rounded-lg bg-card overflow-hidden">
          <ContactList
            folderId={selectedFolderId}
            onSelectContact={setSelectedContactId}
            onAddContact={() => setShowAddDialog(true)}
          />
        </div>

        {/* Contact Detail */}
        <div className="col-span-1 border rounded-lg bg-card overflow-hidden">
          {selectedContactId ? (
            <ContactDetail contactId={selectedContactId} onClose={() => setSelectedContactId(null)} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a contact to view details
            </div>
          )}
        </div>

        {/* AI Insights & Templates */}
        <div className="col-span-1 border rounded-lg bg-card overflow-y-auto">
          <div className="p-4">
            <AIInsightsPanel selectedContactId={selectedContactId} />
          </div>
        </div>
      </div>

      <AddContactDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}