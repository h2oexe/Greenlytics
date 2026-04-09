using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Application.Features.Auth;

public class AuthService
{
    private readonly IApplicationDbContext _db;
    private readonly IJwtTokenService _jwt;
    private readonly IEmailService _email;
    private readonly IDateTimeService _dateTime;

    public AuthService(IApplicationDbContext db, IJwtTokenService jwt, IEmailService email, IDateTimeService dateTime)
    {
        _db = db; _jwt = jwt; _email = email; _dateTime = dateTime;
    }

    public async Task<Result<AuthResponse>> RegisterAsync(RegisterCompanyRequest req, CancellationToken ct)
    {
        if (await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == req.Email.ToLower(), ct))
            return Result<AuthResponse>.Failure("Email already in use.");

        var basicPlan = await _db.Plans.FirstOrDefaultAsync(p => p.Name == PlanName.Basic, ct)
            ?? throw new InvalidOperationException("Basic plan not found. Run database seeder.");

        var companySlug = await GenerateUniqueCompanySlugAsync(req.CompanyName, ct);

        var company = new Company
        {
            Name = req.CompanyName,
            Slug = companySlug,
            PlanId = basicPlan.Id
        };
        _db.Companies.Add(company);

        var subscription = new Subscription
        {
            CompanyId = company.Id,
            PlanId = basicPlan.Id,
            Status = SubscriptionStatus.Trialing,
            CurrentPeriodStart = _dateTime.UtcNow,
            CurrentPeriodEnd = _dateTime.UtcNow.AddDays(14)
        };
        _db.Subscriptions.Add(subscription);

        var user = new User
        {
            CompanyId = company.Id,
            FirstName = req.FirstName,
            LastName = req.LastName,
            Email = req.Email.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = UserRole.Admin,
            IsEmailVerified = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        var (token, expires) = _jwt.GenerateAccessToken(user.Id, company.Id, user.Email, user.Role.ToString());
        var refreshToken = _jwt.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiresAt = _dateTime.UtcNow.AddDays(7);
        user.LastLoginAt = _dateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var userDto = MapUser(user);
        return Result<AuthResponse>.Success(new AuthResponse(token, refreshToken, expires, userDto));
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        var user = await _db.Users
            .IgnoreQueryFilters()
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Email == req.Email.ToLower() && u.IsActive, ct);

        if (user is null)
            return Result<AuthResponse>.Failure("Invalid email or password.");

