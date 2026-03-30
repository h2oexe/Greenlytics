using FluentValidation;
using Greenlytics.Application.Common.Services;
using Greenlytics.Application.Features.Auth;
using Greenlytics.Application.Features.Carbon;
using Greenlytics.Application.Features.Energy;
using Greenlytics.Application.Features.Goals;
using Greenlytics.Application.Features.Reports;
using Greenlytics.Application.Features.Waste;
using Greenlytics.Application.Features.Water;
using Greenlytics.Domain.Interfaces;
using Greenlytics.Infrastructure.BackgroundJobs;
using Greenlytics.Infrastructure.Identity;
using Greenlytics.Infrastructure.Persistence;
using Greenlytics.Infrastructure.Services;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Greenlytics.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        // ── Database ─────────────────────────────────────────────────────
        services.AddDbContext<AppDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("DefaultConnection"),
                b => b.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)));

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        // ── Redis ─────────────────────────────────────────────────────────
        services.AddStackExchangeRedisCache(opts =>
            opts.Configuration = config.GetConnectionString("Redis") ?? "localhost:6379");
        services.AddSingleton<ICacheService, RedisCacheService>();

        // ── Hangfire ─────────────────────────────────────────────────────
        services.AddHangfire(hf => hf
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(opts => opts.UseNpgsqlConnection(config.GetConnectionString("DefaultConnection"))));
        services.AddHangfireServer();

        // ── Services ─────────────────────────────────────────────────────
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IStorageService, MinioStorageService>();
        services.AddScoped<IPaymentService, StripePaymentService>();
        services.AddScoped<IFeatureGatingService, FeatureGatingService>();
        services.AddScoped<ICarbonCalculatorService, CarbonCalculatorService>();
        services.AddScoped<IAggregationService, AggregationService>();
        services.AddScoped<IExportService, ExportService>();
        services.AddScoped<IGoalService, GoalService>();
        services.AddTransient<IDateTimeService, DateTimeService>();

        // ── Application Feature Services ─────────────────────────────────
        services.AddScoped<AuthService>();
        services.AddScoped<EnergyService>();
        services.AddScoped<WaterService>();
        services.AddScoped<WasteService>();
        services.AddScoped<CarbonService>();

        // ── Background Jobs ─────────────────────────────────────────────
        services.AddScoped<WeeklyReportJob>();
        services.AddScoped<ThresholdCheckJob>();

        // ── FluentValidation ─────────────────────────────────────────────
        services.AddValidatorsFromAssembly(typeof(Application.Common.Validators.RegisterCompanyValidator).Assembly);

        return services;
    }
}
