using Greenlytics.Domain.Enums;

namespace Greenlytics.Application.Common.Models;

// ── Generic wrappers ─────────────────────────────────────────────────────────

public record Result(bool Succeeded, string[] Errors)
{
    public static Result Success() => new(true, Array.Empty<string>());
    public static Result Failure(params string[] errors) => new(false, errors);
}

public record Result<T>(bool Succeeded, T? Data, string[] Errors) : Result(Succeeded, Errors)
{
    public static Result<T> Success(T data) => new(true, data, Array.Empty<string>());
    public static new Result<T> Failure(params string[] errors) => new(false, default, errors);
}

public record PaginatedResult<T>(IEnumerable<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}

// ── Auth DTOs ────────────────────────────────────────────────────────────────

public record RegisterCompanyRequest(
    string CompanyName,
    string FirstName,
    string LastName,
    string Email,
    string Password);

public record LoginRequest(string Email, string Password);

public record RefreshTokenRequest(string AccessToken, string RefreshToken);

public record ForgotPasswordRequest(string Email);

public record ResetPasswordRequest(string Token, string NewPassword, string ConfirmPassword);

public record InviteUserRequest(string Email, UserRole Role, string? FirstName, string? LastName);

public record AcceptInviteRequest(string Token, string Password, string ConfirmPassword, string FirstName, string LastName);

public record AuthResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, UserDto User);

// ── User DTOs ────────────────────────────────────────────────────────────────

public record UserDto(
    Guid Id,
    Guid CompanyId,
    string FirstName,
    string LastName,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTime? LastLoginAt,
    DateTime CreatedAt);

public record UpdateUserRequest(string? FirstName, string? LastName, bool? IsActive);
public record ChangeUserRoleRequest(UserRole Role);

// ── Company DTOs ─────────────────────────────────────────────────────────────

public record CompanyDto(Guid Id, string Name, string Slug, string? LogoUrl, bool IsActive, PlanName CurrentPlan);
public record UpdateCompanyRequest(string? Name, string? LogoUrl);

// ── Energy DTOs ──────────────────────────────────────────────────────────────

public record EnergyEntryDto(
    Guid Id, Guid CompanyId, EnergyCategory Category, string? CategoryName,
    decimal KWh, DateTime RecordedAt, string? Notes, DateTime CreatedAt);

public record CreateEnergyEntryRequest(
    EnergyCategory Category, string? CategoryName, decimal KWh,
    DateTime RecordedAt, string? Notes);

public record UpdateEnergyEntryRequest(
    EnergyCategory? Category, string? CategoryName, decimal? KWh,
    DateTime? RecordedAt, string? Notes);

// ── Water DTOs ───────────────────────────────────────────────────────────────

public record WaterEntryDto(
    Guid Id, Guid CompanyId, WaterCategory Category, string? CategoryName,
    decimal Liters, DateTime RecordedAt, string? Notes, DateTime CreatedAt);

public record CreateWaterEntryRequest(
    WaterCategory Category, string? CategoryName, decimal Liters,
    DateTime RecordedAt, string? Notes);

public record UpdateWaterEntryRequest(
    WaterCategory? Category, string? CategoryName, decimal? Liters,
    DateTime? RecordedAt, string? Notes);

// ── Waste DTOs ───────────────────────────────────────────────────────────────

public record WasteEntryDto(
    Guid Id, Guid CompanyId, WasteCategory Category, string? CategoryName,
    bool IsRecyclable, decimal Kg, DateTime RecordedAt, string? Notes, DateTime CreatedAt);

public record CreateWasteEntryRequest(
    WasteCategory Category, string? CategoryName, bool IsRecyclable,
    decimal Kg, DateTime RecordedAt, string? Notes);

public record UpdateWasteEntryRequest(
    WasteCategory? Category, string? CategoryName, bool? IsRecyclable,
    decimal? Kg, DateTime? RecordedAt, string? Notes);

// ── Carbon DTOs ──────────────────────────────────────────────────────────────

public record CarbonInputDto(
    Guid Id, Guid CompanyId, CarbonSource Source, TransportType? TransportType,
    string? Description, decimal Value, string Unit, decimal CO2eKg,
    decimal EmissionFactor, DateTime RecordedAt, string? Notes, DateTime CreatedAt);

public record CreateCarbonInputRequest(
    CarbonSource Source, TransportType? TransportType, string? Description,
    decimal Value, string Unit, DateTime RecordedAt, string? Notes);

public record UpdateCarbonInputRequest(
    CarbonSource? Source, TransportType? TransportType, string? Description,
    decimal? Value, string? Unit, DateTime? RecordedAt, string? Notes);

// ── Report DTOs ──────────────────────────────────────────────────────────────

public record DateRangeFilter(DateTime? From, DateTime? To, string? Category);

public record ConsumptionSummaryDto(
    decimal TotalEnergyKWh,
    decimal TotalWaterLiters,
    decimal TotalWasteKg,
    decimal TotalCO2eKg,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    int RecordCount);