        if (user.LockedOutUntil.HasValue && user.LockedOutUntil > _dateTime.UtcNow)
            return Result<AuthResponse>.Failure($"Account is locked. Try again after {user.LockedOutUntil:HH:mm} UTC.");

        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
                user.LockedOutUntil = _dateTime.UtcNow.AddMinutes(15);
            await _db.SaveChangesAsync(ct);
            return Result<AuthResponse>.Failure("Invalid email or password.");
        }

        user.FailedLoginAttempts = 0;
        user.LockedOutUntil = null;
        user.LastLoginAt = _dateTime.UtcNow;

        var (token, expires) = _jwt.GenerateAccessToken(user.Id, user.CompanyId, user.Email, user.Role.ToString());
        var refreshToken = _jwt.GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiresAt = _dateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(new AuthResponse(token, refreshToken, expires, MapUser(user)));
    }

    public async Task<Result<AuthResponse>> RefreshTokenAsync(RefreshTokenRequest req, CancellationToken ct)
    {
        var claims = _jwt.ValidateExpiredToken(req.AccessToken);
        if (claims is null) return Result<AuthResponse>.Failure("Invalid access token.");

        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == claims.Value.userId, ct);
        if (user is null || user.RefreshToken != req.RefreshToken || user.RefreshTokenExpiresAt < _dateTime.UtcNow)
            return Result<AuthResponse>.Failure("Invalid or expired refresh token.");

        var (token, expires) = _jwt.GenerateAccessToken(user.Id, user.CompanyId, user.Email, user.Role.ToString());
        var newRefresh = _jwt.GenerateRefreshToken();
        user.RefreshToken = newRefresh;
        user.RefreshTokenExpiresAt = _dateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(new AuthResponse(token, newRefresh, expires, MapUser(user)));
    }

    public async Task<Result> ForgotPasswordAsync(ForgotPasswordRequest req, CancellationToken ct)
    {
        var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == req.Email.ToLower(), ct);
        if (user is null) return Result.Success(); // Don't reveal user existence

        user.PasswordResetToken = Guid.NewGuid().ToString("N");
        user.PasswordResetTokenExpiresAt = _dateTime.UtcNow.AddHours(1);
        await _db.SaveChangesAsync(ct);

        await _email.SendPasswordResetEmailAsync(user.Email, user.PasswordResetToken, ct);
        return Result.Success();
    }

    public async Task<Result> ResetPasswordAsync(ResetPasswordRequest req, CancellationToken ct)
    {
        var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(
            u => u.PasswordResetToken == req.Token && u.PasswordResetTokenExpiresAt > _dateTime.UtcNow, ct);

        if (user is null) return Result.Failure("Invalid or expired reset token.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        user.RefreshToken = null; // Invalidate all sessions
        await _db.SaveChangesAsync(ct);

        return Result.Success();
    }

    public async Task<Result> InviteUserAsync(InviteUserRequest req, Guid companyId, string companyName, CancellationToken ct)
    {
        if (await _db.Users.AnyAsync(u => u.Email == req.Email.ToLower() && u.CompanyId == companyId, ct))
            return Result.Failure("User with this email already exists in your company.");

        var user = new User
        {
            CompanyId = companyId,
            Email = req.Email.ToLower(),
            FirstName = req.FirstName ?? string.Empty,
            LastName = req.LastName ?? string.Empty,
            PasswordHash = string.Empty,
            Role = req.Role,
            InviteToken = Guid.NewGuid().ToString("N"),
            InviteTokenExpiresAt = _dateTime.UtcNow.AddDays(7),
            IsActive = false
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        await _email.SendInviteEmailAsync(user.Email, user.InviteToken, companyName, ct);
        return Result.Success();
    }

    public async Task<Result<AuthResponse>> AcceptInviteAsync(AcceptInviteRequest req, CancellationToken ct)
    {
        var user = await _db.Users.IgnoreQueryFilters().Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.InviteToken == req.Token && u.InviteTokenExpiresAt > _dateTime.UtcNow, ct);

        if (user is null) return Result<AuthResponse>.Failure("Invalid or expired invite token.");

        user.FirstName = req.FirstName;
        user.LastName = req.LastName;
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        user.InviteToken = null;
        user.InviteTokenExpiresAt = null;
        user.IsActive = true;
        user.IsEmailVerified = true;

        var (token, expires) = _jwt.GenerateAccessToken(user.Id, user.CompanyId, user.Email, user.Role.ToString());
        var refreshToken = _jwt.GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiresAt = _dateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(new AuthResponse(token, refreshToken, expires, MapUser(user)));
    }

    private static UserDto MapUser(User u) => new(u.Id, u.CompanyId, u.FirstName, u.LastName, u.Email, u.Role, u.IsActive, u.LastLoginAt, u.CreatedAt);

    private async Task<string> GenerateUniqueCompanySlugAsync(string companyName, CancellationToken ct)
    {
        var baseSlug = NormalizeSlug(companyName);
        var slug = baseSlug;
        var suffix = 2;

        while (await _db.Companies.AnyAsync(c => c.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return slug;
    }

    private static string NormalizeSlug(string companyName)
    {
        var slug = new string(
            companyName
                .Trim()
                .ToLowerInvariant()
                .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
                .ToArray()
        );

        while (slug.Contains("--"))
        {
            slug = slug.Replace("--", "-");
        }

        slug = slug.Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "company" : slug;
    }
}
