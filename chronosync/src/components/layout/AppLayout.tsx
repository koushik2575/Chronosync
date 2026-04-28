import React from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Clock, Settings, LogOut, FileText, CheckSquare, StickyNote } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AIAssistant } from '../AIAssistant';
import { ReminderToast } from '../ReminderToast';

export function AppLayout() {
  const { appUser, logout } = useAuth();
  const location = useLocation();

  if (!appUser) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare },
    { name: 'Notes', path: '/notes', icon: StickyNote },
    { name: 'Timesheets', path: '/timesheets', icon: Clock },
    { name: 'Projects', path: '/projects', icon: FileText },
  ];

  if (appUser.role === 'admin') {
    navItems.push({ name: 'Admin Panel', path: '/admin', icon: Settings });
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <ReminderToast />
      <aside className="w-64 border-r border-slate-700 bg-slate-800 text-slate-300 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-700">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-xl mr-3">C</div>
          <h1 className="text-xl font-bold text-white tracking-tight">ChronoSync</h1>
        </div>
        <div className="flex-1 py-6 flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                  isActive 
                    ? "bg-slate-700 text-white" 
                    : "text-slate-300 hover:text-white hover:bg-slate-700"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-indigo-400" : "opacity-60")} />
                {item.name}
              </Link>
            )
          })}
        </div>
        <div className="p-4 border-t border-slate-700">
          <Link to="/profile" className="flex items-center gap-3 mb-4 px-2 hover:bg-slate-700/50 p-2 rounded-lg transition-colors group cursor-pointer block w-full text-left">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-600 border border-slate-500 flex items-center justify-center text-sm font-bold text-white uppercase group-hover:bg-slate-500 group-hover:border-slate-400 transition-colors">
              {appUser.name.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">{appUser.name}</p>
              <p className="text-xs text-slate-400 capitalize">{appUser.role}</p>
            </div>
          </Link>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-md hover:text-red-400 hover:bg-slate-700 hover:border-slate-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="h-16 border-b border-slate-200 bg-white flex items-center px-6 md:hidden">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">ChronoSync</h1>
        </div>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <Outlet />
        </div>
        <AIAssistant />
      </main>
    </div>
  );
}
