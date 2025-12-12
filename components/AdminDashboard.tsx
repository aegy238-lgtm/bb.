import React, { useEffect, useState } from 'react';
import { X, BarChart3, FileText, Users, Activity, Search, Shield, Calendar, Download, Folder, Image, Video, UserX, UserCheck, ShieldAlert, BadgeCheck, Lock, Key, Loader2, Mail } from 'lucide-react';
import { db, auth, secondaryAuth } from '../firebase'; // Import secondaryAuth
import { createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth'; // Import auth functions
import { collection, query, orderBy, limit, getDocs, where, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AdminDashboardProps {
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'jobs' | 'files' | 'users'>('overview');
  const [stats, setStats] = useState({ users: 0, uploads: 0, applications: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Admin Creation
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // Define the Owner Email (The Super Admin)
  const OWNER_EMAIL = "admin@prestigedesigner.com";

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // General stats always fetched for overview or counts
      const uploadsQuery = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(100));
      const appsQuery = query(collection(db, "job_applications"), orderBy("appliedAt", "desc"), limit(100));
      
      const uploadsSnap = await getDocs(uploadsQuery);
      const appsSnap = await getDocs(appsQuery);
      
      // Get User Count (from actual users collection now)
      const usersSnapshot = await getDocs(collection(db, "users"));
      
      setStats({
        users: usersSnapshot.size,
        uploads: uploadsSnap.size,
        applications: appsSnap.size
      });

      if (activeTab === 'activity') {
        setActivities(uploadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'jobs') {
        setApplications(appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else if (activeTab === 'files') {
        const allLogs = uploadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUploadedFiles(allLogs.filter((log: any) => log.fileUrl));
      } else if (activeTab === 'users') {
        const usersQ = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const userSnap = await getDocs(usersQ);
        setUsersList(userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
      
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('ar-EG', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('video')) return <Video size={24} className="text-purple-400" />;
    if (type.includes('image')) return <Image size={24} className="text-blue-400" />;
    return <FileText size={24} className="text-gray-400" />;
  };

  // --- Actions ---

  const handleBanUser = async (userId: string, userEmail: string, currentStatus: boolean) => {
    // Protection 1: Check if target is Owner
    if (userEmail === OWNER_EMAIL) {
      alert("⚠️ تنبيه أمني: لا يمكن حظر مالك الموقع نهائياً.");
      return;
    }

    // Protection 2: Check if target is Self (Current Logged in Admin)
    if (auth.currentUser && auth.currentUser.uid === userId) {
      alert("⚠️ تنبيه: لا يمكنك حظر نفسك!");
      return;
    }

    if (!confirm(currentStatus ? "هل أنت متأكد من فك الحظر عن هذا المستخدم؟" : "هل أنت متأكد من حظر هذا المستخدم ومنعه من الدخول؟")) return;
    
    try {
      await updateDoc(doc(db, "users", userId), { isBanned: !currentStatus });
      // Refresh local list
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, isBanned: !currentStatus } : u));
    } catch (e) { alert("حدث خطأ أثناء تحديث الحالة"); }
  };

  const handleToggleAdmin = async (userId: string, userEmail: string, currentRole: string) => {
    // Protection: Cannot demote the Owner
    if (userEmail === OWNER_EMAIL && currentRole === 'admin') {
      alert("⚠️ تنبيه أمني: لا يمكن سحب صلاحيات المالك.");
      return;
    }

    // Protection: Cannot demote Self
    if (auth.currentUser && auth.currentUser.uid === userId && currentRole === 'admin') {
        if(!confirm("تحذير: أنت على وشك إزالة صلاحيات المشرف من حسابك الحالي. هل أنت متأكد؟")) return;
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(currentRole === 'admin' ? "تنزيل هذا المشرف إلى مستخدم عادي؟" : "ترقية هذا المستخدم إلى مشرف (Admin)؟")) return;
    
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) { alert("حدث خطأ أثناء تحديث الصلاحيات"); }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword) {
        alert("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
        return;
    }
    if (newAdminPassword.length < 6) {
        alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
        return;
    }

    setIsCreatingAdmin(true);

    try {
      // 1. Create User in Authentication (Using Secondary App to avoid logging out admin)
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newAdminEmail, newAdminPassword);
      const newUid = userCred.user.uid;

      // 2. Create User Profile in Firestore with 'admin' role
      await setDoc(doc(db, "users", newUid), {
        uid: newUid,
        email: newAdminEmail,
        createdAt: serverTimestamp(),
        role: 'admin', // DIRECTLY SET AS ADMIN
        isBanned: false,
        createdBy: auth.currentUser?.email || 'Unknown Admin'
      });

      // 3. Sign out the secondary user so the auth instance is clean
      await secondarySignOut(secondaryAuth);

      alert(`✅ تم إنشاء حساب المشرف بنجاح!\n\nالبريد: ${newAdminEmail}\nكلمة المرور: ${newAdminPassword}`);
      
      setNewAdminEmail('');
      setNewAdminPassword('');
      setShowAddAdmin(false);
      fetchData(); // Refresh the list
      
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/email-already-in-use') {
        alert("هذا البريد الإلكتروني مسجل بالفعل. يمكنك البحث عنه في القائمة وترقيته.");
      } else {
        alert("حدث خطأ أثناء إنشاء الحساب: " + e.message);
      }
    } finally {
        setIsCreatingAdmin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <div className="w-full h-full md:w-[90vw] md:h-[90vh] bg-[#050505] md:rounded-2xl border border-[#222] flex flex-col md:flex-row overflow-hidden shadow-2xl">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-[#0a0a0a] border-b md:border-b-0 md:border-l border-[#1a1a1a] flex flex-col">
          <div className="p-6 border-b border-[#1a1a1a] flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
              <Shield className="text-blue-500" size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white tracking-tight">لوحة الإدارة</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">صلاحيات المالك</p>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'}`}
            >
              <BarChart3 size={18} /> نظرة عامة
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'}`}
            >
              <Users size={18} /> المستخدمين والصلاحيات
            </button>
            <button 
              onClick={() => setActiveTab('activity')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'activity' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'}`}
            >
              <Activity size={18} /> سجل النشاط
            </button>
            <button 
              onClick={() => setActiveTab('files')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'}`}
            >
              <Folder size={18} /> ملفات المستخدمين
            </button>
            <button 
              onClick={() => setActiveTab('jobs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'jobs' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'}`}
            >
              <FileText size={18} /> طلبات التوظيف
              {stats.applications > 0 && <span className="mr-auto bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.applications}</span>}
            </button>
          </nav>

          <div className="p-4 border-t border-[#1a1a1a]">
             <button onClick={onClose} className="w-full flex items-center gap-2 justify-center px-4 py-2 rounded border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 text-xs transition-colors">
               <X size={14} /> إغلاق اللوحة
             </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
          {/* Header */}
          <header className="h-16 border-b border-[#1a1a1a] flex items-center justify-between px-6 bg-[#0a0a0a]/50 backdrop-blur-sm sticky top-0 z-10">
            <h3 className="text-lg font-medium text-white capitalize">
              {activeTab === 'overview' && 'نظرة عامة'}
              {activeTab === 'users' && 'إدارة المستخدمين والصلاحيات'}
              {activeTab === 'activity' && 'النشاط المباشر'}
              {activeTab === 'files' && 'إدارة الملفات'}
              {activeTab === 'jobs' && 'الطلبات المقدمة'}
            </h3>
            <div className="flex items-center gap-3">
               <div className="hidden md:flex items-center gap-2 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5">
                 <Search size={14} className="text-gray-500"/>
                 <input type="text" placeholder="بحث..." className="bg-transparent border-none text-xs text-white focus:outline-none w-40 text-right" />
               </div>
               <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  النظام متصل
               </div>
            </div>
          </header>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-blue-500/10 rounded-lg"><Users className="text-blue-500" size={20} /></div>
                      <span className="text-xs text-green-500 font-medium">+12%</span>
                    </div>
                    <h4 className="text-gray-400 text-sm">المستخدمين المسجلين</h4>
                    <p className="text-2xl font-bold text-white mt-1">{stats.users}</p>
                  </div>
                  <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-purple-500/10 rounded-lg"><Activity className="text-purple-500" size={20} /></div>
                      <span className="text-xs text-green-500 font-medium">مباشر</span>
                    </div>
                    <h4 className="text-gray-400 text-sm">عمليات الرفع الحديثة</h4>
                    <p className="text-2xl font-bold text-white mt-1">{stats.uploads}</p>
                  </div>
                  <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-orange-500/10 rounded-lg"><FileText className="text-orange-500" size={20} /></div>
                    </div>
                    <h4 className="text-gray-400 text-sm">طلبات التوظيف</h4>
                    <p className="text-2xl font-bold text-white mt-1">{stats.applications}</p>
                  </div>
                </div>

                <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
                   <BarChart3 size={48} className="text-gray-700 mb-4" />
                   <h4 className="text-gray-300 font-medium mb-2">منطقة الرسوم البيانية</h4>
                   <p className="text-gray-500 text-sm max-w-sm">
                     هنا ستظهر الرسوم البيانية التفصيلية لتحليلات الاستخدام والمستخدمين.
                   </p>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                   <p className="text-sm text-gray-400">تحكم في صلاحيات المستخدمين، حظر الحسابات، وإنشاء حسابات مشرفين جدد.</p>
                   <button 
                     onClick={() => setShowAddAdmin(!showAddAdmin)}
                     className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
                   >
                     <ShieldAlert size={14} /> إضافة مشرف جديد
                   </button>
                </div>

                {showAddAdmin && (
                  <div className="bg-[#111] border border-blue-500/30 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-4">
                     <h4 className="text-white font-medium mb-3 text-sm flex items-center gap-2"><Lock size={14} className="text-blue-500"/> إنشاء حساب مشرف</h4>
                     <form onSubmit={handleAddAdmin} className="flex flex-col md:flex-row gap-3">
                       <div className="flex-1 relative">
                         <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
                         <input 
                           type="email" 
                           placeholder="البريد الإلكتروني..." 
                           className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 pr-9 text-sm text-white focus:border-blue-500 outline-none text-right"
                           value={newAdminEmail}
                           onChange={(e) => setNewAdminEmail(e.target.value)}
                           required
                         />
                       </div>
                       <div className="flex-1 relative">
                         <Key className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
                         <input 
                           type="text" 
                           placeholder="كلمة المرور..." 
                           className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 pr-9 text-sm text-white focus:border-blue-500 outline-none text-right"
                           value={newAdminPassword}
                           onChange={(e) => setNewAdminPassword(e.target.value)}
                           required
                         />
                       </div>
                       <button 
                        type="submit" 
                        disabled={isCreatingAdmin}
                        className="px-6 py-2 bg-white text-black text-sm font-medium rounded hover:bg-gray-200 flex items-center justify-center min-w-[100px]"
                       >
                         {isCreatingAdmin ? <Loader2 className="animate-spin" size={16}/> : 'إنشاء الحساب'}
                       </button>
                     </form>
                     <p className="text-[10px] text-gray-500 mt-2">
                       سيتم إنشاء الحساب في النظام فوراً وإعطاؤه صلاحيات المشرف (Admin) تلقائياً.
                     </p>
                  </div>
                )}

                <div className="bg-[#0f0f0f] border border-[#222] rounded-xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-[#151515] text-gray-400 border-b border-[#222]">
                      <tr>
                        <th className="p-4 font-medium">المستخدم</th>
                        <th className="p-4 font-medium">تاريخ التسجيل</th>
                        <th className="p-4 font-medium">الدور (الصلاحية)</th>
                        <th className="p-4 font-medium">الحالة</th>
                        <th className="p-4 font-medium text-left">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {loading ? (
                         <tr><td colSpan={5} className="p-8 text-center text-gray-500">جاري تحميل المستخدمين...</td></tr>
                      ) : usersList.length === 0 ? (
                         <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا يوجد مستخدمين مسجلين.</td></tr>
                      ) : (
                        usersList.map((user) => (
                          <tr key={user.id} className="hover:bg-[#1a1a1a] transition-colors">
                            <td className="p-4 text-white">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.role === 'admin' ? 'bg-blue-600 text-white' : 'bg-[#222] text-gray-400'}`}>
                                  {user.email?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium" dir="ltr">{user.email}</span>
                                  <span className="text-[10px] text-gray-500 font-mono">ID: {user.uid?.slice(0, 6)}...</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                            <td className="p-4">
                               {user.role === 'admin' ? (
                                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium">
                                   <BadgeCheck size={12} /> مشرف (Admin)
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700 text-xs">
                                   مستخدم
                                 </span>
                               )}
                            </td>
                            <td className="p-4">
                               {user.isBanned ? (
                                 <span className="text-red-500 font-medium text-xs flex items-center gap-1"><UserX size={12}/> محظور</span>
                               ) : (
                                 <span className="text-green-500 font-medium text-xs flex items-center gap-1"><UserCheck size={12}/> نشط</span>
                               )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleToggleAdmin(user.id, user.email, user.role)}
                                  className={`p-2 rounded transition-colors ${user.email === OWNER_EMAIL ? 'opacity-30 cursor-not-allowed bg-[#111] text-gray-600' : 'bg-[#222] hover:bg-blue-600 hover:text-white text-gray-400'}`}
                                  title={user.email === OWNER_EMAIL ? 'لا يمكن تعديل المالك' : (user.role === 'admin' ? 'تنزيل لمستخدم' : 'ترقية لمشرف')}
                                  disabled={user.email === OWNER_EMAIL}
                                >
                                  {user.role === 'admin' ? <Users size={14}/> : <Shield size={14}/>}
                                </button>
                                <button 
                                  onClick={() => handleBanUser(user.id, user.email, user.isBanned)}
                                  className={`p-2 rounded transition-colors ${
                                    (user.email === OWNER_EMAIL || user.uid === auth.currentUser?.uid)
                                      ? 'opacity-30 cursor-not-allowed bg-[#111] text-gray-600'
                                      : (user.isBanned ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[#222] text-red-400 hover:bg-red-600 hover:text-white')
                                  }`}
                                  title={
                                      user.email === OWNER_EMAIL ? 'لا يمكن حظر المالك' : 
                                      user.uid === auth.currentUser?.uid ? 'لا يمكنك حظر نفسك' : 
                                      (user.isBanned ? 'فك الحظر' : 'حظر المستخدم')
                                  }
                                  disabled={user.email === OWNER_EMAIL || user.uid === auth.currentUser?.uid}
                                >
                                  {user.isBanned ? <UserCheck size={14}/> : <UserX size={14}/>}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {loading ? (
                   <div className="col-span-full text-center text-gray-500 py-10">جاري تحميل الملفات...</div>
                ) : uploadedFiles.length === 0 ? (
                   <div className="col-span-full text-center text-gray-500 py-10 bg-[#0f0f0f] rounded-xl border border-[#222]">لا توجد ملفات مرفوعة حتى الآن.</div>
                ) : (
                  uploadedFiles.map((file) => (
                    <div key={file.id} className="group relative bg-[#111] border border-[#222] rounded-xl p-3 hover:border-blue-500 transition-all flex flex-col">
                      <div className="aspect-square bg-[#0a0a0a] rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                         {file.fileType && file.fileType.startsWith('image') ? (
                           <img src={file.fileUrl} alt={file.fileName} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                         ) : (
                           getFileIcon(file.fileType || '')
                         )}
                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500">
                              <Download size={18} />
                            </a>
                         </div>
                      </div>
                      <div className="mt-auto">
                        <h4 className="text-gray-200 text-xs font-medium truncate mb-1" title={file.fileName}>{file.fileName}</h4>
                        <p className="text-[10px] text-gray-500 truncate">{file.userEmail}</p>
                        <p className="text-[10px] text-gray-600 mt-1 text-right">{formatDate(file.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="bg-[#0f0f0f] border border-[#222] rounded-xl overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-[#151515] text-gray-400 border-b border-[#222]">
                    <tr>
                      <th className="p-4 font-medium text-right">المستخدم</th>
                      <th className="p-4 font-medium text-right">الإجراء</th>
                      <th className="p-4 font-medium text-right">اسم الملف</th>
                      <th className="p-4 font-medium text-right">الحجم</th>
                      <th className="p-4 font-medium text-left">الوقت</th>
                      <th className="p-4 font-medium text-left">تحميل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {loading ? (
                       <tr><td colSpan={6} className="p-8 text-center text-gray-500">جاري التحميل...</td></tr>
                    ) : activities.length === 0 ? (
                       <tr><td colSpan={6} className="p-8 text-center text-gray-500">لا يوجد نشاط.</td></tr>
                    ) : (
                      activities.map((log) => (
                        <tr key={log.id} className="hover:bg-[#1a1a1a] transition-colors">
                          <td className="p-4 text-white">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-[10px]">
                                {log.userEmail?.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate max-w-[150px]" dir="ltr">{log.userEmail}</span>
                            </div>
                          </td>
                          <td className="p-4 text-blue-400 font-medium text-xs uppercase tracking-wider">{log.type}</td>
                          <td className="p-4 text-gray-300" dir="ltr">{log.fileName}</td>
                          <td className="p-4 text-gray-500 font-mono text-xs">{(log.fileSize ? log.fileSize / 1024 : 0).toFixed(1)} KB</td>
                          <td className="p-4 text-gray-500 text-left text-xs">{formatDate(log.timestamp)}</td>
                          <td className="p-4 text-left">
                             {log.fileUrl ? (
                               <a href={log.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-xs border border-blue-600/20">
                                 <Download size={14} /> تحميل
                               </a>
                             ) : (
                               <span className="text-gray-600 text-xs">-</span>
                             )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'jobs' && (
              <div className="grid gap-4">
                {loading ? (
                   <div className="text-center text-gray-500 py-10">جاري تحميل الطلبات...</div>
                ) : applications.length === 0 ? (
                   <div className="text-center text-gray-500 py-10 bg-[#0f0f0f] rounded-xl border border-[#222]">لا توجد طلبات.</div>
                ) : (
                  applications.map((app) => (
                    <div key={app.id} className="bg-[#0f0f0f] border border-[#222] rounded-xl p-5 hover:border-blue-500/50 transition-all flex justify-between items-center group">
                      <div>
                        <h4 className="text-white font-medium mb-1">{app.jobTitle}</h4>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Shield size={12}/> {app.department}</span>
                          <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(app.appliedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] border border-yellow-500/20 uppercase font-medium">
                           {app.status === 'pending' ? 'قيد الانتظار' : app.status}
                         </span>
                         <button className="p-2 bg-[#1a1a1a] hover:bg-blue-600 hover:text-white rounded text-gray-400 transition-colors" title="تحميل السيرة الذاتية">
                           <Download size={16} />
                         </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;