import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}