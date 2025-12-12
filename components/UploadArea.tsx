import React, { useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';

interface UploadAreaProps {
  onFileSelect: (file: File) => void;
}

const UploadArea: React.FC<UploadAreaProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleContainerClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 mb-24">
      <div 
        onClick={handleContainerClick}
        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
        onDragLeave={() => setIsHovering(false)}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`
          relative flex flex-col items-center justify-center 
          h-80 rounded-2xl border-2 border-dashed 
          transition-all duration-300 cursor-pointer
          ${isHovering ? 'border-blue-500 bg-neutral-900/80' : 'border-neutral-800 bg-neutral-900/30'}
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
          accept=".svga,.json,.gif,.webp,.mp4"
        />

        <div className="text-center px-4 pointer-events-none">
          <div className="mb-6 flex justify-center">
            <FolderOpen size={48} className="text-blue-500" strokeWidth={1.5} />
          </div>
          
          <h3 className="text-2xl font-medium text-white mb-3">
            اسحب الملفات هنا أو انقر للاختيار
          </h3>
          
          <p className="text-gray-500 text-sm mb-8">
            يدعم SVGA, Lottie, GIF, WebP, MP4 وغيرها من الصيغ
          </p>

          <button className="px-6 py-2.5 rounded-lg bg-neutral-800 text-gray-200 text-sm font-medium border border-neutral-700 hover:bg-neutral-700 transition-colors">
            اختر ملفاً من جهازك
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadArea;