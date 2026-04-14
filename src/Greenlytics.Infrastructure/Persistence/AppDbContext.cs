using Greenlytics.Application.Common;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Interfaces;
using Greenlytics.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Infrastructure.Persistence;

public class AppDbContext : DbContext, IApplicationDbContext
{
    private readonly ICurrentUserService _currentUser;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService currentUser)
        : base(options) => _currentUser = currentUser;

    // ── Core ──────────────────────────────────────────────────────────────
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    // ── Data entries ─────────────────────────────────────────────────────
    public DbSet<EnergyEntry> EnergyEntries => Set<EnergyEntry>();
    public DbSet<WaterEntry> WaterEntries => Set<WaterEntry>();
    public DbSet<WasteEntry> WasteEntries => Set<WasteEntry>();
    public DbSet<CarbonInput> CarbonInputs => Set<CarbonInput>();

    // ── Goals & Notifications ────────────────────────────────────────────
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Webhook> Webhooks => Set<Webhook>();

    // ── System ──────────────────────────────────────────────────────────
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<ExportedFile> ExportedFiles => Set<ExportedFile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all entity configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // ── Global query filters – multi-tenant isolation ──────────────────
        var companyId = _currentUser.CompanyId;

        modelBuilder.Entity<EnergyEntry>().HasQueryFilter(e => e.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<WaterEntry>().HasQueryFilter(w => w.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<WasteEntry>().HasQueryFilter(w => w.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<CarbonInput>().HasQueryFilter(c => c.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<Goal>().HasQueryFilter(g => g.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<Notification>().HasQueryFilter(n => n.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<Webhook>().HasQueryFilter(w => w.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<AuditLog>().HasQueryFilter(a => a.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<ApiKey>().HasQueryFilter(a => a.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<ExportedFile>().HasQueryFilter(f => f.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<Subscription>().HasQueryFilter(s => s.CompanyId == _currentUser.CompanyId);
        modelBuilder.Entity<User>().HasQueryFilter(u => u.CompanyId == _currentUser.CompanyId);

        // Seed Plans
        var basicId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var proId   = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var entId   = Guid.Parse("00000000-0000-0000-0000-000000000003");

        modelBuilder.Entity<Plan>().HasData(
            new Plan { Id = basicId, Name = Domain.Enums.PlanName.Basic, DisplayName = "Basic", MonthlyPrice = 0, YearlyPrice = 0,
                MaxRecordsPerMonth = 500, MaxExportsPerMonth = 0, CanExport = false, CanUseApiKeys = false,
                CanUseWebhooks = false, CanAccessAdvancedReports = false, CanSetGoals = false, HasPrioritySupport = false,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Plan { Id = proId, Name = Domain.Enums.PlanName.Pro, DisplayName = "Pro", MonthlyPrice = 49, YearlyPrice = 490,
                MaxRecordsPerMonth = 10000, MaxExportsPerMonth = 50, CanExport = true, CanUseApiKeys = false,
                CanUseWebhooks = false, CanAccessAdvancedReports = true, CanSetGoals = true, HasPrioritySupport = false,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Plan { Id = entId, Name = Domain.Enums.PlanName.Enterprise, DisplayName = "Enterprise", MonthlyPrice = 199, YearlyPrice = 1990,
                MaxRecordsPerMonth = -1, MaxExportsPerMonth = -1, CanExport = true, CanUseApiKeys = true,
                CanUseWebhooks = true, CanAccessAdvancedReports = true, CanSetGoals = true, HasPrioritySupport = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
        );
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified))
        {
            foreach (var property in entry.Properties)
            {
                if (property.CurrentValue is DateTime value)
                {
                    property.CurrentValue = DateTimeNormalization.ToUtc(value);
                }
            }
        }

        // Auto-set UpdatedAt for modified entities
        var entries = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Modified && e.Entity is Domain.Common.BaseEntity);
        foreach (var entry in entries)
            ((Domain.Common.BaseEntity)entry.Entity).UpdatedAt = DateTime.UtcNow;

        return await base.SaveChangesAsync(cancellationToken);
    }
}
