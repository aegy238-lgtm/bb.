import { Play, Zap, RefreshCw, Maximize2 } from 'lucide-react';
import { FeatureItem, JobPosition } from './types';

export const FEATURES: FeatureItem[] = [
  {
    title: "معاينة SVGA",
    description: "معاينة فورية لتأثيرات رسوم SVGA المتحركة مع التحكم في التشغيل وشريط زمني للتنقل.",
    icon: Play,
    iconColor: "text-blue-500"
  },
  {
    title: "ضغط ذكي",
    description: "خوارزمية ضغط ذكية تقلل حجم الملف بشكل كبير مع الحفاظ على الجودة العالية.",
    icon: Zap,
    iconColor: "text-red-500"
  },
  {
    title: "تحويل الصيغ",
    description: "دعم التحويل إلى GIF و WebP و APNG و VAP والعديد من الصيغ الأخرى.",
    icon: RefreshCw,
    iconColor: "text-green-500"
  },
  {
    title: "تعديل الحجم",
    description: "تعديل مرن لحجم الرسوم المتحركة مع تحجيم نسبي ودعم دقة مخصصة.",
    icon: Maximize2,
    iconColor: "text-cyan-400"
  }
];

export const JOB_POSITIONS: JobPosition[] = [
  {
    id: 1,
    title: "كبير مهندسي WebGL",
    department: "الهندسة البرمجية",
    type: "دوام كامل",
    location: "عن بعد",
    description: "قيادة تطوير محرك العرض الأساسي لدينا وتحسين أداء تشغيل SVGA."
  },
  {
    id: 2,
    title: "مصمم منتجات (UI/UX)",
    department: "التصميم",
    type: "دوام كامل",
    location: "الرياض، المملكة العربية السعودية",
    description: "رسم مستقبل واجهة 'مصمم برستيج' وإنشاء تدفقات عمل بديهية للرسامين."
  },
  {
    id: 3,
    title: "أخصائي رسوم متحركة",
    department: "المحتوى",
    type: "عقد",
    location: "عن بعد",
    description: "إنشاء قوالب SVGA عالية الجودة ومساعدة المستخدمين في أفضل ممارسات تحويل الصيغ."
  },
  {
    id: 4,
    title: "مطور واجهة أمامية",
    department: "الهندسة البرمجية",
    type: "دوام كامل",
    location: "عن بعد",
    description: "بناء مكونات React قوية وضمان التوافق عبر المتصفحات لمجموعتنا البرمجية."
  }
];