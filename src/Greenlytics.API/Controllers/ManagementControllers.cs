using Greenlytics.Application.Common;
using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Application.Features.Goals;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.API.Controllers;

// ── Goals ────────────────────────────────────────────────────────────────────
[ApiController, Route("api/goals"), Authorize, Produces("application/json")]
public class GoalsController : ControllerBase
{
    private readonly IApplicationDbContext _db;
    private readonly IGoalService _service;
    private readonly ICurrentUserService _user;
    public GoalsController(IApplicationDbContext db, IGoalService service, ICurrentUserService user) =>
        (_db, _service, _user) = (db, service, user);
    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>List all goals for the company.</summary>
    [HttpGet, ProducesResponseType(typeof(List<GoalDto>), 200)]
    public async Task<IActionResult> GetList(CancellationToken ct)
        => Ok(await _db.Goals.Select(g => new GoalDto(g.Id, g.Type, g.Name, g.Description, g.TargetValue, g.Unit, g.Period, g.StartDate, g.EndDate, g.Status, g.CreatedAt)).ToListAsync(ct));

    [HttpGet("{id:guid}"), ProducesResponseType(typeof(GoalDto), 200)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var g = await _db.Goals.FirstOrDefaultAsync(x => x.Id == id, ct);
        return g is null ? NotFound() : Ok(new GoalDto(g.Id, g.Type, g.Name, g.Description, g.TargetValue, g.Unit, g.Period, g.StartDate, g.EndDate, g.Status, g.CreatedAt));
    }

    /// <summary>Create a new sustainability goal.</summary>
    [HttpPost, Authorize(Roles = "Admin,Manager"), ProducesResponseType(typeof(GoalDto), 201)]
    public async Task<IActionResult> Create([FromBody] CreateGoalRequest req, CancellationToken ct)
    {
        var goal = new Goal
        {
            CompanyId = CompanyId,
            Type = req.Type,
            Name = req.Name,
            Description = req.Description,
            TargetValue = req.TargetValue,
            Unit = req.Unit,
            Period = req.Period,
            StartDate = DateTimeNormalization.ToUtc(req.StartDate),
            EndDate = DateTimeNormalization.ToUtc(req.EndDate)
        };
        _db.Goals.Add(goal);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = goal.Id }, new GoalDto(goal.Id, goal.Type, goal.Name, goal.Description, goal.TargetValue, goal.Unit, goal.Period, goal.StartDate, goal.EndDate, goal.Status, goal.CreatedAt));
    }

    [HttpPut("{id:guid}"), Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateGoalRequest req, CancellationToken ct)
    {
        var g = await _db.Goals.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (g is null) return NotFound();
        if (req.Name is not null) g.Name = req.Name;
        if (req.Description is not null) g.Description = req.Description;
        if (req.TargetValue.HasValue) g.TargetValue = req.TargetValue.Value;
        if (req.StartDate.HasValue) g.StartDate = DateTimeNormalization.ToUtc(req.StartDate.Value);
        if (req.EndDate.HasValue) g.EndDate = DateTimeNormalization.ToUtc(req.EndDate.Value);
        if (req.Status.HasValue) g.Status = req.Status.Value;
        g.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new GoalDto(g.Id, g.Type, g.Name, g.Description, g.TargetValue, g.Unit, g.Period, g.StartDate, g.EndDate, g.Status, g.CreatedAt));
    }

    [HttpDelete("{id:guid}"), Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var g = await _db.Goals.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (g is null) return NotFound();
        _db.Goals.Remove(g);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Get current progress percentage for a goal.</summary>
    [HttpGet("{id:guid}/progress"), ProducesResponseType(typeof(GoalProgressDto), 200)]
    public async Task<IActionResult> GetProgress(Guid id, CancellationToken ct)
        => Ok(await _service.GetProgressAsync(id, CompanyId, ct));

    /// <summary>Get progress for all active goals.</summary>
    [HttpGet("progress/all"), ProducesResponseType(typeof(List<GoalProgressDto>), 200)]
    public async Task<IActionResult> GetAllProgress(CancellationToken ct)
        => Ok(await _service.GetAllProgressAsync(CompanyId, ct));
}

