using Greenlytics.Domain.Common;
using Greenlytics.Domain.Enums;

namespace Greenlytics.Domain.Entities;

public class Notification : TenantEntity
{
    public Guid? UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public DateTime? ReadAt { get; set; }
    public string? Metadata { get; set; } // JSON extras

    public Company Company { get; set; } = null!;
}

public class Webhook : TenantEntity
{
    public string Url { get; set; } = string.Empty;
    public string? Secret { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Events { get; set; } // JSON array of subscribed events
    public DateTime? LastTriggeredAt { get; set; }

    public Company Company { get; set; } = null!;
}

public class AuditLog : TenantEntity
{
    public Guid? UserId { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public AuditAction Action { get; set; }
    public string? OldValues { get; set; } // JSON
    public string? NewValues { get; set; } // JSON
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    public Company Company { get; set; } = null!;
}

public class ApiKey : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string KeyHash { get; set; } = string.Empty; // bcrypt hash of the key
    public string KeyPrefix { get; set; } = string.Empty; // first 8 chars for display
    public ApiPermission Permission { get; set; } = ApiPermission.Read;
    public bool IsActive { get; set; } = true;
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    public Company Company { get; set; } = null!;
}

public class ExportedFile : TenantEntity
{
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public ExportType ExportType { get; set; }
    public long FileSizeBytes { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? Category { get; set; }
    public DateTime ExpiresAt { get; set; }

    public Company Company { get; set; } = null!;
}
