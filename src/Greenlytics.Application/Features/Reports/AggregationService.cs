using Greenlytics.Application.Common;
using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Application.Features.Reports;

public class AggregationService : IAggregationService
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;

    public AggregationService(IApplicationDbContext db, ICacheService cache) => (_db, _cache) = (db, cache);

    public async Task<ConsumptionSummaryDto> GetSummaryAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var start = DateTimeNormalization.ToUtc(from) ?? DateTime.UtcNow.AddMonths(-1);
        var end = DateTimeNormalization.ToUtc(to) ?? DateTime.UtcNow;
        var cacheKey = $"report:{companyId}:summary:{start:yyyyMMdd}:{end:yyyyMMdd}";

        var cached = await _cache.GetAsync<ConsumptionSummaryDto>(cacheKey, ct);
        if (cached is not null) return cached;

        var energy = await _db.EnergyEntries.Where(e => e.CompanyId == companyId && e.RecordedAt >= start && e.RecordedAt <= end)
            .SumAsync(e => e.KWh, ct);
        var water = await _db.WaterEntries.Where(w => w.CompanyId == companyId && w.RecordedAt >= start && w.RecordedAt <= end)
            .SumAsync(w => w.Liters, ct);
        var waste = await _db.WasteEntries.Where(w => w.CompanyId == companyId && w.RecordedAt >= start && w.RecordedAt <= end)
            .SumAsync(w => w.Kg, ct);
        var carbon = await _db.CarbonInputs.Where(c => c.CompanyId == companyId && c.RecordedAt >= start && c.RecordedAt <= end)
            .SumAsync(c => c.CO2eKg, ct);
        var recordCount = await _db.EnergyEntries.CountAsync(e => e.CompanyId == companyId && e.RecordedAt >= start && e.RecordedAt <= end, ct)
            + await _db.WaterEntries.CountAsync(w => w.CompanyId == companyId && w.RecordedAt >= start && w.RecordedAt <= end, ct)
            + await _db.WasteEntries.CountAsync(w => w.CompanyId == companyId && w.RecordedAt >= start && w.RecordedAt <= end, ct)
            + await _db.CarbonInputs.CountAsync(c => c.CompanyId == companyId && c.RecordedAt >= start && c.RecordedAt <= end, ct);

        var result = new ConsumptionSummaryDto(energy, water, waste, carbon, start, end, recordCount);
        await _cache.SetAsync(cacheKey, result, TimeSpan.FromHours(1), ct);
        return result;
    }

    public async Task<List<TrendDto>> GetMonthlyTrendsAsync(Guid companyId, int months, CancellationToken ct)
    {
        var start = DateTime.UtcNow.AddMonths(-months);
        var trends = new List<TrendDto>();
        TrendDto? previous = null;

        for (var i = months; i >= 0; i--)
        {
            var periodStart = DateTime.UtcNow.AddMonths(-i);
            var periodEnd = periodStart.AddMonths(1).AddDays(-1);
            var label = periodStart.ToString("yyyy-MM");

            var summary = await GetSummaryAsync(companyId, periodStart, periodEnd, ct);

            var energyChange = previous is not null && previous.EnergyKWh > 0
                ? (double?)((summary.TotalEnergyKWh - previous.EnergyKWh) / previous.EnergyKWh * 100) : null;
            var waterChange = previous is not null && previous.WaterLiters > 0
                ? (double?)((summary.TotalWaterLiters - previous.WaterLiters) / previous.WaterLiters * 100) : null;
            var wasteChange = previous is not null && previous.WasteKg > 0
                ? (double?)((summary.TotalWasteKg - previous.WasteKg) / previous.WasteKg * 100) : null;
            var co2eChange = previous is not null && previous.CO2eKg > 0
                ? (double?)((summary.TotalCO2eKg - previous.CO2eKg) / previous.CO2eKg * 100) : null;

            var trend = new TrendDto(label, summary.TotalEnergyKWh, summary.TotalWaterLiters, summary.TotalWasteKg, summary.TotalCO2eKg,
                energyChange, waterChange, wasteChange, co2eChange);
            trends.Add(trend);
            previous = trend;
        }

        return trends;
    }

    public async Task<List<TrendDto>> GetYearlyTrendsAsync(Guid companyId, int years, CancellationToken ct)
    {
        var trends = new List<TrendDto>();
        TrendDto? previous = null;

        for (var i = years; i >= 0; i--)
        {
            var year = DateTime.UtcNow.Year - i;
            var periodStart = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var periodEnd = new DateTime(year, 12, 31, 23, 59, 59, DateTimeKind.Utc);
            var summary = await GetSummaryAsync(companyId, periodStart, periodEnd, ct);

            var energyChange = previous is not null && previous.EnergyKWh > 0
                ? (double?)((summary.TotalEnergyKWh - previous.EnergyKWh) / previous.EnergyKWh * 100) : null;

            var trend = new TrendDto(year.ToString(), summary.TotalEnergyKWh, summary.TotalWaterLiters, summary.TotalWasteKg, summary.TotalCO2eKg,
                energyChange, null, null, null);
            trends.Add(trend);
            previous = trend;
        }

        return trends;
    }

    public async Task<List<CategoryBreakdownDto>> GetEnergyByCategoryAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var start = DateTimeNormalization.ToUtc(from) ?? DateTime.UtcNow.AddMonths(-1);
        var end = DateTimeNormalization.ToUtc(to) ?? DateTime.UtcNow;
        var data = await _db.EnergyEntries
            .Where(e => e.CompanyId == companyId && e.RecordedAt >= start && e.RecordedAt <= end)
            .GroupBy(e => e.Category)
            .Select(g => new { Category = g.Key.ToString(), Total = g.Sum(e => e.KWh) })
            .ToListAsync(ct);

        var total = data.Sum(x => x.Total);
        return data.Select(x => new CategoryBreakdownDto(x.Category, x.Total, "kWh",
            total > 0 ? (double)(x.Total / total * 100) : 0)).ToList();
    }

    public async Task<List<CategoryBreakdownDto>> GetWasteByCategoryAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var start = DateTimeNormalization.ToUtc(from) ?? DateTime.UtcNow.AddMonths(-1);
        var end = DateTimeNormalization.ToUtc(to) ?? DateTime.UtcNow;
        var data = await _db.WasteEntries
            .Where(w => w.CompanyId == companyId && w.RecordedAt >= start && w.RecordedAt <= end)
            .GroupBy(w => w.Category)
            .Select(g => new { Category = g.Key.ToString(), Total = g.Sum(w => w.Kg) })
            .ToListAsync(ct);

        var total = data.Sum(x => x.Total);
        return data.Select(x => new CategoryBreakdownDto(x.Category, x.Total, "kg",
            total > 0 ? (double)(x.Total / total * 100) : 0)).ToList();
    }

    public async Task<List<CategoryBreakdownDto>> GetCarbonBySourceAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var start = DateTimeNormalization.ToUtc(from) ?? DateTime.UtcNow.AddMonths(-1);
        var end = DateTimeNormalization.ToUtc(to) ?? DateTime.UtcNow;
        var data = await _db.CarbonInputs
            .Where(c => c.CompanyId == companyId && c.RecordedAt >= start && c.RecordedAt <= end)
            .GroupBy(c => c.Source)
            .Select(g => new { Category = g.Key.ToString(), Total = g.Sum(c => c.CO2eKg) })
            .ToListAsync(ct);

        var total = data.Sum(x => x.Total);
        return data.Select(x => new CategoryBreakdownDto(x.Category, x.Total, "kgCO2e",
            total > 0 ? (double)(x.Total / total * 100) : 0)).ToList();
    }
}
