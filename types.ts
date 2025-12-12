
export enum Currency {
  // Global
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
  
  // Arab Countries
  EGP = 'EGP', // Egypt
  SAR = 'SAR', // Saudi Arabia
  AED = 'AED', // UAE
  KWD = 'KWD', // Kuwait
  QAR = 'QAR', // Qatar
  BHD = 'BHD', // Bahrain
  OMR = 'OMR', // Oman
  JOD = 'JOD', // Jordan
  IQD = 'IQD', // Iraq
  YER = 'YER', // Yemen
  LBP = 'LBP', // Lebanon
  SYP = 'SYP', // Syria
  SDG = 'SDG', // Sudan
  LYD = 'LYD', // Libya
  TND = 'TND', // Tunisia
  DZD = 'DZD', // Algeria
  MAD = 'MAD', // Morocco
  MRU = 'MRU', // Mauritania
  SOS = 'SOS', // Somalia
  DJF = 'DJF', // Djibouti
  KMF = 'KMF'  // Comoros
}

export enum OrderStatus {
  PENDING = 'قيد الانتظار',
  COMPLETED = 'مكتمل',
  CANCELLED = 'ملغي',
  AUTO_COMPLETED = 'مكتمل تلقائياً'
}

export enum PaymentMethod {
  WALLET = 'WALLET',
  AGENT = 'AGENT'
}

export interface Order {
  id: string;
  username: string;
  userId: string;
  appName: string;
  amount: number;
  currency: Currency;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  date: string; // ISO string
  timestamp: number;
  adminMessage?: string; // New: Message from admin to user
  isRead?: boolean; // New: If user read the notification
}

export interface DashboardStats {
  visitors: number;
  totalOrders: number;
  totalAmount: number;
}

export interface AgencyConfig {
  agencyUrl: string;
  apiKey: string;
  isConnected: boolean;
  lastSync: number | null;
}

export interface User {
  id: string; // UUID
  serialId: string; // The sequential ID (e.g., 10001)
  email: string;
  password: string; // In a real app, this must be hashed
  username: string;
  balanceUSD: number;
  balanceCoins: number;
  createdAt: number;
  isBanned?: boolean; // New: Ban status
  isAdmin?: boolean; // New: Super Admin Flag
}

export type BannerStyle = 'promo' | 'info' | 'warning' | 'alert';

export interface BannerConfig {
  isVisible: boolean;
  title: string;
  message: string;
  style: BannerStyle;
}

export interface SiteConfig {
  name: string;
  slogan?: string;
}

export interface AppConfig {
    id: string;
    name: string;
    exchangeRate: number; // Coins per 1 Unit of currency (usually USD)
    isActive: boolean;
    icon?: string; // Optional icon name
}

export interface ContactConfig {
    primaryPhone: string;
    buttonLabel: string; // The text on the main button
    secondaryPhone?: string;
    tertiaryPhone?: string;
}
