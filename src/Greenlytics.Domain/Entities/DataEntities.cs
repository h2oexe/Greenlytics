using Greenlytics.Domain.Common;
using Greenlytics.Domain.Enums;

namespace Greenlytics.Domain.Entities;

public class EnergyEntry : TenantEntity
{
    public EnergyCategory Category { get; set; }
    public string? CategoryName { get; set; } // Custom label
    public decimal KWh { get; set; }
    public DateTime RecordedAt { get; set; }
    public string? Notes { get; set; }

    public Company Company { get; set; } = null!;
}

public class WaterEntry : TenantEntity
{
    public WaterCategory Category { get; set; }
    public string? CategoryName { get; set; }
    public decimal Liters { get; set; }
    public DateTime RecordedAt { get; set; }
    public string? Notes { get; set; }

    public Company Company { get; set; } = null!;
}

public class WasteEntry : TenantEntity
{
    public WasteCategory Category { get; set; }
    public string? CategoryName { get; set; }
    public bool IsRecyclable { get; set; }
    public decimal Kg { get; set; }
    public DateTime RecordedAt { get; set; }
    public string? Notes { get; set; }

    public Company Company { get; set; } = null!;
}

public class CarbonInput : TenantEntity
{
    public CarbonSource Source { get; set; }
    public TransportType? TransportType { get; set; }
    public string? Description { get; set; }
    public decimal Value { get; set; }        // e.g. km, kWh, m3
    public string Unit { get; set; } = string.Empty; // km, kwh, liter, kg
    public decimal CO2eKg { get; set; }       // Calculated CO2 equivalent in kg
    public decimal EmissionFactor { get; set; } // kg CO2e per unit
    public DateTime RecordedAt { get; set; }
    public string? Notes { get; set; }

    public Company Company { get; set; } = null!;
}

public class Goal : TenantEntity
{
    public GoalType Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal TargetValue { get; set; }
    public string Unit { get; set; } = string.Empty;
    public GoalPeriod Period { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public GoalStatus Status { get; set; } = GoalStatus.Active;
    public EnergyCategory? EnergyCategory { get; set; }
    public WasteCategory? WasteCategory { get; set; }
    public CarbonSource? CarbonSource { get; set; }

    public Company Company { get; set; } = null!;
}
