import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

export default function Unauthorized() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-10 bg-white rounded-[32px] border border-[#5A5A40]/10 shadow-sm">
      <div className="h-20 w-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
        <ShieldAlert size={40} />
      </div>
      <h2 className="text-3xl font-bold text-[#5A5A40] mb-4">Access Denied</h2>
      <p className="text-[#5A5A40]/60 italic mb-10 max-w-md">
        You do not have the necessary permissions to access this page. If you believe this is an error, please contact the system administrator.
      </p>
      <Link 
        to="/" 
        className="px-10 py-4 bg-[#5A5A40] text-white rounded-full font-medium hover:bg-[#5A5A40]/90 transition-colors flex items-center gap-2"
      >
        <Home size={20} />
        Back to Home
      </Link>
    </div>
  );
}
