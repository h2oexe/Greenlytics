using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Application.Features.Energy;

public class EnergyService
{
    private readonly IApplicationDbContext _db;
    private readonly IFeatureGatingService _gating;
    private readonly ICacheService _cache;

    public EnergyService(IApplicationDbContext db, IFeatureGatingService gating, ICacheService cache)
    {
        _db = db; _gating = gating; _cache = cache;
    }

    public async Task<PaginatedResult<EnergyEntryDto>> GetListAsync(
        Guid companyId, DateTime? from, DateTime? to, EnergyCategory? category, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.EnergyEntries.Where(e => e.CompanyId == companyId);
        if (from.HasValue) query = query.Where(e => e.RecordedAt >= from.Value);
        if (to.HasValue) query = query.Where(e => e.RecordedAt <= to.Value);
        if (category.HasValue) query = query.Where(e => e.Category == category.Value);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(e => e.RecordedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(e => MapDto(e)).ToListAsync(ct);

        return new PaginatedResult<EnergyEntryDto>(items, total, page, pageSize);
    }

    public async Task<Result<EnergyEntryDto>> GetByIdAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.EnergyEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        return entry is null ? Result<EnergyEntryDto>.Failure("Entry not found.") : Result<EnergyEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result<EnergyEntryDto>> CreateAsync(Guid companyId, CreateEnergyEntryRequest req, CancellationToken ct)
    {
        if (!await _gating.CanAddRecordAsync(companyId, ct))
            return Result<EnergyEntryDto>.Failure("Monthly record limit reached. Please upgrade your plan.");

        var entry = new EnergyEntry
        {
            CompanyId = companyId,
            Category = req.Category,
            CategoryName = req.CategoryName,
            KWh = req.KWh,
            RecordedAt = req.RecordedAt,
            Notes = req.Notes
        };
        _db.EnergyEntries.Add(entry);
        await _db.SaveChangesAsync(ct);
        await _gating.IncrementRecordCountAsync(companyId, ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);

        return Result<EnergyEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result<EnergyEntryDto>> UpdateAsync(Guid id, Guid companyId, UpdateEnergyEntryRequest req, CancellationToken ct)
    {
        var entry = await _db.EnergyEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        if (entry is null) return Result<EnergyEntryDto>.Failure("Entry not found.");

        if (req.Category.HasValue) entry.Category = req.Category.Value;
        if (req.CategoryName is not null) entry.CategoryName = req.CategoryName;
        if (req.KWh.HasValue) entry.KWh = req.KWh.Value;
        if (req.RecordedAt.HasValue) entry.RecordedAt = req.RecordedAt.Value;
        if (req.Notes is not null) entry.Notes = req.Notes;
        entry.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result<EnergyEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result> DeleteAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.EnergyEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        if (entry is null) return Result.Failure("Entry not found.");

        _db.EnergyEntries.Remove(entry);
        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result.Success();
    }

    private static EnergyEntryDto MapDto(EnergyEntry e) =>
        new(e.Id, e.CompanyId, e.Category, e.CategoryName, e.KWh, e.RecordedAt, e.Notes, e.CreatedAt);
}
