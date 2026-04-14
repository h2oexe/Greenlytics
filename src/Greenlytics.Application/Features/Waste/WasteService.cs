using Greenlytics.Application.Common;
using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Application.Features.Waste;

public class WasteService
{
    private readonly IApplicationDbContext _db;
    private readonly IFeatureGatingService _gating;
    private readonly ICacheService _cache;

    public WasteService(IApplicationDbContext db, IFeatureGatingService gating, ICacheService cache) =>
        (_db, _gating, _cache) = (db, gating, cache);

    public async Task<PaginatedResult<WasteEntryDto>> GetListAsync(
        Guid companyId, DateTime? from, DateTime? to, WasteCategory? category, bool? recyclable, int page, int pageSize, CancellationToken ct)
    {
        from = DateTimeNormalization.ToUtc(from);
        to = DateTimeNormalization.ToUtc(to);

        var query = _db.WasteEntries.Where(e => e.CompanyId == companyId);
        if (from.HasValue) query = query.Where(e => e.RecordedAt >= from.Value);
        if (to.HasValue) query = query.Where(e => e.RecordedAt <= to.Value);
        if (category.HasValue) query = query.Where(e => e.Category == category.Value);
        if (recyclable.HasValue) query = query.Where(e => e.IsRecyclable == recyclable.Value);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(e => e.RecordedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(e => MapDto(e)).ToListAsync(ct);

        return new PaginatedResult<WasteEntryDto>(items, total, page, pageSize);
    }

    public async Task<Result<WasteEntryDto>> GetByIdAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.WasteEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        return entry is null ? Result<WasteEntryDto>.Failure("Entry not found.") : Result<WasteEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result<WasteEntryDto>> CreateAsync(Guid companyId, CreateWasteEntryRequest req, CancellationToken ct)
    {
        if (!await _gating.CanAddRecordAsync(companyId, ct))
            return Result<WasteEntryDto>.Failure("Monthly record limit reached. Please upgrade your plan.");

        var entry = new WasteEntry
        {
            CompanyId = companyId,
            Category = req.Category,
            CategoryName = req.CategoryName,
            IsRecyclable = req.IsRecyclable,
            Kg = req.Kg,
            RecordedAt = DateTimeNormalization.ToUtc(req.RecordedAt),
            Notes = req.Notes
        };
        _db.WasteEntries.Add(entry);
        await _db.SaveChangesAsync(ct);
        await _gating.IncrementRecordCountAsync(companyId, ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result<WasteEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result<WasteEntryDto>> UpdateAsync(Guid id, Guid companyId, UpdateWasteEntryRequest req, CancellationToken ct)
    {
        var entry = await _db.WasteEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        if (entry is null) return Result<WasteEntryDto>.Failure("Entry not found.");

        if (req.Category.HasValue) entry.Category = req.Category.Value;
        if (req.CategoryName is not null) entry.CategoryName = req.CategoryName;
        if (req.IsRecyclable.HasValue) entry.IsRecyclable = req.IsRecyclable.Value;
        if (req.Kg.HasValue) entry.Kg = req.Kg.Value;
        if (req.RecordedAt.HasValue) entry.RecordedAt = DateTimeNormalization.ToUtc(req.RecordedAt.Value);
        if (req.Notes is not null) entry.Notes = req.Notes;
        entry.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result<WasteEntryDto>.Success(MapDto(entry));
    }

    public async Task<Result> DeleteAsync(Guid id, Guid companyId, CancellationToken ct)
    {
        var entry = await _db.WasteEntries.FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == companyId, ct);
        if (entry is null) return Result.Failure("Entry not found.");
        _db.WasteEntries.Remove(entry);
        await _db.SaveChangesAsync(ct);
        await _cache.RemoveByPatternAsync($"report:{companyId}:*", ct);
        return Result.Success();
    }

    private static WasteEntryDto MapDto(WasteEntry e) =>
        new(e.Id, e.CompanyId, e.Category, e.CategoryName, e.IsRecyclable, e.Kg, e.RecordedAt, e.Notes, e.CreatedAt);
}
