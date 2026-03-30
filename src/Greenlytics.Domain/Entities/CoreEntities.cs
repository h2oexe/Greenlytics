using Greenlytics.Domain.Common;
using Greenlytics.Domain.Enums;

namespace Greenlytics.Domain.Entities;

public class Company : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid PlanId { get; set; }

    // Navigation
    public Plan Plan { get; set; } = null!;
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<EnergyEntry> EnergyEntries { get; set; } = new List<EnergyEntry>();
    public ICollection<WaterEntry> WaterEntries { get; set; } = new List<WaterEntry>();
    public ICollection<WasteEntry> WasteEntries { get; set; } = new List<WasteEntry>();
    public ICollection<CarbonInput> CarbonInputs { get; set; } = new List<CarbonInput>();
    public ICollection<Goal> Goals { get; set; } = new List<Goal>();
    public Subscription? Subscription { get; set; }
}

public class User : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Viewer;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }
    public string? InviteToken { get; set; }
    public DateTime? InviteTokenExpiresAt { get; set; }
    public bool IsEmailVerified { get; set; } = false;
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAt { get; set; }
    public int FailedLoginAttempts { get; set; } = 0;
    public DateTime? LockedOutUntil { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
}

public class Plan : BaseEntity
{
    public PlanName Name { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public decimal YearlyPrice { get; set; }
    public int MaxRecordsPerMonth { get; set; } // -1 = unlimited
    public int MaxExportsPerMonth { get; set; } // -1 = unlimited
    public bool CanExport { get; set; }
    public bool CanUseApiKeys { get; set; }
    public bool CanUseWebhooks { get; set; }
    public bool CanAccessAdvancedReports { get; set; }
    public bool CanSetGoals { get; set; }
    public bool HasPrioritySupport { get; set; }
    public string? StripePriceIdMonthly { get; set; }
    public string? StripePriceIdYearly { get; set; }

    // Navigation
    public ICollection<Company> Companies { get; set; } = new List<Company>();
}

public class Subscription : BaseEntity
{
    public Guid CompanyId { get; set; }
    public Guid PlanId { get; set; }
    public SubscriptionStatus Status { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? StripeCustomerId { get; set; }
    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; } = false;
    public int RecordsThisMonth { get; set; } = 0;
    public int ExportsThisMonth { get; set; } = 0;
    public DateTime? LastResetAt { get; set; }

    // Navigation
    public Company Company { get; set; } = null!;
    public Plan Plan { get; set; } = null!;
}
