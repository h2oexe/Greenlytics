using Greenlytics.Application.Common.Services;
using Greenlytics.Application.Features.Goals;
using Greenlytics.Application.Features.Reports;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Greenlytics.Infrastructure.BackgroundJobs;

public class WeeklyReportJob
{
    private readonly IApplicationDbContext _db;
    private readonly IExportService _export;
    private readonly IEmailService _email;
    private readonly ILogger<WeeklyReportJob> _logger;

    public WeeklyReportJob(IApplicationDbContext db, IExportService export, IEmailService email, ILogger<WeeklyReportJob> logger)
        => (_db, _export, _email, _logger) = (db, export, email, logger);

    [AutomaticRetry(Attempts = 3)]
    public async Task ExecuteAsync()
    {
        _logger.LogInformation("Starting weekly report job at {Time}", DateTime.UtcNow);

        var companies = await _db.Companies.IgnoreQueryFilters()
            .Where(c => c.IsActive)
            .Include(c => c.Users)
            .ToListAsync();

        foreach (var company in companies)
        {
            try
            {
                var admins = company.Users.Where(u => u.Role == UserRole.Admin && u.IsActive).ToList();
                if (!admins.Any()) continue;

                var req = new Application.Common.Models.ExportRequest(ExportType.PDF,
                    DateTime.UtcNow.AddDays(-7), DateTime.UtcNow, null);

                var pdf = await _export.ExportToPdfAsync(company.Id, req, CancellationToken.None);

                foreach (var admin in admins)
                    await _email.SendWeeklyReportEmailAsync(admin.Email, company.Name, pdf);

                _logger.LogInformation("Weekly report sent for company {CompanyId}", company.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send weekly report for company {CompanyId}", company.Id);
            }
        }
    }
}

public class ThresholdCheckJob
{
    private readonly IApplicationDbContext _db;
    private readonly IAggregationService _aggregation;
    private readonly IEmailService _email;
    private readonly IGoalService _goals;
    private readonly ILogger<ThresholdCheckJob> _logger;

    public ThresholdCheckJob(IApplicationDbContext db, IAggregationService aggregation, IEmailService email,
        IGoalService goals, ILogger<ThresholdCheckJob> logger)
        => (_db, _aggregation, _email, _goals, _logger) = (db, aggregation, email, goals, logger);

    [AutomaticRetry(Attempts = 2)]
    public async Task ExecuteAsync()
    {
        _logger.LogInformation("Threshold check job started at {Time}", DateTime.UtcNow);

        var companies = await _db.Companies.IgnoreQueryFilters()
            .Where(c => c.IsActive)
            .Include(c => c.Users)
            .ToListAsync();

        foreach (var company in companies)
        {
            try
            {
                // Update goal statuses
                await _goals.CheckAndUpdateGoalStatusesAsync(company.Id, CancellationToken.None);

                var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var summary = await _aggregation.GetSummaryAsync(company.Id, monthStart, DateTime.UtcNow, CancellationToken.None);

                // Check for significant spikes (e.g. > 20% over last month average)
                var lastMonthStart = monthStart.AddMonths(-1);
                var lastSummary = await _aggregation.GetSummaryAsync(company.Id, lastMonthStart, monthStart, CancellationToken.None);

                var alerts = new List<string>();
                if (lastSummary.TotalEnergyKWh > 0 && summary.TotalEnergyKWh > lastSummary.TotalEnergyKWh * 1.2m)
                    alerts.Add($"Energy: {summary.TotalEnergyKWh:N0} kWh (↑{((summary.TotalEnergyKWh / lastSummary.TotalEnergyKWh - 1) * 100):N1}% vs last month)");
                if (lastSummary.TotalCO2eKg > 0 && summary.TotalCO2eKg > lastSummary.TotalCO2eKg * 1.2m)
                    alerts.Add($"Carbon: {summary.TotalCO2eKg:N2} kgCO2e (↑{((summary.TotalCO2eKg / lastSummary.TotalCO2eKg - 1) * 100):N1}% vs last month)");

                if (alerts.Any())
                {
                    var message = $"The following sustainability metrics exceeded 20% growth compared to last month:\n\n" + string.Join("\n", alerts);
                    var admins = company.Users.Where(u => u.Role == UserRole.Admin && u.IsActive);
                    foreach (var admin in admins)
                        await _email.SendThresholdAlertEmailAsync(admin.Email, company.Name, message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Threshold check failed for company {CompanyId}", company.Id);
            }
        }
    }
}

public static class HangfireJobScheduler
{
    public static void ScheduleRecurringJobs()
    {
        RecurringJob.AddOrUpdate<WeeklyReportJob>("weekly-reports", j => j.ExecuteAsync(), Cron.Weekly(DayOfWeek.Monday, 8));
        RecurringJob.AddOrUpdate<ThresholdCheckJob>("threshold-checks", j => j.ExecuteAsync(), Cron.Daily(6));
    }
}
