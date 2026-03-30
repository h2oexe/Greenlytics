using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Features.Energy;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Greenlytics.API.Controllers;

[ApiController]
[Route("api/energy")]
[Authorize]
[Produces("application/json")]
public class EnergyController : ControllerBase
{
    private readonly EnergyService _service;
    private readonly ICurrentUserService _user;

    public EnergyController(EnergyService service, ICurrentUserService user) => (_service, _user) = (service, user);

    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>List energy entries with optional filtering.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResult<EnergyEntryDto>), 200)]
    public async Task<IActionResult> GetList(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] EnergyCategory? category,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _service.GetListAsync(CompanyId, from, to, category, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>Get a single energy entry.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EnergyEntryDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, CompanyId, ct);
        return result.Succeeded ? Ok(result.Data) : NotFound(new { errors = result.Errors });
    }

    /// <summary>Create a new energy entry.</summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(EnergyEntryDto), 201)]
    [ProducesResponseType(typeof(object), 400)]
    public async Task<IActionResult> Create([FromBody] CreateEnergyEntryRequest req, CancellationToken ct)
    {
        var result = await _service.CreateAsync(CompanyId, req, ct);
        return result.Succeeded ? CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, result.Data)
            : BadRequest(new { errors = result.Errors });
    }

    /// <summary>Update an energy entry.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(EnergyEntryDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEnergyEntryRequest req, CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, CompanyId, req, ct);
        return result.Succeeded ? Ok(result.Data) : NotFound(new { errors = result.Errors });
    }

    /// <summary>Delete an energy entry.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await _service.DeleteAsync(id, CompanyId, ct);
        return result.Succeeded ? NoContent() : NotFound(new { errors = result.Errors });
    }
}

[ApiController]
[Route("api/water")]
[Authorize]
[Produces("application/json")]
public class WaterController : ControllerBase
{
    private readonly Application.Features.Water.WaterService _service;
    private readonly ICurrentUserService _user;
    public WaterController(Application.Features.Water.WaterService service, ICurrentUserService user) => (_service, _user) = (service, user);
    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>List water entries.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResult<WaterEntryDto>), 200)]
    public async Task<IActionResult> GetList([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] WaterCategory? category, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(await _service.GetListAsync(CompanyId, from, to, category, page, pageSize, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await _service.GetByIdAsync(id, CompanyId, ct);
        return r.Succeeded ? Ok(r.Data) : NotFound();
    }

    /// <summary>Create a new water entry.</summary>
    [HttpPost, Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateWaterEntryRequest req, CancellationToken ct)
    {
        var r = await _service.CreateAsync(CompanyId, req, ct);
        return r.Succeeded ? CreatedAtAction(nameof(GetById), new { id = r.Data!.Id }, r.Data) : BadRequest(new { errors = r.Errors });
    }

    [HttpPut("{id:guid}"), Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWaterEntryRequest req, CancellationToken ct)
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
}

[ApiController]
[Route("api/waste")]
[Authorize]
[Produces("application/json")]
public class WasteController : ControllerBase
{
    private readonly Application.Features.Waste.WasteService _service;
    private readonly ICurrentUserService _user;
    public WasteController(Application.Features.Waste.WasteService service, ICurrentUserService user) => (_service, _user) = (service, user);
    private Guid CompanyId => _user.CompanyId!.Value;

    /// <summary>List waste entries.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResult<WasteEntryDto>), 200)]
    public async Task<IActionResult> GetList([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] WasteCategory? category, [FromQuery] bool? recyclable,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(await _service.GetListAsync(CompanyId, from, to, category, recyclable, page, pageSize, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await _service.GetByIdAsync(id, CompanyId, ct);
        return r.Succeeded ? Ok(r.Data) : NotFound();
    }

    /// <summary>Create a new waste entry.</summary>
    [HttpPost, Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateWasteEntryRequest req, CancellationToken ct)
    {
        var r = await _service.CreateAsync(CompanyId, req, ct);
        return r.Succeeded ? CreatedAtAction(nameof(GetById), new { id = r.Data!.Id }, r.Data) : BadRequest(new { errors = r.Errors });
    }

    [HttpPut("{id:guid}"), Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWasteEntryRequest req, CancellationToken ct)
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
}
