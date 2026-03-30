namespace Greenlytics.Domain.Enums;

public enum UserRole { Admin, Manager, Viewer }

public enum PlanName { Basic, Pro, Enterprise }

public enum SubscriptionStatus { Active, Trialing, PastDue, Canceled, Incomplete }

public enum EnergyCategory { Office, Factory, Warehouse, DataCenter, RetailStore, Other }

public enum WaterCategory { Office, Irrigation, Manufacturing, Cooling, Other }

public enum WasteCategory { GeneralWaste, Recyclable, Hazardous, Electronic, Organic, Other }

public enum CarbonSource { Transport, Electricity, NaturalGas, Aviation, Other }

public enum TransportType { Car, Truck, Bus, Train, Ship, Motorcycle }

public enum GoalType { Energy, Water, Waste, Carbon }

public enum GoalPeriod { Monthly, Quarterly, Yearly }

public enum GoalStatus { Active, Achieved, Missed, Cancelled }

public enum ExportType { PDF, Excel, CSV }

public enum NotificationType { ThresholdExceeded, GoalAchieved, GoalMissed, WeeklyReport, MonthlyReport, PaymentFailed }

public enum AuditAction { Create, Update, Delete }

public enum ApiPermission { Read, Write }
