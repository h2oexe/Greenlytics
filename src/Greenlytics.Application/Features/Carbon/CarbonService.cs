using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Application.Features.Carbon;

/// <summary>
/// Carbon Calculator using IPCC AR5 / GHG Protocol emission factors.
/// Factors are in kgCO2e per unit.
/// </summary>
public class CarbonCalculatorService : ICarbonCalculatorService
{
    private readonly IApplicationDbContext _db;

    // ── Emission factors table (kgCO2e / unit) ────────────────────────────
    private static readonly Dictionary<(CarbonSource, TransportType?, string), decimal> Factors = new()
    {
        // Transport - Car (kgCO2e per km)
        { (CarbonSource.Transport, TransportType.Car, "km"), 0.21m },
        { (CarbonSource.Transport, TransportType.Truck, "km"), 0.62m },
        { (CarbonSource.Transport, TransportType.Bus, "km"), 0.089m },
        { (CarbonSource.Transport, TransportType.Train, "km"), 0.041m },
        { (CarbonSource.Transport, TransportType.Ship, "km"), 0.016m },
        { (CarbonSource.Transport, TransportType.Motorcycle, "km"), 0.113m },
        // Electricity (kgCO2e per kWh) - EU average
        { (CarbonSource.Electricity, null, "kwh"), 0.233m },
        // Natural Gas (kgCO2e per m3)
        { (CarbonSource.NaturalGas, null, "m3"), 2.04m },
        // Aviation (kgCO2e per km)
        { (CarbonSource.Aviation, null, "km"), 0.255m },
        // Other (kgCO2e per kg)
        { (CarbonSource.Other, null, "kg"), 1.0m },
    };

    public CarbonCalculatorService(IApplicationDbContext db) => _db = db;

    public decimal GetEmissionFactor(CarbonSource source, TransportType? transportType, string unit)
    {
        var key = (source, transportType, unit.ToLower());
        if (Factors.TryGetValue(key, out var factor)) return factor;
        // Fallback: try without transport type
        var keyNoTransport = (source, (TransportType?)null, unit.ToLower());
        return Factors.TryGetValue(keyNoTransport, out var f2) ? f2 : 1.0m;
    }

    public decimal CalculateCO2e(CarbonSource source, TransportType? transportType, decimal value, string unit)
    {
        var factor = GetEmissionFactor(source, transportType, unit);
        return Math.Round(value * factor, 4);
    }

    public async Task<CarbonFootprintDto> GetCarbonFootprintAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var periodStart = from ?? DateTime.UtcNow.AddMonths(-12);
        var periodEnd = to ?? DateTime.UtcNow;

        var inputs = await _db.CarbonInputs
            .Where(c => c.CompanyId == companyId && c.RecordedAt >= periodStart && c.RecordedAt <= periodEnd)
            .ToListAsync(ct);

        var totalCO2e = inputs.Sum(c => c.CO2eKg);

        var bySource = inputs
            .GroupBy(c => c.Source.ToString())
            .Select(g => new CategoryBreakdownDto(
                g.Key,
                g.Sum(c => c.CO2eKg),
                "kgCO2e",
                totalCO2e > 0 ? (double)(g.Sum(c => c.CO2eKg) / totalCO2e * 100) : 0))
            .ToList();

        // Monthly trend
        var monthlyTrend = inputs
            .GroupBy(c => c.RecordedAt.ToString("yyyy-MM"))
            .OrderBy(g => g.Key)
            .Select(g => new TrendDto(g.Key, 0, 0, 0, g.Sum(c => c.CO2eKg), null, null, null, null))
            .ToList();

        return new CarbonFootprintDto(totalCO2e, Math.Round(totalCO2e / 1000, 4), bySource, monthlyTrend, periodStart, periodEnd);
    }
}

public class CarbonService
{
    private readonly IApplicationDbContext _db;
    private readonly ICarbonCalculatorService _calculator;
    private readonly IFeatureGatingService _gating;
    private readonly ICacheService _cache;

