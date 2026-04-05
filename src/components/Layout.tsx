import { Outlet, Link, useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { LogOut, User, LayoutDashboard, BookOpen, ShieldCheck, BarChart3 } from 'lucide-react';

interface LayoutProps {
  user: UserProfile | null;
}

export default function Layout({ user }: LayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (!user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-academic-surface font-sans">
      <nav className="bg-white border-b border-academic-border px-8 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-display font-bold text-academic-primary tracking-tight flex items-center gap-2">
            <div className="w-10 h-10 bg-academic-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <BookOpen size={24} />
            </div>
            Academic<span className="text-academic-accent">Pro</span>
          </Link>
          
          <div className="flex items-center gap-8">
            <Link 
              to="/leaderboard"
              className="flex items-center gap-2 text-academic-secondary hover:text-academic-accent transition-all text-sm font-semibold"
            >
              <BarChart3 size={18} />
              Leaderboard
            </Link>
            
            <Link 
              to="/profile"
              className="flex items-center gap-2 text-academic-secondary hover:text-academic-accent transition-all text-sm font-semibold"
            >
              <User size={18} />
              Profile
            </Link>
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-500 hover:text-red-600 transition-all text-sm font-semibold"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

function Navigate({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [to, navigate]);
  return null;
}

import { useEffect } from 'react';
