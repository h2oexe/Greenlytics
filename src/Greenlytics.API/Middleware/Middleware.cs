using Greenlytics.Domain.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

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
    private static readonly Regex GuidRegex = new(
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        RegexOptions.Compiled);

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
                EntityId = ResolveEntityId(context),
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

    private static Guid ResolveEntityId(HttpContext context)
    {
        if (context.Request.RouteValues.TryGetValue("id", out var routeId) &&
            Guid.TryParse(routeId?.ToString(), out var parsedRouteId))
        {
            return parsedRouteId;
        }

        if (context.Response.Headers.Location.Count > 0)
        {
            var location = context.Response.Headers.Location.ToString();
            var match = GuidRegex.Match(location);
            if (match.Success && Guid.TryParse(match.Value, out var parsedLocationId))
            {
                return parsedLocationId;
            }
        }

        return Guid.Empty;
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
        catch (DbUpdateException ex)
        {
            context.Response.StatusCode = 409;
            await context.Response.WriteAsJsonAsync(new { error = MapDatabaseError(ex) });
        }
        catch (Exception ex)
        {
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred.", detail = ex.Message });
        }
    }

    private static string MapDatabaseError(DbUpdateException ex)
    {
        var message = ex.InnerException?.Message ?? ex.Message;

        if (message.Contains("IX_Companies_Slug", StringComparison.OrdinalIgnoreCase))
            return "Bu sirket adi zaten kullanimda. Lutfen farkli bir sirket adi deneyin.";

        if (message.Contains("CompanyId, Email", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("Email already in use", StringComparison.OrdinalIgnoreCase))
            return "Bu e-posta adresi zaten kullanimda.";

        if (message.Contains("duplicate key value", StringComparison.OrdinalIgnoreCase))
            return "Bu bilgilerle zaten bir kayit bulunuyor.";

        return "Kayit sirasinda veri tabani tarafinda bir cakisma olustu.";
    }
}
