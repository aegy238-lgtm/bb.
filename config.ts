import { ContactConfig, AppConfig, BannerConfig } from './types';

// =================================================================
// ملف الإعدادات العامة (Global Configuration)
// لتحديث البيانات لجميع المستخدمين، قم بتعديل القيم هنا مباشرة
// =================================================================

// 1. إعدادات التواصل (واتساب)
export const GLOBAL_CONTACT_CONFIG: ContactConfig = {
    primaryPhone: '201033851941',         // <-- رقم الواتساب الأساسي
    buttonLabel: 'إرسال الطلب للوكيل (واتساب)', // النص على الزر
    secondaryPhone: '',                   // رقم إضافي (اختياري)
    tertiaryPhone: ''                     // رقم إضافي (اختياري)
};

// 2. إعدادات البانر الإعلاني (الشريط العلوي)
export const GLOBAL_BANNER_CONFIG: BannerConfig = {
    isVisible: true,
    title: 'تنبيه هام! 🚀',
    message: 'تم تحديث أرقام الواتساب والأسعار. يرجى التأكد من البيانات قبل التحويل.',
    style: 'warning' // خيارات: 'promo' (بنفسجي), 'info' (أزرق), 'warning' (برتقالي), 'alert' (أحمر)
};

// 3. التطبيقات المتاحة وأسعار الصرف
export const GLOBAL_APPS_CONFIG: AppConfig[] = [
    { id: '1', name: 'PUBG Mobile', exchangeRate: 60, isActive: true },
    { id: '2', name: 'TikTok', exchangeRate: 70, isActive: true },
    { id: '3', name: 'Coco Live', exchangeRate: 7500, isActive: true },
    { id: '4', name: 'Ludo Club', exchangeRate: 100, isActive: true }
];