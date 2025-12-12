import React from 'react';
import { Globe, ThumbsUp, Briefcase } from 'lucide-react';

interface HeaderProps {
  onOpenJobs?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenJobs }) => {
  return (
    <header className="w-full flex items-center justify-between px-6 py-5 text-sm z-50 relative">
      <div className="flex items-center gap-6">
        <a href="/" className="font-bold text-lg tracking-tight text-white hover:text-blue-500 transition-colors">
          مصمم برستيج
        </a>
        <a 
          href="#" 
          className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white transition-colors border-b border-gray-600 pb-0.5"
        >
          SVGA Gift Store
          <ThumbsUp size={14} className="text-yellow-400 fill-yellow-400" />
        </a>
        <button 
          onClick={onOpenJobs}
          className="hidden md:flex items-center gap-2 text-gray-300 hover:text-blue-400 transition-colors"
        >
          Careers
          <Briefcase size={14} className="text-gray-500" />
        </button>
      </div>

      <div className="flex items-center gap-2 cursor-pointer hover:text-gray-300 transition-colors">
        <span>English</span>
        <Globe size={16} />
      </div>
    </header>
  );
};

export default Header;