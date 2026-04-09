export type UserRole = "Admin" | "Manager" | "Viewer" | 0 | 1 | 2;

export interface User {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface ConsumptionSummary {
  totalEnergyKWh: number;
  totalWaterLiters: number;
  totalWasteKg: number;
  totalCO2eKg: number;
  periodStart: string;
  periodEnd: string;
  recordCount: number;
}

export interface Trend {
  period: string;
  energyKWh: number;
  waterLiters: number;
  wasteKg: number;
  cO2eKg: number;
  energyChangePercent: number | null;
  waterChangePercent: number | null;
  wasteChangePercent: number | null;
  cO2eChangePercent: number | null;
}

export interface CategoryBreakdown {
  category: string;
  value: number;
  unit: string;
  percentageOfTotal: number;
}

export interface GoalProgress {
  goalId: string;
  name: string;
  type: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progressPercent: number;
  status: string;
  startDate: string;
  endDate: string;
  isAchieved: boolean;
  isOverdue: boolean;
}

export interface DashboardResponse {
  currentMonth: ConsumptionSummary;
  lastMonth: ConsumptionSummary;
  monthlyTrends: Trend[];
  energyByCategory: CategoryBreakdown[];
  wasteByCategory: CategoryBreakdown[];
  carbonBySource: CategoryBreakdown[];
  activeGoals: GoalProgress[];
  unreadNotifications: number;
}

export interface ApiErrorPayload {
  errors?: string[];
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export type EnergyCategory = 0 | 1 | 2 | 3 | 4 | 5;
export type WaterCategory = 0 | 1 | 2 | 3 | 4;

export interface EnergyEntry {
  id: string;
  companyId: string;
  category: EnergyCategory;
  categoryName: string | null;
  kWh: number;
  recordedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface WaterEntry {
  id: string;
  companyId: string;
  category: WaterCategory;
  categoryName: string | null;
  liters: number;
  recordedAt: string;
  notes: string | null;
  createdAt: string;
}
