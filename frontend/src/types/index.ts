/* ========================================
   TypeScript Interfaces — ManagerRate
   ======================================== */

export const CATEGORIES = [
  'Leadership & Vision',
  'Communication Skills',
  'Career Development Support',
  'Work-Life Balance',
  'Fairness & Transparency',
  'Conflict Resolution',
  'Empathy & Emotional Intelligence',
  'Decision Making',
  'Team Building',
  'Accountability',
  'Technical Competence',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryRatings {
  [key: string]: number;
}

export interface Review {
  id: string;
  company: string;
  recommends: boolean;
  pros: string;
  cons: string;
  advice: string | null;
  ratings: CategoryRatings;
  helpfulCount: number;
  verified?: boolean;
  flagged?: boolean;
  createdAt: string;
}

export interface Manager {
  id: string;
  name: string;
  linkedinUrl: string;
  linkedinSlug: string;
  companies: string[];
  reviewCount: number;
  avgRating: number;
  recommendPct: number;
  categoryAvgs: CategoryRatings;
  createdAt: string;
}

export interface ManagerProfile extends Manager {
  reviewsByCompany: Record<string, Review[]>;
}

export interface DashboardStats {
  managerCount: number;
  reviewCount: number;
  companyCount: number;
  avgRating: number;
  recommendPct: number;
  categoryAvgs: CategoryRatings;
  distribution: number[];
  topManagers: { name: string; avgRating: number; reviewCount: number }[];
}

export interface ManagerListResponse {
  managers: Manager[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface ReviewSubmission {
  managerName: string;
  company: string;
  linkedinUrl: string;
  ratings: CategoryRatings;
  recommends: boolean;
  pros: string;
  cons: string;
  advice: string;
  verificationToken?: string;
}

export interface ApiError {
  error: string;
  details?: { field: string; message: string }[];
  retryAfter?: string;
}

/* ---------- Admin Types ---------- */

export interface AdminDashboardStats {
  totalReviews: number;
  totalManagers: number;
  flaggedReviews: number;
  verifiedReviews: number;
  recentReviews: number;
  avgRating: number;
}

export interface AdminReview extends Review {
  managerName: string;
  managerKey: string;
  flagged: boolean;
  verified: boolean;
  reportCount: number;
}

export interface AdminManager extends Manager {
  key: string;
  email?: string;
  flaggedReviews: number;
}

export interface AdminReviewsResponse {
  reviews: AdminReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface AdminManagersResponse {
  managers: AdminManager[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/* ---------- Verification Types ---------- */

export interface VerifySendCodeResponse {
  success: boolean;
  message: string;
  expiresIn: number;
}

export interface VerifyConfirmResponse {
  success: boolean;
  message: string;
  verificationToken: string;
}
