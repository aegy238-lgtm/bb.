import React from 'react';
import { MessageSquare } from 'lucide-react';

const ChatWidget: React.FC = () => {
  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button className="w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/20 transition-all hover:scale-105">
        <MessageSquare className="text-white fill-white" size={24} />
      </button>
    </div>
  );
};

export default ChatWidget;