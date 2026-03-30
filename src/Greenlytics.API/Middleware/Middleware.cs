using Greenlytics.Domain.Interfaces;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace Greenlytics.API.Middleware;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUserService(IHttpContextAccessor accessor) => _accessor = accessor;

    private ClaimsPrincipal? User => _accessor.HttpContext?.User;

    public Guid? UserId => Guid.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier) 
        ?? User?.FindFirstValue("sub"), out var id) ? id : null;

    public Guid? CompanyId => Guid.TryParse(User?.FindFirstValue("companyId"), out var id) ? id : null;

    public string? Email => User?.FindFirstValue(ClaimTypes.Email) 
        ?? User?.FindFirstValue("email");

    public string? Role => User?.FindFirstValue(ClaimTypes.Role);

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;
}

public class AuditLogMiddleware
{
    private readonly RequestDelegate _next;

    public AuditLogMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IApplicationDbContext db, ICurrentUserService user)
    {
        await _next(context);

        if (user.IsAuthenticated && user.CompanyId.HasValue && context.Response.StatusCode < 400
            && context.Request.Method is "POST" or "PUT" or "DELETE" or "PATCH")
        {
            var auditLog = new Domain.Entities.AuditLog
            {
                CompanyId = user.CompanyId.Value,
                UserId = user.UserId,
                UserEmail = user.Email ?? "unknown",
                EntityName = context.Request.Path.ToString().Split('/').LastOrDefault("unknown"),
                EntityId = Guid.Empty,
                Action = context.Request.Method switch
                {
                    "POST" => Domain.Enums.AuditAction.Create,
                    "DELETE" => Domain.Enums.AuditAction.Delete,
                    _ => Domain.Enums.AuditAction.Update
                },
                IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                UserAgent = context.Request.Headers.UserAgent.ToString()
            };
            db.AuditLogs.Add(auditLog);
            await db.SaveChangesAsync();
        }
    }
}

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;

    public ErrorHandlingMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        try { await _next(context); }
        catch (KeyNotFoundException ex)
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred.", detail = ex.Message });
        }
    }
}
