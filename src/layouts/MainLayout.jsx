import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';

function MainLayout() {

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
        {/* We're passing values from MainLayout to its child components using props. The sidebar receives the current state, while the navbar receives the function that can change it. This is called lifting state up. Instead of maintaining separate sidebar states in two components, we maintain one state in their common parent.*/}
      <Sidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <div className="flex-1 min-w-0 flex flex-col">

        <Navbar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          setIsMobileOpen={setIsMobileOpen}
        />

        <main className="flex-1 p-6">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default MainLayout;