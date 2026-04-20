export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  network: 'BEP20' | 'TRC20';
  txid: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  network: 'BEP20' | 'TRC20';
  wallet_address: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface UserDashboard {
  total_balance: number;
  total_earnings: number;
  today_profit: number;
  team_earnings: number;
  available_balance: number;
  deposit_balance: number;
  withdrawable_balance: number;
  referral_code: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  apy: number;
  duration_days: number;
  image_url: string;
  type: 'stake' | 'task';
  min_vip_level: number;
}

export interface Reserve {
  id: string;
  user_id: string;
  product_id: string;
  amount: number;
  sell_available_at: string;
  status: 'active' | 'sold';
  created_at: string;
}

export interface TeamData {
  permanent_id: string;
  referral_code: string;
  direct_members: number;
  indirect_members: number;
  total_team_volume: number;
  team_members_a: number;
  team_members_b: number;
  team_members_c: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'reward' | 'reserve';
  amount: number;
  status: 'completed' | 'pending' | 'accrued' | 'locked';
  created_at: string;
  description: string;
}

export interface SystemSettings {
  id: string;
  announcement_text: string;
  maintenance_mode: boolean;
  min_deposit: number;
  min_withdrawal: number;
  withdrawal_fee: number;
  referral_bonus_percent: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user';
  total_balance: number;
  available_balance: number;
  deposit_balance: number;
  withdrawable_balance: number;
  referral_code: string;
  referred_by: string | null;
  permanent_id: string;
  vip_level: number;
  two_fa_enabled: boolean;
  two_fa_secret: string | null;
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  kyc_document_type: string | null;
  kyc_document_number: string | null;
  kyc_document_url: string | null;
  kyc_selfie_url: string | null;
  kyc_rejection_reason: string | null;
  created_at: string;
}

export interface SocialTask {
  id: string;
  platform: 'telegram' | 'twitter' | 'youtube' | 'facebook' | 'instagram' | 'other';
  title: string;
  description: string;
  link: string;
  reward_amount: number;
  is_active: boolean;
  created_at: string;
}

export interface UserSocialTask {
  id: string;
  user_id: string;
  task_id: string;
  status: 'pending' | 'completed' | 'rejected';
  username_submitted: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'closed' | 'pending';
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export interface DailyEarning {
  date: string;
  amount: number;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
