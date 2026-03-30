using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Infrastructure.Services;

public class FeatureGatingService : IFeatureGatingService
{
    private readonly IApplicationDbContext _db;

    public FeatureGatingService(IApplicationDbContext db) => _db = db;

    private async Task<(Domain.Entities.Plan plan, Domain.Entities.Subscription sub)> GetPlanAndSubAsync(Guid companyId, CancellationToken ct)
    {
        var sub = await _db.Subscriptions
            .IgnoreQueryFilters()
            .Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Subscription not found for company.");
        return (sub.Plan, sub);
    }

    public async Task<bool> CanExportAsync(Guid companyId, CancellationToken ct = default)
    {
        var (plan, sub) = await GetPlanAndSubAsync(companyId, ct);
        if (!plan.CanExport) return false;
        if (plan.MaxExportsPerMonth == -1) return true;
        await ResetMonthlyCountsIfNeededAsync(sub, ct);
        return sub.ExportsThisMonth < plan.MaxExportsPerMonth;
    }

    public async Task<bool> CanUseApiKeysAsync(Guid companyId, CancellationToken ct = default)
    {
        var (plan, _) = await GetPlanAndSubAsync(companyId, ct);
        return plan.CanUseApiKeys;
    }

    public async Task<bool> CanUseWebhooksAsync(Guid companyId, CancellationToken ct = default)
    {
        var (plan, _) = await GetPlanAndSubAsync(companyId, ct);
        return plan.CanUseWebhooks;
    }

    public async Task<bool> CanAddRecordAsync(Guid companyId, CancellationToken ct = default)
    {
        var (plan, sub) = await GetPlanAndSubAsync(companyId, ct);
        if (plan.MaxRecordsPerMonth == -1) return true;
        await ResetMonthlyCountsIfNeededAsync(sub, ct);
        return sub.RecordsThisMonth < plan.MaxRecordsPerMonth;
    }

    public async Task<bool> CanAccessAdvancedReportsAsync(Guid companyId, CancellationToken ct = default)
    {
        var (plan, _) = await GetPlanAndSubAsync(companyId, ct);
        return plan.CanAccessAdvancedReports;
    }

    public async Task IncrementRecordCountAsync(Guid companyId, CancellationToken ct = default)
    {
        var sub = await _db.Subscriptions.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.CompanyId == companyId, ct);
        if (sub is not null) { sub.RecordsThisMonth++; await _db.SaveChangesAsync(ct); }
    }

    public async Task IncrementExportCountAsync(Guid companyId, CancellationToken ct = default)
    {
        var sub = await _db.Subscriptions.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.CompanyId == companyId, ct);
        if (sub is not null) { sub.ExportsThisMonth++; await _db.SaveChangesAsync(ct); }
    }

    private async Task ResetMonthlyCountsIfNeededAsync(Domain.Entities.Subscription sub, CancellationToken ct)
    {
        if (sub.LastResetAt.HasValue && sub.LastResetAt.Value.Month == DateTime.UtcNow.Month) return;
        sub.RecordsThisMonth = 0;
        sub.ExportsThisMonth = 0;
        sub.LastResetAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
