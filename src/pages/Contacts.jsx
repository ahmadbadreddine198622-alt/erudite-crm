import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import ContactCard from '@/components/contacts/ContactCard';

const Contacts = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm.trim()) {
        return [];
      }
      const filter = {
        $or: [
          { full_name: { $regex: debouncedSearchTerm, $options: 'i' } },
          { phone: { $regex: debouncedSearchTerm, $options: 'i' } },
          { email: { $regex: debouncedSearchTerm, $options: 'i' } },
          { whatsapp: { $regex: debouncedSearchTerm, $options: 'i' } },
        ],
      };
      return base44.entities.Contact.filter(filter, '-updated_date', 100);
    },
    enabled: !!debouncedSearchTerm.trim(),
  });

  return (
    <div className="page-root">
      <PageHeader title="Contacts" subtitle="Search and manage your contacts." />

      <div className="mt-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, phone, or email..."
            className="pl-10 text-base py-6 glass-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : !debouncedSearchTerm.trim() ? (
          <div className="text-center py-16">
            <User className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">Search Your Contacts</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You have over 13,000 contacts. Use the search bar above to find a specific contact.
            </p>
          </div>
        ) : contacts?.length > 0 ? (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {contacts.length} matching contacts.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {contacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-lg font-semibold text-foreground">No contacts found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No contacts match your search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Contacts;