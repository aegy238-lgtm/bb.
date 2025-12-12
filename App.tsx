import React, { useState, useEffect } from 'react';
import { Menu, Bell, Sparkles, MessageCircle, Package } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StatsCards from './components/StatsCards';
import RecentOrders from './components/RecentOrders';
import NewOrderForm from './components/NewOrderForm';
import AgencyIntegration from './components/AgencyIntegration';
import LoginForm from './components/LoginForm';
import UserAuth from './components/UserAuth';
import UserProfile from './components/UserProfile';
import UserHistory from './components/UserHistory';
import AdminWallet from './components/AdminWallet';
import AdminOrders from './components/AdminOrders';
import HeroBanner from './components/HeroBanner';
import AdminBannerSettings from './components/AdminBannerSettings';
import AdminAppsSettings from './components/AdminAppsSettings';
import AdminContactSettings from './components/AdminContactSettings';
import AdminGeneralSettings from './components/AdminGeneralSettings';
import { getOrders, getStats, initializeData, getCurrentUser, updateOrder, logoutUser, getSiteConfig } from './services/storageService';
import { Order, DashboardStats, SiteConfig } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Initialize dummy data
initializeData();

type ViewState = 'dashboard' | 'new-order' | 'agency-integration' | 'user-auth' | 'admin-wallet' | 'user-profile' | 'admin-orders' | 'user-history';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('new-order');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ visitors: 0, totalOrders: 0, totalAmount: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Site Configuration
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({ name: 'منصة حنين', slogan: '' });

  // Auth States
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  // Load data function
  const refreshData = () => {
    setOrders(getOrders());
    setStats(getStats());
    const config = getSiteConfig();
    setSiteConfig(config);
    document.title = config.name; // Update Browser Title

    // Only refresh user if logged in to avoid unnecessary storage hits on landing
    const user = getCurrentUser();
    if (user) {
        setCurrentUser(user);
        // If it's the Super Admin, ensure admin access is granted
        if (user.isAdmin && !isAuthenticatedAdmin) {
            setIsAuthenticatedAdmin(true);
        }
    }
  };

  useEffect(() => {
    refreshData();
    // Check initially
    const user = getCurrentUser();
    if (user?.isAdmin) {
        setIsAuthenticatedAdmin(true);
        setActiveView('dashboard');
    }

    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Prepare chart data (Last 5 orders amount)
  const chartData = orders.slice(0, 7).reverse().map(o => ({
    name: o.username.split(' ')[0], 
    amount: o.amount
  }));

  const handleOrderSuccess = () => {
    refreshData();
  };

  const handleUserLoginSuccess = () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user?.isAdmin) {
        setIsAuthenticatedAdmin(true);
        setActiveView('dashboard'); // Redirect admin directly to dashboard
    } else {
        setActiveView('new-order');
    }
  }

  const handleUserLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setActiveView('new-order');
    setIsAuthenticatedAdmin(false);
  }

  // Filter notifications for the current user
  const userNotifications = currentUser ? orders.filter(o => 
    o.userId === currentUser.serialId && 
    o.adminMessage && 
    !o.isRead
  ) : [];

  const handleMarkAsRead = (orderId: string) => {
    updateOrder(orderId, { isRead: true });
    refreshData();
    setActiveView('user-history'); // Optional: Redirect to history when clicking notification
    setShowNotifications(false);
  };

  // --- GATEKEEPER: FORCE LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] -ml-32 -mb-32"></div>
        </div>

        <div className="w-full max-w-md space-y-8 relative z-10 animate-fade-in">
            <div className="text-center">
                <div className="inline-flex p-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 shadow-2xl mb-8">
                    <Package className="w-16 h-16 text-emerald-500" />
                </div>
                <h1 className="text-4xl font-black text-white mb-3 tracking-tight">{siteConfig.name}</h1>
                <p className="text-slate-400 text-lg">{siteConfig.slogan || 'سجل الدخول لإدارة طلباتك وشحن ألعابك المفضلة'}</p>
            </div>
            
            {/* Login Component */}
            <UserAuth onSuccess={handleUserLoginSuccess} />
            
            <div className="text-center space-y-4">
              <p className="text-slate-600 text-sm">
                  &copy; {new Date().getFullYear()} جميع الحقوق محفوظة لـ {siteConfig.name}
              </p>
            </div>
        </div>
      </div>
    );
  }

  // Helper to allow admin bypass or require secondary auth for sensitive areas (optional, currently bypassing if isAdmin)
  const isAuthorizedAdmin = isAuthenticatedAdmin || currentUser?.isAdmin;

  // --- MAIN APP (AUTHENTICATED) ---
  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans" onClick={() => setShowNotifications(false)}>
      
      {/* Sidebar Navigation */}
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isAdmin={isAuthorizedAdmin}
        setIsAdmin={setIsAuthenticatedAdmin}
        onLogoutUser={handleUserLogout}
        siteName={siteConfig.name}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:mr-64">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-20 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              {activeView === 'dashboard' ? 'لوحة القيادة' : 
               activeView === 'new-order' ? 'طلب شحن جديد' : 
               activeView === 'agency-integration' ? 'دمج الوكالة' :
               activeView === 'admin-wallet' ? 'إدارة الأرصدة' :
               activeView === 'admin-orders' ? 'طلبات الشحن' :
               activeView === 'user-auth' ? 'دخول / تسجيل' : 
               activeView === 'user-profile' ? 'الملف الشخصي' : 
               activeView === 'user-history' ? 'سجل عملياتي' : ''}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {currentUser && (
               <div className="hidden md:flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                  <span className="text-sm font-bold text-green-600">${currentUser.balanceUSD.toFixed(2)}</span>
                  <div className="w-px h-4 bg-slate-300"></div>
                  <span className="text-sm font-bold text-yellow-600">{currentUser.balanceCoins} 🪙</span>
               </div>
            )}

            {/* Notifications Bell */}
            <div className="relative">
                <div 
                    onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full cursor-pointer transition-colors relative"
                >
                    <Bell className="w-6 h-6" />
                    {userNotifications.length > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                    )}
                </div>

                {/* Dropdown */}
                {showNotifications && (
                    <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-fade-in">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 text-sm">الإشعارات</h3>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{userNotifications.length} جديد</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {userNotifications.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-sm">لا توجد إشعارات جديدة</div>
                            ) : (
                                userNotifications.map(notification => (
                                    <div key={notification.id} className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleMarkAsRead(notification.id)}>
                                        <div className="flex items-start gap-2 mb-2">
                                           <MessageCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                           <p className="text-sm text-slate-600 font-medium">{notification.adminMessage}</p>
                                        </div>
                                        <div className="flex justify-between items-center pl-6">
                                            <span className="text-xs text-slate-400">{new Date(notification.timestamp).toLocaleTimeString('ar-EG')}</span>
                                            <span className="text-xs text-emerald-600 font-bold hover:underline">عرض التفاصيل</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 shadow-sm
                ${currentUser?.isAdmin ? 'bg-purple-600 text-white border-purple-300' : 'bg-emerald-100 text-emerald-700 border-white'}`}>
              {currentUser?.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="p-6 overflow-y-auto h-[calc(100vh-5rem)]">
          
          {/* SHOW HERO BANNER ONLY ON USER VIEWS (Not Auth or Admin) */}
          {activeView === 'new-order' && <HeroBanner />}

          {/* MAIN INTERFACE (NEW ORDER FORM) - RESTORED */}
          {activeView === 'new-order' && (
             <div className="animate-fade-in">
                <NewOrderForm onOrderSuccess={handleOrderSuccess} />
             </div>
          )}

          {/* USER AUTH VIEW - (Used inside sidebar if logic permits, but mostly handled by gatekeeper now) */}
          {activeView === 'user-auth' && (
             <div className="animate-fade-in py-4">
                <UserAuth onSuccess={handleUserLoginSuccess} />
             </div>
          )}

          {/* USER PROFILE VIEW */}
          {activeView === 'user-profile' && (
             <div className="animate-fade-in py-4">
                <UserProfile />
             </div>
          )}

          {/* USER HISTORY VIEW */}
          {activeView === 'user-history' && (
             <div className="animate-fade-in py-4">
                <UserHistory />
             </div>
          )}

          {/* ADMIN WALLET VIEW */}
          {activeView === 'admin-wallet' && (
             !isAuthorizedAdmin ? (
               <LoginForm onLogin={() => setIsAuthenticatedAdmin(true)} />
             ) : (
               <AdminWallet />
             )
          )}

          {/* ADMIN ORDERS VIEW */}
          {activeView === 'admin-orders' && (
             !isAuthorizedAdmin ? (
               <LoginForm onLogin={() => setIsAuthenticatedAdmin(true)} />
             ) : (
               <AdminOrders />
             )
          )}

          {/* DASHBOARD VIEW */}
          {activeView === 'dashboard' && (
            !isAuthorizedAdmin ? (
              <LoginForm onLogin={() => setIsAuthenticatedAdmin(true)} />
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* Dashboard Stats */}
                <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-xl border border-slate-700/50 mb-8">
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-right space-y-3">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 font-bold tracking-wider text-sm bg-emerald-500/10 px-3 py-1 rounded-full">تحديث مباشر</span>
                      </div>
                      <h2 className="text-3xl font-black">لوحة تحكم الأدمن</h2>
                      <p className="text-slate-400 max-w-md">مرحباً بك في لوحة الإدارة. يمكنك متابعة الإحصائيات، إدارة الطلبات، وتعديل إعدادات الموقع بالكامل من هنا.</p>
                    </div>
                  </div>
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-16 -mb-16"></div>
                </div>

                <StatsCards stats={stats} />
                
                {/* Admin Panels Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <RecentOrders orders={orders} />
                        {/* Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                          <h3 className="text-lg font-bold text-slate-800 mb-4">تحليل المبيعات (آخر 7 طلبات)</h3>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Admin Settings Components */}
                        <AdminGeneralSettings />
                        <AdminContactSettings />
                        <AdminAppsSettings />
                        <AdminBannerSettings />
                    </div>
                </div>
              </div>
            )
          )}

          {/* AGENCY INTEGRATION VIEW */}
          {activeView === 'agency-integration' && (
             !isAuthorizedAdmin ? (
                <LoginForm onLogin={() => setIsAuthenticatedAdmin(true)} />
             ) : (
                <AgencyIntegration />
             )
          )}

        </main>
      </div>
    </div>
  );
};

export default App;