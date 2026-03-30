using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Domain.Interfaces;

public interface IApplicationDbContext
{
    // Core
    DbSet<Company> Companies { get; }
    DbSet<User> Users { get; }
    DbSet<Plan> Plans { get; }
    DbSet<Subscription> Subscriptions { get; }

    // Data entries
    DbSet<EnergyEntry> EnergyEntries { get; }
    DbSet<WaterEntry> WaterEntries { get; }
    DbSet<WasteEntry> WasteEntries { get; }
    DbSet<CarbonInput> CarbonInputs { get; }

    // Goals & Notifications
    DbSet<Goal> Goals { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<Webhook> Webhooks { get; }

    // System
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<ApiKey> ApiKeys { get; }
    DbSet<ExportedFile> ExportedFiles { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
