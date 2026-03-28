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
