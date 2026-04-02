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
    <div className="min-h-screen bg-[#f5f5f0] font-serif">
      <nav className="bg-white border-b border-[#5A5A40]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-[#5A5A40] tracking-tight">
            EduQuiz <span className="italic font-light">Pro</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link 
              to="/leaderboard"
              className="flex items-center gap-2 text-[#5A5A40] hover:text-[#5A5A40]/70 transition-colors text-sm font-medium"
            >
              <BarChart3 size={16} />
              Leaderboard
            </Link>
            
            <Link 
              to="/profile"
              className="flex items-center gap-2 text-[#5A5A40] hover:text-[#5A5A40]/70 transition-colors text-sm font-medium"
            >
              <User size={16} />
              Profile
            </Link>
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-[#5A5A40] hover:text-[#5A5A40]/70 transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
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
