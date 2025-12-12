import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Loader2, Lock, Mail, UserPlus, LogIn } from 'lucide-react';

interface AuthScreenProps {
  siteName?: string;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ siteName = "مصمم برستيج" }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('البريد الإلكتروني مستخدم بالفعل.');
      } else if (err.code === 'auth/weak-password') {
        setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل.');
      } else if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        setError('تسجيل الدخول غير مفعل في لوحة تحكم Firebase.');
      } else {
        setError(`فشل المصادقة: ${err.message || 'حاول مرة أخرى.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4" dir="rtl">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222] rounded-2xl p-8 shadow-2xl shadow-black/50">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white flex items-center justify-center gap-2">
            {siteName} <span className="text-2xl">😎</span>
          </h1>
          <p className="text-gray-500 text-sm">
            {isLogin ? 'أهلاً بعودتك! الرجاء تسجيل الدخول للمتابعة.' : 'أنشئ حساباً جديداً للبدء.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 mr-1 text-right">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg py-2.5 pr-10 pl-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors placeholder:text-gray-600 text-right"
                placeholder="name@example.com"
                required
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 mr-1 text-right">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg py-2.5 pr-10 pl-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors placeholder:text-gray-600 text-right"
                placeholder="••••••••"
                required
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : isLogin ? (
              <>
                <LogIn size={18} className="rotate-180" /> تسجيل الدخول
              </>
            ) : (
              <>
                <UserPlus size={18} /> إنشاء حساب
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#222] text-center">
          <p className="text-sm text-gray-500">
            {isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="mr-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {isLogin ? 'سجل الآن' : 'دخول'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;