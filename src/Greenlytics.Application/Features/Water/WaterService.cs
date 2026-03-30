using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Application.Features.Water;

public class WaterService
{
    private readonly IApplicationDbContext _db;
    private readonly IFeatureGatingService _gating;
    private readonly ICacheService _cache;

    public WaterService(IApplicationDbContext db, IFeatureGatingService gating, ICacheService cache) =>
        (_db, _gating, _cache) = (db, gating, cache);

    public async Task<PaginatedResult<WaterEntryDto>> GetListAsync(
        Guid companyId, DateTime? from, DateTime? to, WaterCategory? category, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.WaterEntries.Where(e => e.CompanyId == companyId);
        if (from.HasValue) query = query.Where(e => e.RecordedAt >= from.Value);
        if (to.HasValue) query = query.Where(e => e.RecordedAt <= to.Value);
        if (category.HasValue) query = query.Where(e => e.Category == category.Value);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(e => e.RecordedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(e => MapDto(e)).ToListAsync(ct);

        return new PaginatedResult<WaterEntryDto>(items, total, page, pageSize);
    }

    public async Task<Result<WaterEntryDto>> GetByIdAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.WaterEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        return entry is null ? Result<WaterEntryDto>.Failure("Entry not found.") : Result<WaterEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result<WaterEntryDto>> CreateAsync(Guid companyId, CreateWaterEntryRequest req, CancellationToken ct)
    {
        if (!await _gating.CanAddRecordAsync(companyId, ct))
            return Result<WaterEntryDto>.Failure("Monthly record limit reached. Please upgrade your plan.");

        var entry = new WaterEntry { CompanyId = companyId, Category = req.Category, CategoryName = req.CategoryName, Liters = req.Liters, RecordedAt = req.RecordedAt, Notes = req.Notes };
        _db.WaterEntries.Add(entry);
        await _db.SaveChangesAsync(ct);
        await _gating.IncrementRecordCountAsync(companyId, ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result<WaterEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result<WaterEntryDto>> UpdateAsync(Guid id, Guid companyId, UpdateWaterEntryRequest req, CancellationToken ct)
    {
        var entry = await _db.WaterEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        if (entry is null) return Result<WaterEntryDto>.Failure("Entry not found.");

        if (req.Category.HasValue) entry.Category = req.Category.Value;
        if (req.CategoryName is not null) entry.CategoryName = req.CategoryName;
        if (req.Liters.HasValue) entry.Liters = req.Liters.Value;
        if (req.RecordedAt.HasValue) entry.RecordedAt = req.RecordedAt.Value;
        if (req.Notes is not null) entry.Notes = req.Notes;
        entry.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result<WaterEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result> DeleteAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.WaterEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        if (entry is null) return Result.Failure("Entry not found.");
        _db.WaterEntries.Remove(entry);
        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result.Success();
    }

    private static WaterEntryDto MapDto(WaterEntry e) =>
        new(e.Id, e.CompanyId, e.Category, e.CategoryName, e.Liters, e.RecordedAt, e.Notes, e.CreatedAt);
}
