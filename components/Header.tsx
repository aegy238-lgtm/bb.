import React from 'react';
import { Globe, ThumbsUp, Briefcase, LogOut, User, Shield } from 'lucide-react';

interface HeaderProps {
  siteName?: string;
  onOpenJobs?: () => void;
  onLogout?: () => void;
  userEmail?: string;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
}

const Header: React.FC<HeaderProps> = ({ siteName = "مصمم برستيج", onOpenJobs, onLogout, userEmail, isAdmin, onOpenAdmin }) => {
  return (
    <header className="w-full flex items-center justify-between px-6 py-5 text-sm z-50 relative bg-[#050505] border-b border-[#1a1a1a]">
      <div className="flex items-center gap-6">
        <a href="/" className="font-bold text-lg tracking-tight text-white hover:text-blue-500 transition-colors">
          {siteName}
        </a>
        <a 
          href="#" 
          className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white transition-colors border-b border-gray-600 pb-0.5"
        >
          متجر هدايا SVGA
          <ThumbsUp size={14} className="text-yellow-400 fill-yellow-400" />
        </a>
        <button 
          onClick={onOpenJobs}
          className="hidden md:flex items-center gap-2 text-gray-300 hover:text-blue-400 transition-colors"
        >
          وظائف
          <Briefcase size={14} className="text-gray-500" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        {isAdmin && (
          <button 
            onClick={onOpenAdmin}
            className="flex items-center gap-2 bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-all"
            title="فتح لوحة التحكم"
          >
            <Shield size={14} />
            <span className="hidden md:inline font-medium">لوحة التحكم</span>
          </button>
        )}

        {userEmail && (
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 bg-[#111] px-3 py-1.5 rounded-full border border-[#222]">
            <User size={12} />
            <span className="max-w-[150px] truncate" dir="ltr">{userEmail}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 cursor-pointer hover:text-gray-300 transition-colors text-gray-400">
          <span>العربية</span>
          <Globe size={16} />
        </div>

        {onLogout && (
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors mr-2"
            title="تسجيل الخروج"
          >
            <LogOut size={16} className="rotate-180" />
            <span className="hidden md:inline">خروج</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;