using Greenlytics.Application.Common.Models;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;

namespace Greenlytics.Application.Common.Services;

public interface ICarbonCalculatorService
{
    decimal CalculateCO2e(CarbonSource source, TransportType? transportType, decimal value, string unit);
    decimal GetEmissionFactor(CarbonSource source, TransportType? transportType, string unit);
    Task<CarbonFootprintDto> GetCarbonFootprintAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct = default);
}

public interface IAggregationService
{
    Task<List<TrendDto>> GetMonthlyTrendsAsync(Guid companyId, int months, CancellationToken ct = default);
    Task<List<TrendDto>> GetYearlyTrendsAsync(Guid companyId, int years, CancellationToken ct = default);
    Task<ConsumptionSummaryDto> GetSummaryAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<List<CategoryBreakdownDto>> GetEnergyByCategoryAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<List<CategoryBreakdownDto>> GetWasteByCategoryAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<List<CategoryBreakdownDto>> GetCarbonBySourceAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct = default);
}

public interface IExportService
{
    Task<byte[]> ExportToPdfAsync(Guid companyId, ExportRequest request, CancellationToken ct = default);
    Task<byte[]> ExportToExcelAsync(Guid companyId, ExportRequest request, CancellationToken ct = default);
    Task<byte[]> ExportToCsvAsync(Guid companyId, ExportRequest request, CancellationToken ct = default);
}

public interface IGoalService
{
    Task<GoalProgressDto> GetProgressAsync(Guid goalId, Guid companyId, CancellationToken ct = default);
    Task<List<GoalProgressDto>> GetAllProgressAsync(Guid companyId, CancellationToken ct = default);
    Task CheckAndUpdateGoalStatusesAsync(Guid companyId, CancellationToken ct = default);
}

public interface IFeatureGatingService
{
    Task<bool> CanExportAsync(Guid companyId, CancellationToken ct = default);
    Task<bool> CanUseApiKeysAsync(Guid companyId, CancellationToken ct = default);
    Task<bool> CanUseWebhooksAsync(Guid companyId, CancellationToken ct = default);
    Task<bool> CanAddRecordAsync(Guid companyId, CancellationToken ct = default);
    Task<bool> CanAccessAdvancedReportsAsync(Guid companyId, CancellationToken ct = default);
    Task IncrementRecordCountAsync(Guid companyId, CancellationToken ct = default);
    Task IncrementExportCountAsync(Guid companyId, CancellationToken ct = default);
}

public interface INotificationService
{
    Task CheckThresholdsAsync(Guid companyId, CancellationToken ct = default);
    Task TriggerWebhooksAsync(Guid companyId, string eventName, object payload, CancellationToken ct = default);
    Task CreateNotificationAsync(Guid companyId, Guid? userId, Domain.Enums.NotificationType type, string title, string message, CancellationToken ct = default);
}

public interface IJwtTokenService
{
    (string Token, DateTime Expires) GenerateAccessToken(Guid userId, Guid companyId, string email, string role);
    string GenerateRefreshToken();
    (Guid userId, Guid companyId)? ValidateExpiredToken(string token);
}