// ── Notifications ────────────────────────────────────────────────────────────
[ApiController, Route("api/notifications"), Authorize, Produces("application/json")]
public class NotificationsController : ControllerBase
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _user;
    private readonly IFeatureGatingService _gating;
    public NotificationsController(IApplicationDbContext db, ICurrentUserService user, IFeatureGatingService gating) =>
        (_db, _user, _gating) = (db, user, gating);
    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>List all notifications for the current company.</summary>
    [HttpGet, ProducesResponseType(typeof(List<NotificationDto>), 200)]
    public IActionResult GetList([FromQuery] bool? unreadOnly)
    {
        var query = _db.Notifications.AsQueryable();
        if (unreadOnly == true) query = query.Where(n => !n.IsRead);
        return Ok(query.OrderByDescending(n => n.CreatedAt)
            .Select(n => new NotificationDto(n.Id, n.Type, n.Title, n.Message, n.IsRead, n.ReadAt, n.CreatedAt)));
    }

    /// <summary>Mark notification as read.</summary>
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (n is null) return NotFound();
        n.IsRead = true; n.ReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Register a webhook URL. [Enterprise only]</summary>
    [HttpPost("webhooks"), Authorize(Roles = "Admin"), ProducesResponseType(typeof(WebhookDto), 201)]
    public async Task<IActionResult> CreateWebhook([FromBody] CreateWebhookRequest req, CancellationToken ct)
    {
        if (!await _gating.CanUseWebhooksAsync(CompanyId, ct))
            return StatusCode(403, new { error = "Webhooks require Enterprise plan." });

        var wh = new Webhook { CompanyId = CompanyId, Url = req.Url, Secret = req.Secret, IsActive = true, Events = System.Text.Json.JsonSerializer.Serialize(req.Events) };
        _db.Webhooks.Add(wh);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetWebhooks), new { }, new WebhookDto(wh.Id, wh.Url, wh.IsActive, req.Events, wh.LastTriggeredAt, wh.CreatedAt));
    }

    [HttpGet("webhooks"), ProducesResponseType(typeof(List<WebhookDto>), 200)]
    public async Task<IActionResult> GetWebhooks(CancellationToken ct)
    {
        var hooks = await _db.Webhooks.ToListAsync(ct);
        return Ok(hooks.Select(w => new WebhookDto(w.Id, w.Url, w.IsActive,
            System.Text.Json.JsonSerializer.Deserialize<List<string>>(w.Events ?? "[]") ?? new(), w.LastTriggeredAt, w.CreatedAt)));
    }

    [HttpDelete("webhooks/{id:guid}"), Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteWebhook(Guid id, CancellationToken ct)
    {
        var wh = await _db.Webhooks.FirstOrDefaultAsync(w => w.Id == id, ct);
        if (wh is null) return NotFound();
        _db.Webhooks.Remove(wh);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ── Subscriptions ────────────────────────────────────────────────────────────
[ApiController, Route("api/subscriptions"), Authorize, Produces("application/json")]
public class SubscriptionsController : ControllerBase
{
    private readonly IApplicationDbContext _db;
    private readonly IPaymentService _payment;
    private readonly ICurrentUserService _user;
    public SubscriptionsController(IApplicationDbContext db, IPaymentService payment, ICurrentUserService user) =>
        (_db, _payment, _user) = (db, payment, user);
    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>Get current subscription and usage statistics.</summary>
    [HttpGet("current"), ProducesResponseType(typeof(SubscriptionDto), 200)]
    public async Task<IActionResult> GetCurrent(CancellationToken ct)
    {
        var sub = await _db.Subscriptions.IgnoreQueryFilters().Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.CompanyId == CompanyId, ct);
        if (sub is null) return NotFound();
        return Ok(new SubscriptionDto(sub.Id, sub.Plan.Name, sub.Plan.DisplayName, sub.Status, sub.CurrentPeriodEnd,
            sub.CancelAtPeriodEnd, sub.RecordsThisMonth, sub.Plan.MaxRecordsPerMonth, sub.ExportsThisMonth, sub.Plan.MaxExportsPerMonth));
    }

    /// <summary>List all available plans.</summary>
    [HttpGet("plans"), ProducesResponseType(typeof(List<PlanDto>), 200)]
    public IActionResult GetPlans()
        => Ok(_db.Plans.IgnoreQueryFilters().Select(p =>
            new PlanDto(p.Id, p.Name, p.DisplayName, p.MonthlyPrice, p.YearlyPrice,
                p.MaxRecordsPerMonth, p.MaxExportsPerMonth, p.CanExport, p.CanUseApiKeys, p.CanUseWebhooks, p.CanAccessAdvancedReports)));

    /// <summary>Create a Stripe checkout session for a plan upgrade.</summary>
    [HttpPost("checkout"), Authorize(Roles = "Admin"), ProducesResponseType(typeof(CheckoutSessionDto), 200)]
    public async Task<IActionResult> CreateCheckout([FromBody] CreateCheckoutSessionRequest req, CancellationToken ct)
    {
        var plan = await _db.Plans.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == req.PlanId, ct);
        if (plan is null) return NotFound("Plan not found.");
        var priceId = req.YearlyBilling ? plan.StripePriceIdYearly : plan.StripePriceIdMonthly;
        if (string.IsNullOrEmpty(priceId)) return BadRequest(new { error = "Stripe price not configured for this plan." });
        var url = await _payment.CreateCheckoutSessionAsync(CompanyId, priceId, req.SuccessUrl, req.CancelUrl, ct);
        return Ok(new CheckoutSessionDto(url));
    }

    /// <summary>Stripe webhook endpoint (no auth required).</summary>
    [HttpPost("webhook"), AllowAnonymous]
    public async Task<IActionResult> StripeWebhook(CancellationToken ct)
    {
        var payload = await new System.IO.StreamReader(Request.Body).ReadToEndAsync(ct);
        var sig = Request.Headers["Stripe-Signature"].FirstOrDefault() ?? "";
        return await _payment.HandleWebhookAsync(payload, sig, ct) ? Ok() : BadRequest();
    }
}

