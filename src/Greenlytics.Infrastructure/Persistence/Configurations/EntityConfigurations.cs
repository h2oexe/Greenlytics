using Greenlytics.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenlytics.Infrastructure.Persistence.Configurations;

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Name).IsRequired().HasMaxLength(100);
        builder.Property(c => c.Slug).IsRequired().HasMaxLength(120);
        builder.HasIndex(c => c.Slug).IsUnique();
        builder.HasMany(c => c.Users).WithOne(u => u.Company).HasForeignKey(u => u.CompanyId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(c => c.Subscription).WithOne(s => s.Company).HasForeignKey<Subscription>(s => s.CompanyId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Email).IsRequired().HasMaxLength(256);
        builder.HasIndex(u => u.Email);
        builder.HasIndex(u => new { u.CompanyId, u.Email }).IsUnique();
        builder.Property(u => u.FirstName).HasMaxLength(50);
        builder.Property(u => u.LastName).HasMaxLength(50);
        builder.Property(u => u.PasswordHash).HasMaxLength(1024);
        builder.Property(u => u.Role).HasConversion<string>();
    }
}

public class PlanConfiguration : IEntityTypeConfiguration<Plan>
{
    public void Configure(EntityTypeBuilder<Plan> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).HasConversion<string>();
        builder.Property(p => p.DisplayName).IsRequired().HasMaxLength(50);
        builder.Property(p => p.MonthlyPrice).HasPrecision(10, 2);
        builder.Property(p => p.YearlyPrice).HasPrecision(10, 2);
    }
}

public class EnergyEntryConfiguration : IEntityTypeConfiguration<EnergyEntry>
{
    public void Configure(EntityTypeBuilder<EnergyEntry> builder)
    {
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.CompanyId);
        builder.HasIndex(e => e.RecordedAt);
        builder.HasIndex(e => new { e.CompanyId, e.RecordedAt });
        builder.Property(e => e.KWh).HasPrecision(18, 4);
        builder.Property(e => e.Category).HasConversion<string>();
    }
}

public class WaterEntryConfiguration : IEntityTypeConfiguration<WaterEntry>
{
    public void Configure(EntityTypeBuilder<WaterEntry> builder)
    {
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.CompanyId, e.RecordedAt });
        builder.Property(e => e.Liters).HasPrecision(18, 4);
        builder.Property(e => e.Category).HasConversion<string>();
    }
}

public class WasteEntryConfiguration : IEntityTypeConfiguration<WasteEntry>
{
    public void Configure(EntityTypeBuilder<WasteEntry> builder)
    {
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.CompanyId, e.RecordedAt });
        builder.Property(e => e.Kg).HasPrecision(18, 4);
        builder.Property(e => e.Category).HasConversion<string>();
    }
}

public class CarbonInputConfiguration : IEntityTypeConfiguration<CarbonInput>
{
    public void Configure(EntityTypeBuilder<CarbonInput> builder)
    {
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.CompanyId, e.RecordedAt });
        builder.Property(e => e.Value).HasPrecision(18, 4);
        builder.Property(e => e.CO2eKg).HasPrecision(18, 6);
        builder.Property(e => e.EmissionFactor).HasPrecision(18, 8);
        builder.Property(e => e.Source).HasConversion<string>();
        builder.Property(e => e.TransportType).HasConversion<string>();
    }
}

public class GoalConfiguration : IEntityTypeConfiguration<Goal>
{
    public void Configure(EntityTypeBuilder<Goal> builder)
    {
        builder.HasKey(g => g.Id);
        builder.HasIndex(g => g.CompanyId);
        builder.Property(g => g.TargetValue).HasPrecision(18, 4);
        builder.Property(g => g.Type).HasConversion<string>();
        builder.Property(g => g.Period).HasConversion<string>();
        builder.Property(g => g.Status).HasConversion<string>();
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(a => a.Id);
        builder.HasIndex(a => a.CompanyId);
        builder.HasIndex(a => new { a.CompanyId, a.CreatedAt });
        builder.Property(a => a.Action).HasConversion<string>();
        builder.Property(a => a.OldValues).HasColumnType("jsonb");
        builder.Property(a => a.NewValues).HasColumnType("jsonb");
    }
}

public class ApiKeyConfiguration : IEntityTypeConfiguration<ApiKey>
{
    public void Configure(EntityTypeBuilder<ApiKey> builder)
    {
        builder.HasKey(a => a.Id);
        builder.HasIndex(a => a.CompanyId);
        builder.HasIndex(a => a.KeyHash).IsUnique();
        builder.Property(a => a.Permission).HasConversion<string>();
    }
}

public class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => s.CompanyId).IsUnique();
        builder.Property(s => s.Status).HasConversion<string>();
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasKey(n => n.Id);
        builder.HasIndex(n => new { n.CompanyId, n.IsRead });
        builder.Property(n => n.Type).HasConversion<string>();
        builder.Property(n => n.Metadata).HasColumnType("jsonb");
    }
}
