using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Application.Features.Carbon;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Greenlytics.API.Controllers;

[ApiController]
[Route("api/carbon")]
[Authorize]
[Produces("application/json")]
public class CarbonController : ControllerBase
{
    private readonly CarbonService _service;
    private readonly ICurrentUserService _user;

    public CarbonController(CarbonService service, ICurrentUserService user) => (_service, _user) = (service, user);
    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>List carbon inputs with optional filtering.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResult<CarbonInputDto>), 200)]
    public async Task<IActionResult> GetList([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] CarbonSource? source, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(await _service.GetListAsync(CompanyId, from, to, source, page, pageSize, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await _service.GetByIdAsync(id, CompanyId, ct);
        return r.Succeeded ? Ok(r.Data) : NotFound();
    }

    /// <summary>Create a carbon input. CO2e is auto-calculated using IPCC emission factors.</summary>
    [HttpPost, Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(CarbonInputDto), 201)]
    public async Task<IActionResult> Create([FromBody] CreateCarbonInputRequest req, CancellationToken ct)
    {
        var r = await _service.CreateAsync(CompanyId, req, ct);
        return r.Succeeded ? CreatedAtAction(nameof(GetById), new { id = r.Data!.Id }, r.Data) : BadRequest(new { errors = r.Errors });
    }

    [HttpPut("{id:guid}"), Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCarbonInputRequest req, CancellationToken ct)
    {
        var r = await _service.UpdateAsync(id, CompanyId, req, ct);
        return r.Succeeded ? Ok(r.Data) : NotFound();
    }

    [HttpDelete("{id:guid}"), Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await _service.DeleteAsync(id, CompanyId, ct);
        return r.Succeeded ? NoContent() : NotFound();
    }

    /// <summary>Get full carbon footprint breakdown for the company.</summary>
    [HttpGet("footprint")]
    [ProducesResponseType(typeof(CarbonFootprintDto), 200)]
    public async Task<IActionResult> GetFootprint([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
        => Ok(await _service.GetFootprintAsync(CompanyId, from, to, ct));
}

[ApiController]
[Route("api/reports")]
[Authorize]
[Produces("application/json")]
public class ReportsController : ControllerBase
{
    private readonly IAggregationService _aggregation;
    private readonly ICurrentUserService _user;
    private readonly Application.Features.Goals.GoalService _goals;

    public ReportsController(IAggregationService aggregation, ICurrentUserService user, Application.Features.Goals.GoalService goals)
        => (_aggregation, _user, _goals) = (aggregation, user, goals);

    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>Get total consumption summary for a period.</summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(ConsumptionSummaryDto), 200)]
    public async Task<IActionResult> Summary([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
        => Ok(await _aggregation.GetSummaryAsync(CompanyId, from, to, ct));

    /// <summary>Get monthly or yearly trend data with % change.</summary>
    [HttpGet("trends")]
    [ProducesResponseType(typeof(List<TrendDto>), 200)]
    public async Task<IActionResult> Trends([FromQuery] string period = "monthly", [FromQuery] int count = 12, CancellationToken ct = default)
    {
        var trends = period.ToLower() == "yearly"
            ? await _aggregation.GetYearlyTrendsAsync(CompanyId, count, ct)
            : await _aggregation.GetMonthlyTrendsAsync(CompanyId, count, ct);
        return Ok(trends);
    }

    /// <summary>Get category-level breakdowns for energy, waste, and carbon.</summary>
    [HttpGet("category")]
    [ProducesResponseType(typeof(object), 200)]
    public async Task<IActionResult> Category([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var energy = await _aggregation.GetEnergyByCategoryAsync(CompanyId, from, to, ct);
        var waste  = await _aggregation.GetWasteByCategoryAsync(CompanyId, from, to, ct);
        var carbon = await _aggregation.GetCarbonBySourceAsync(CompanyId, from, to, ct);
        return Ok(new { energyByCategory = energy, wasteByCategory = waste, carbonBySource = carbon });
    }

    /// <summary>Get dashboard-ready aggregated data (current month + trends + goals).</summary>
    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(DashboardDto), 200)]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var lastMonthStart = monthStart.AddMonths(-1);

        var current  = await _aggregation.GetSummaryAsync(CompanyId, monthStart, now, ct);
        var last     = await _aggregation.GetSummaryAsync(CompanyId, lastMonthStart, monthStart, ct);
        var trends   = await _aggregation.GetMonthlyTrendsAsync(CompanyId, 6, ct);
        var energyCat = await _aggregation.GetEnergyByCategoryAsync(CompanyId, monthStart, now, ct);
        var wasteCat  = await _aggregation.GetWasteByCategoryAsync(CompanyId, monthStart, now, ct);
        var carbonSrc = await _aggregation.GetCarbonBySourceAsync(CompanyId, monthStart, now, ct);
        var goalProgress = await _goals.GetAllProgressAsync(CompanyId, ct);

        return Ok(new DashboardDto(current, last, trends, energyCat, wasteCat, carbonSrc, goalProgress, 0));
    }
}