    public CarbonService(IApplicationDbContext db, ICarbonCalculatorService calculator, IFeatureGatingService gating, ICacheService cache) =>
        (_db, _calculator, _gating, _cache) = (db, calculator, gating, cache);

    public async Task<PaginatedResult<CarbonInputDto>> GetListAsync(
        Guid companyId, DateTime? from, DateTime? to, CarbonSource? source, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.CarbonInputs.Where(c => c.CompanyId == companyId);
        if (from.HasValue) query = query.Where(c => c.RecordedAt >= from.Value);
        if (to.HasValue) query = query.Where(c => c.RecordedAt <= to.Value);
        if (source.HasValue) query = query.Where(c => c.Source == source.Value);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(c => c.RecordedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => MapDto(c)).ToListAsync(ct);

        return new PaginatedResult<CarbonInputDto>(items, total, page, pageSize);
    }

    public async Task<Result<CarbonInputDto>> GetByIdAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.CarbonInputs.FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);
        return entry is null ? Result<CarbonInputDto>.Failure("Entry not found.") : Result<CarbonInputDto>.Success(MapDto(entry));
    }

    public async Task<Result<CarbonInputDto>> CreateAsync(Guid companyId, CreateCarbonInputRequest req, CancellationToken ct)
    {
        if (!await _gating.CanAddRecordAsync(companyId, ct))
            return Result<CarbonInputDto>.Failure("Monthly record limit reached. Please upgrade your plan.");

        var factor = _calculator.GetEmissionFactor(req.Source, req.TransportType, req.Unit);
        var co2e = _calculator.CalculateCO2e(req.Source, req.TransportType, req.Value, req.Unit);

        var entry = new CarbonInput
        {
            CompanyId = companyId, Source = req.Source, TransportType = req.TransportType,
            Description = req.Description, Value = req.Value, Unit = req.Unit,
            EmissionFactor = factor, CO2eKg = co2e, RecordedAt = req.RecordedAt, Notes = req.Notes
        };
        _db.CarbonInputs.Add(entry);
        await _db.SaveChangesAsync(ct);
        await _gating.IncrementRecordCountAsync(companyId, ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result<CarbonInputDto>.Success(MapDto(entry));
    }

    public async Task<Result<CarbonInputDto>> UpdateAsync(Guid id, Guid companyId, UpdateCarbonInputRequest req, CancellationToken ct)
    {
        var entry = await _db.CarbonInputs.FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);
        if (entry is null) return Result<CarbonInputDto>.Failure("Entry not found.");

        if (req.Source.HasValue) entry.Source = req.Source.Value;
        if (req.TransportType.HasValue) entry.TransportType = req.TransportType;
        if (req.Description is not null) entry.Description = req.Description;
        if (req.RecordedAt.HasValue) entry.RecordedAt = req.RecordedAt.Value;
        if (req.Notes is not null) entry.Notes = req.Notes;

        // Recalculate CO2e if value or unit changed
        if (req.Value.HasValue) entry.Value = req.Value.Value;
        if (req.Unit is not null) entry.Unit = req.Unit;
        entry.EmissionFactor = _calculator.GetEmissionFactor(entry.Source, entry.TransportType, entry.Unit);
        entry.CO2eKg = _calculator.CalculateCO2e(entry.Source, entry.TransportType, entry.Value, entry.Unit);
        entry.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result<CarbonInputDto>.Success(MapDto(entry));
    }

    public async Task<Result> DeleteAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.CarbonInputs.FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);
        if (entry is null) return Result.Failure("Entry not found.");
        _db.CarbonInputs.Remove(entry);
        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result.Success();
    }

    public Task<CarbonFootprintDto> GetFootprintAsync(Guid companyId, DateTime? from, DateTime? to, CancellationToken ct) =>
        _calculator.GetCarbonFootprintAsync(companyId, from, to, ct);

    private static CarbonInputDto MapDto(CarbonInput c) =>
        new(c.Id, c.CompanyId, c.Source, c.TransportType, c.Description, c.Value, c.Unit, c.CO2eKg, c.EmissionFactor, c.RecordedAt, c.Notes, c.CreatedAt);
}
