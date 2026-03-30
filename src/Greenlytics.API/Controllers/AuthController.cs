using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Validators;
using Greenlytics.Application.Features.Auth;
using Greenlytics.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Greenlytics.API.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;

    public AuthController(AuthService auth) => _auth = auth;

    /// <summary>Register a new company and admin user.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), 200)]
    [ProducesResponseType(typeof(object), 400)]
    public async Task<IActionResult> Register([FromBody] RegisterCompanyRequest req, CancellationToken ct)
    {
        var result = await _auth.RegisterAsync(req, ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>Login with email and password.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), 200)]
    [ProducesResponseType(typeof(object), 401)]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var result = await _auth.LoginAsync(req, ct);
        return result.Succeeded ? Ok(result.Data) : Unauthorized(new { errors = result.Errors });
    }

    /// <summary>Refresh an expired access token using a refresh token.</summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), 200)]
    [ProducesResponseType(typeof(object), 401)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest req, CancellationToken ct)
    {
        var result = await _auth.RefreshTokenAsync(req, ct);
        return result.Succeeded ? Ok(result.Data) : Unauthorized(new { errors = result.Errors });
    }

    /// <summary>Send password reset email.</summary>
    [HttpPost("forgot-password")]
    [ProducesResponseType(200)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        await _auth.ForgotPasswordAsync(req, ct);
        return Ok(new { message = "If this email exists, a reset link has been sent." });
    }

    /// <summary>Reset password using token from email.</summary>
    [HttpPost("reset-password")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(object), 400)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        var result = await _auth.ResetPasswordAsync(req, ct);
        return result.Succeeded ? Ok(new { message = "Password reset successfully." }) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>Invite a user to your company. [Admin only]</summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("invite")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(object), 400)]
    public async Task<IActionResult> Invite([FromBody] InviteUserRequest req, [FromServices] ICurrentUserService user, CancellationToken ct)
    {
        var company = await GetCompanyNameAsync(user);
        var result = await _auth.InviteUserAsync(req, user.CompanyId!.Value, company, ct);
        return result.Succeeded ? Ok(new { message = "Invitation sent." }) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>Accept invitation and complete registration.</summary>
    [HttpPost("accept-invite")]
    [ProducesResponseType(typeof(AuthResponse), 200)]
    [ProducesResponseType(typeof(object), 400)]
    public async Task<IActionResult> AcceptInvite([FromBody] AcceptInviteRequest req, CancellationToken ct)
    {
        var result = await _auth.AcceptInviteAsync(req, ct);
        return result.Succeeded ? Ok(result.Data) : BadRequest(new { errors = result.Errors });
    }

    private Task<string> GetCompanyNameAsync(ICurrentUserService user) => Task.FromResult("Your Company");
}