[ApiController]
[Route("api/export")]
[Authorize]
[Produces("application/json")]
public class ExportController : ControllerBase
{
    private readonly IExportService _export;
    private readonly IFeatureGatingService _gating;
    private readonly IStorageService _storage;
    private readonly ICurrentUserService _user;
    private readonly IApplicationDbContext _db;
    private const string Bucket = "greenlytics-exports";

    public ExportController(IExportService export, IFeatureGatingService gating, IStorageService storage,
        ICurrentUserService user, IApplicationDbContext db)
        => (_export, _gating, _storage, _user, _db) = (export, gating, storage, user, db);

    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>Generate a PDF report. [Pro/Enterprise only]</summary>
    [HttpPost("pdf")]
    [ProducesResponseType(typeof(ExportResultDto), 200)]
    [ProducesResponseType(typeof(object), 403)]
    public async Task<IActionResult> ExportPdf([FromBody] ExportRequest req, CancellationToken ct)
        => await ExportAsync(req with { Type = Domain.Enums.ExportType.PDF }, ct);

    /// <summary>Generate an Excel report. [Pro/Enterprise only]</summary>
    [HttpPost("excel")]
    [ProducesResponseType(typeof(ExportResultDto), 200)]
    public async Task<IActionResult> ExportExcel([FromBody] ExportRequest req, CancellationToken ct)
        => await ExportAsync(req with { Type = Domain.Enums.ExportType.Excel }, ct);

    /// <summary>Generate a CSV export. [Pro/Enterprise only]</summary>
    [HttpPost("csv")]
    [ProducesResponseType(typeof(ExportResultDto), 200)]
    public async Task<IActionResult> ExportCsv([FromBody] ExportRequest req, CancellationToken ct)
        => await ExportAsync(req with { Type = Domain.Enums.ExportType.CSV }, ct);

    /// <summary>List previous exports for this company.</summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(List<object>), 200)]
    public IActionResult GetHistory()
        => Ok(_db.ExportedFiles
            .Where(f => f.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new { f.Id, f.FileName, f.ExportType, f.FileSizeBytes, f.CreatedAt, f.ExpiresAt }));

    /// <summary>Get a fresh signed download URL for a previously exported file.</summary>
    [HttpGet("{id:guid}/download")]
    [ProducesResponseType(typeof(object), 200)]
    public async Task<IActionResult> GetDownloadUrl(Guid id, CancellationToken ct)
    {
        var file = await _db.ExportedFiles.FindAsync(new object[] { id }, ct);
        if (file is null) return NotFound();
        var url = await _storage.GetSignedUrlAsync(Bucket, file.StoragePath, 60, ct);
        return Ok(new { downloadUrl = url, expiresInMinutes = 60 });
    }

    private async Task<IActionResult> ExportAsync(ExportRequest req, CancellationToken ct)
    {
        if (!await _gating.CanExportAsync(CompanyId, ct))
            return StatusCode(403, new { error = "Export is not available on your current plan. Please upgrade to Pro or Enterprise." });

        byte[] bytes;
        string contentType;
        string extension;

        switch (req.Type)
        {
            case Domain.Enums.ExportType.PDF:
                bytes = await _export.ExportToPdfAsync(CompanyId, req, ct);
                contentType = "application/pdf"; extension = "pdf"; break;
            case Domain.Enums.ExportType.Excel:
                bytes = await _export.ExportToExcelAsync(CompanyId, req, ct);
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; extension = "xlsx"; break;
            default:
                bytes = await _export.ExportToCsvAsync(CompanyId, req, ct);
                contentType = "text/csv"; extension = "csv"; break;
        }

        var fileName = $"report_{DateTime.UtcNow:yyyyMMdd_HHmmss}.{extension}";
        var objectKey = $"{CompanyId}/{fileName}";
        using var ms = new System.IO.MemoryStream(bytes);
        await _storage.UploadFileAsync(Bucket, objectKey, ms, contentType, ct);
        var downloadUrl = await _storage.GetSignedUrlAsync(Bucket, objectKey, 60, ct);

        var record = new Domain.Entities.ExportedFile
        {
            CompanyId = CompanyId, FileName = fileName, StoragePath = objectKey,
            ExportType = req.Type, FileSizeBytes = bytes.Length,
            FromDate = req.From, ToDate = req.To,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        };
        _db.ExportedFiles.Add(record);
        await _db.SaveChangesAsync(ct);
        await _gating.IncrementExportCountAsync(CompanyId, ct);

        return Ok(new ExportResultDto(record.Id, fileName, req.Type, downloadUrl, record.ExpiresAt, bytes.Length));
    }
}
