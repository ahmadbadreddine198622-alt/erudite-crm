import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function AppLayout() {
  return (
    <div className="flex bg-background" style={{ minHeight: '100dvh' }}>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}