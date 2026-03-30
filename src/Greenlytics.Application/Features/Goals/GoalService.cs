using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Greenlytics.Application.Features.Goals;

public class GoalService : IGoalService
{
    private readonly IApplicationDbContext _db;
    private readonly IAggregationService _aggregation;

    public GoalService(IApplicationDbContext db, IAggregationService aggregation) =>
        (_db, _aggregation) = (db, aggregation);

    public async Task<GoalProgressDto> GetProgressAsync(Guid goalId, Guid companyId, CancellationToken ct)
    {
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.Id == goalId && g.CompanyId == companyId, ct)
            ?? throw new KeyNotFoundException("Goal not found.");

        var current = await GetCurrentValueAsync(goal, companyId, ct);
        var progress = goal.TargetValue > 0 ? (double)(current / goal.TargetValue * 100) : 0;
        var isAchieved = current <= goal.TargetValue;
        var isOverdue = DateTime.UtcNow > goal.EndDate && !isAchieved;

        return new GoalProgressDto(goal.Id, goal.Name, goal.Type, goal.TargetValue, current,
            goal.Unit, Math.Round(progress, 2), goal.Status, goal.StartDate, goal.EndDate, isAchieved, isOverdue);
    }

    public async Task<List<GoalProgressDto>> GetAllProgressAsync(Guid companyId, CancellationToken ct)
    {
        var goals = await _db.Goals.Where(g => g.CompanyId == companyId && g.Status == GoalStatus.Active).ToListAsync(ct);
        var result = new List<GoalProgressDto>();
        foreach (var goal in goals)
            result.Add(await GetProgressAsync(goal.Id, companyId, ct));
        return result;
    }

    public async Task CheckAndUpdateGoalStatusesAsync(Guid companyId, CancellationToken ct)
    {
        var activeGoals = await _db.Goals
            .Where(g => g.CompanyId == companyId && g.Status == GoalStatus.Active).ToListAsync(ct);

        foreach (var goal in activeGoals)
        {
            if (DateTime.UtcNow <= goal.EndDate) continue;
            var current = await GetCurrentValueAsync(goal, companyId, ct);
            goal.Status = current <= goal.TargetValue ? GoalStatus.Achieved : GoalStatus.Missed;
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task<decimal> GetCurrentValueAsync(Domain.Entities.Goal goal, Guid companyId, CancellationToken ct)
    {
        return goal.Type switch
        {
            GoalType.Energy => await _db.EnergyEntries
                .Where(e => e.CompanyId == companyId && e.RecordedAt >= goal.StartDate && e.RecordedAt <= goal.EndDate)
                .SumAsync(e => e.KWh, ct),
            GoalType.Water => await _db.WaterEntries
                .Where(w => w.CompanyId == companyId && w.RecordedAt >= goal.StartDate && w.RecordedAt <= goal.EndDate)
                .SumAsync(w => w.Liters, ct),
            GoalType.Waste => await _db.WasteEntries
                .Where(w => w.CompanyId == companyId && w.RecordedAt >= goal.StartDate && w.RecordedAt <= goal.EndDate)
                .SumAsync(w => w.Kg, ct),
            GoalType.Carbon => await _db.CarbonInputs
                .Where(c => c.CompanyId == companyId && c.RecordedAt >= goal.StartDate && c.RecordedAt <= goal.EndDate)
                .SumAsync(c => c.CO2eKg, ct),
            _ => 0m
        };
    }
}
