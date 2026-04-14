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
export type WasteCategory = 0 | 1 | 2 | 3 | 4 | 5;
export type CarbonSource = 0 | 1 | 2 | 3 | 4;
export type TransportType = 0 | 1 | 2 | 3 | 4 | 5;
export type GoalType = 0 | 1 | 2 | 3;
export type GoalPeriod = 0 | 1 | 2;
export type GoalStatus = 0 | 1 | 2 | 3;
export type ExportType = 0 | 1 | 2;
export type PlanName = 0 | 1 | 2;
export type SubscriptionStatus = 0 | 1 | 2 | 3 | 4;
export type ApiPermission = 0 | 1;

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

export interface WasteEntry {
  id: string;
  companyId: string;
  category: WasteCategory;
  categoryName: string | null;
  isRecyclable: boolean;
  kg: number;
  recordedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface CarbonInput {
  id: string;
  companyId: string;
  source: CarbonSource;
  transportType: TransportType | null;
  description: string | null;
  value: number;
  unit: string;
  cO2eKg: number;
  emissionFactor: number;
  recordedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface CarbonFootprintResponse {
  totalCO2eKg: number;
  totalCO2eTonnes: number;
  bySource: CategoryBreakdown[];
  monthlyTrend: Trend[];
  periodStart: string;
  periodEnd: string;
}

export interface Goal {
  id: string;
  type: GoalType;
  name: string;
  description: string | null;
  targetValue: number;
  unit: string;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  createdAt: string;
}

export interface ExportHistoryItem {
  id: string;
  fileName: string;
  exportType: ExportType;
  fileSizeBytes: number;
  createdAt: string;
  expiresAt: string;
}

export interface ExportResult {
  fileId: string;
  fileName: string;
  type: ExportType;
  downloadUrl: string;
  expiresAt: string;
  fileSizeBytes: number;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresInMinutes: number;
}

export interface Subscription {
  id: string;
  planName: PlanName;
  planDisplayName: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  recordsThisMonth: number;
  maxRecordsPerMonth: number;
  exportsThisMonth: number;
  maxExportsPerMonth: number;
}

export interface Plan {
  id: string;
  name: PlanName;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxRecordsPerMonth: number;
  maxExportsPerMonth: number;
  canExport: boolean;
  canUseApiKeys: boolean;
  canUseWebhooks: boolean;
  canAccessAdvancedReports: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permission: ApiPermission;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
