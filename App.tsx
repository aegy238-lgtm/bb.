import React, { useState } from 'react';
import Header from './components/Header';
import UploadArea from './components/UploadArea';
import FeatureCard from './components/FeatureCard';
import ChatWidget from './components/ChatWidget';
import Editor from './components/Editor';
import JobsModal from './components/JobsModal';
import { FEATURES } from './constants';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const App: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isJobsOpen, setIsJobsOpen] = useState(false);

  const handleFileSelect = async (file: File) => {
    setCurrentFile(file);
    
    // Log upload activity to Firestore
    try {
      await addDoc(collection(db, "activity_logs"), {
        type: 'file_upload',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'unknown',
        timestamp: serverTimestamp()
      });
      console.log("Upload logged to Firebase");
    } catch (e) {
      console.error("Error logging to Firebase:", e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white selection:bg-blue-500/30">
      
      <Header onOpenJobs={() => setIsJobsOpen(true)} />

      {currentFile ? (
        <Editor file={currentFile} />
      ) : (
        <main className="flex-grow flex flex-col items-center px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto w-full">
          
          {/* Hero Section */}
          <div className="text-center max-w-3xl mx-auto mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 flex items-center justify-center gap-3">
              <span>مصمم برستيج</span>
              <span className="text-4xl md:text-5xl">😎</span>
            </h1>
            <p className="text-gray-500 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
              Supports preview, compression, format conversion, size adjustment, image management, and audio management for SVGA, Lottie, GIF, WebP, MP4 and other formats
            </p>
          </div>

          {/* Upload Section */}
          <UploadArea onFileSelect={handleFileSelect} />

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={index} feature={feature} />
            ))}
          </div>

        </main>
      )}
      
      <ChatWidget />
      
      {isJobsOpen && (
        <JobsModal onClose={() => setIsJobsOpen(false)} />
      )}
      
      {!currentFile && (
        <footer className="py-8 text-center text-neutral-800 text-xs">
          <p>&copy; 2024 مصمم برستيج. All rights reserved.</p>
        </footer>
      )}
    </div>
  );
};

export default App;