public record TrendDto(
    string Period,         // "2024-01", "2024-Q1", "2024"
    decimal EnergyKWh,
    decimal WaterLiters,
    decimal WasteKg,
    decimal CO2eKg,
    double? EnergyChangePercent,
    double? WaterChangePercent,
    double? WasteChangePercent,
    double? CO2eChangePercent);

public record CategoryBreakdownDto(
    string Category,
    decimal Value,
    string Unit,
    double PercentageOfTotal);

public record DashboardDto(
    ConsumptionSummaryDto CurrentMonth,
    ConsumptionSummaryDto LastMonth,
    List<TrendDto> MonthlyTrends,
    List<CategoryBreakdownDto> EnergyByCategory,
    List<CategoryBreakdownDto> WasteByCategory,
    List<CategoryBreakdownDto> CarbonBySource,
    List<GoalProgressDto> ActiveGoals,
    int UnreadNotifications);

// ── Export DTOs ───────────────────────────────────────────────────────────────

public record ExportRequest(
    ExportType Type,
    DateTime? From,
    DateTime? To,
    string? Category,
    bool IncludeEnergy = true,
    bool IncludeWater = true,
    bool IncludeWaste = true,
    bool IncludeCarbon = true);

public record ExportResultDto(
    Guid FileId,
    string FileName,
    ExportType Type,
    string DownloadUrl,
    DateTime ExpiresAt,
    long FileSizeBytes);

// ── Goal DTOs ─────────────────────────────────────────────────────────────────

public record GoalDto(
    Guid Id, GoalType Type, string Name, string? Description,
    decimal TargetValue, string Unit, GoalPeriod Period,
    DateTime StartDate, DateTime EndDate, GoalStatus Status, DateTime CreatedAt);

public record CreateGoalRequest(
    GoalType Type, string Name, string? Description,
    decimal TargetValue, string Unit, GoalPeriod Period,
    DateTime StartDate, DateTime EndDate);

public record UpdateGoalRequest(
    string? Name, string? Description, decimal? TargetValue,
    DateTime? StartDate, DateTime? EndDate, GoalStatus? Status);

public record GoalProgressDto(
    Guid GoalId, string Name, GoalType Type,
    decimal TargetValue, decimal CurrentValue, string Unit,
    double ProgressPercent, GoalStatus Status,
    DateTime StartDate, DateTime EndDate,
    bool IsAchieved, bool IsOverdue);

// ── Notification DTOs ─────────────────────────────────────────────────────────

public record NotificationDto(
    Guid Id, NotificationType Type, string Title, string Message,
    bool IsRead, DateTime? ReadAt, DateTime CreatedAt);

public record CreateWebhookRequest(string Url, string? Secret, List<string> Events);

public record WebhookDto(
    Guid Id, string Url, bool IsActive, List<string> Events,
    DateTime? LastTriggeredAt, DateTime CreatedAt);

// ── Subscription DTOs ─────────────────────────────────────────────────────────

public record PlanDto(
    Guid Id, PlanName Name, string DisplayName, decimal MonthlyPrice, decimal YearlyPrice,
    int MaxRecordsPerMonth, int MaxExportsPerMonth, bool CanExport, bool CanUseApiKeys,
    bool CanUseWebhooks, bool CanAccessAdvancedReports);

public record SubscriptionDto(
    Guid Id, PlanName PlanName, string PlanDisplayName, SubscriptionStatus Status,
    DateTime? CurrentPeriodEnd, bool CancelAtPeriodEnd,
    int RecordsThisMonth, int MaxRecordsPerMonth,
    int ExportsThisMonth, int MaxExportsPerMonth);

public record CreateCheckoutSessionRequest(Guid PlanId, bool YearlyBilling, string SuccessUrl, string CancelUrl);
public record CheckoutSessionDto(string SessionUrl);

// ── API Key DTOs ──────────────────────────────────────────────────────────────

public record ApiKeyDto(
    Guid Id, string Name, string KeyPrefix, ApiPermission Permission,
    bool IsActive, DateTime? LastUsedAt, DateTime? ExpiresAt, DateTime CreatedAt);

public record CreateApiKeyRequest(string Name, ApiPermission Permission, DateTime? ExpiresAt);
public record CreateApiKeyResponse(ApiKeyDto ApiKey, string FullKey); // Full key shown only once

// ── Audit Log DTOs ───────────────────────────────────────────────────────────

public record AuditLogDto(
    Guid Id, string UserEmail, string EntityName, Guid EntityId,
    AuditAction Action, string? OldValues, string? NewValues,
    string? IpAddress, DateTime CreatedAt);

// ── Carbon Footprint DTOs ────────────────────────────────────────────────────

public record CarbonFootprintDto(
    decimal TotalCO2eKg,
    decimal TotalCO2eTonnes,
    List<CategoryBreakdownDto> BySource,
    List<TrendDto> MonthlyTrend,
    DateTime PeriodStart,
    DateTime PeriodEnd);