// ── API Keys ─────────────────────────────────────────────────────────────────
[ApiController, Route("api/apikeys"), Authorize, Produces("application/json")]
public class ApiKeysController : ControllerBase
{
    private readonly IApplicationDbContext _db;
    private readonly IFeatureGatingService _gating;
    private readonly ICurrentUserService _user;
    public ApiKeysController(IApplicationDbContext db, IFeatureGatingService gating, ICurrentUserService user) =>
        (_db, _gating, _user) = (db, gating, user);
    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>List all API keys for the company. [Enterprise only]</summary>
    [HttpGet, Authorize(Roles = "Admin"), ProducesResponseType(typeof(List<ApiKeyDto>), 200)]
    public async Task<IActionResult> GetList(CancellationToken ct)
    {
        if (!await _gating.CanUseApiKeysAsync(CompanyId, ct))
            return StatusCode(403, new { error = "API Keys require Enterprise plan." });
        return Ok(await _db.ApiKeys.Select(k => new ApiKeyDto(k.Id, k.Name, k.KeyPrefix, k.Permission, k.IsActive, k.LastUsedAt, k.ExpiresAt, k.CreatedAt)).ToListAsync(ct));
    }

    /// <summary>Create a new API key. The full key is shown only once.</summary>
    [HttpPost, Authorize(Roles = "Admin"), ProducesResponseType(typeof(CreateApiKeyResponse), 201)]
    public async Task<IActionResult> Create([FromBody] CreateApiKeyRequest req, CancellationToken ct)
    {
        if (!await _gating.CanUseApiKeysAsync(CompanyId, ct))
            return StatusCode(403, new { error = "API Keys require Enterprise plan." });

        var rawKey = $"gl_{Guid.NewGuid():N}{Guid.NewGuid():N}";
        var apiKey = new ApiKey
        {
            CompanyId = CompanyId, Name = req.Name,
            KeyHash = BCrypt.Net.BCrypt.HashPassword(rawKey),
            KeyPrefix = rawKey[..12],
            Permission = req.Permission, ExpiresAt = req.ExpiresAt
        };
        _db.ApiKeys.Add(apiKey);
        await _db.SaveChangesAsync(ct);
        var dto = new ApiKeyDto(apiKey.Id, apiKey.Name, apiKey.KeyPrefix, apiKey.Permission, apiKey.IsActive, null, apiKey.ExpiresAt, apiKey.CreatedAt);
        return CreatedAtAction(nameof(GetList), new { }, new CreateApiKeyResponse(dto, rawKey));
    }

    /// <summary>Revoke an API key.</summary>
    [HttpDelete("{id:guid}"), Authorize(Roles = "Admin")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        var key = await _db.ApiKeys.FirstOrDefaultAsync(k => k.Id == id, ct);
        if (key is null) return NotFound();
        key.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
[ApiController, Route("api/audit"), Authorize(Roles = "Admin"), Produces("application/json")]
public class AuditLogController : ControllerBase
{
    private readonly IApplicationDbContext _db;
    public AuditLogController(IApplicationDbContext db) => _db = db;

    /// <summary>Get audit log entries. [Admin only]</summary>
    [HttpGet, ProducesResponseType(typeof(List<AuditLogDto>), 200)]
    public IActionResult GetList([FromQuery] string? userEmail, [FromQuery] string? entityName,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        from = DateTimeNormalization.ToUtc(from);
        to = DateTimeNormalization.ToUtc(to);

        var query = _db.AuditLogs.AsQueryable();
        if (userEmail is not null) query = query.Where(a => a.UserEmail.Contains(userEmail));
        if (entityName is not null) query = query.Where(a => a.EntityName == entityName);
        if (from.HasValue) query = query.Where(a => a.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(a => a.CreatedAt <= to.Value);

        return Ok(query.OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new AuditLogDto(a.Id, a.UserEmail, a.EntityName, a.EntityId, a.Action, a.OldValues, a.NewValues, a.IpAddress, a.CreatedAt)));
    }
}
