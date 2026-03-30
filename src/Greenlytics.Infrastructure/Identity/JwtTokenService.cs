using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Greenlytics.Application.Common.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Greenlytics.Infrastructure.Identity;

public class JwtTokenService : IJwtTokenService
{
    private readonly string _secret;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _expiryMinutes;

    public JwtTokenService(IConfiguration config)
    {
        _secret   = config["Jwt:Secret"]   ?? throw new InvalidOperationException("Jwt:Secret not configured.");
        _issuer   = config["Jwt:Issuer"]   ?? "Greenlytics";
        _audience = config["Jwt:Audience"] ?? "Greenlytics";
        _expiryMinutes = int.TryParse(config["Jwt:ExpiryMinutes"], out var m) ? m : 15;
    }

    public (string Token, DateTime Expires) GenerateAccessToken(Guid userId, Guid companyId, string email, string role)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_expiryMinutes);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("companyId", companyId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };

        var token = new JwtSecurityToken(_issuer, _audience, claims, expires: expires, signingCredentials: creds);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }

    public (Guid userId, Guid companyId)? ValidateExpiredToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false // Allow expired tokens for refresh
            }, out var validatedToken);

            var jwt = (JwtSecurityToken)validatedToken;
            var userId = Guid.Parse(jwt.Subject);
            var companyId = Guid.Parse(jwt.Claims.First(c => c.Type == "companyId").Value);
            return (userId, companyId);
        }
        catch { return null; }
    }
}
