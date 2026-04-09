using System.Text;
using FluentValidation;
using Greenlytics.API.Middleware;
using Greenlytics.Domain.Entities;
using Greenlytics.Domain.Enums;
using Greenlytics.Domain.Interfaces;
using Greenlytics.Infrastructure;
using Greenlytics.Infrastructure.Persistence;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using AspNetCoreRateLimit;
using Greenlytics.Infrastructure.BackgroundJobs;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ───────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();
builder.Host.UseSerilog();

// ── Infrastructure ─────────────────────────────────────────────────────────
builder.Services.AddInfrastructure(builder.Configuration);

// ── HTTP Context ──────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// ── JWT Auth ─────────────────────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "Greenlytics",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "Greenlytics",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization();

// ── Rate Limiting ─────────────────────────────────────────────────────────
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddSingleton<IIpPolicyStore, MemoryCacheIpPolicyStore>();
builder.Services.AddSingleton<IRateLimitCounterStore, MemoryCacheRateLimitCounterStore>();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddSingleton<IProcessingStrategy, AsyncKeyLockProcessingStrategy>();
builder.Services.AddInMemoryRateLimiting();

// ── Controllers ───────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ── Swagger ───────────────────────────────────────────────────────────────
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Greenlytics API",
        Version = "v1",
        Description = "Sustainability Manager API – Multi-tenant SaaS backend for tracking energy, water, waste, and carbon emissions.",
        Contact = new OpenApiContact { Name = "Greenlytics Team" }
    });

    // JWT Security definition
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {your_token}"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });

    // Include XML comments
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath)) c.IncludeXmlComments(xmlPath);
});

// ── CORS ──────────────────────────────────────────────────────────────────
builder.Services.AddCors(opts => opts.AddPolicy("AllowAll", policy =>
    policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// ── Health Checks ─────────────────────────────────────────────────────────
builder.Services.AddHealthChecks();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var connection = db.Database.GetDbConnection();
    connection.Open();

    using (var command = connection.CreateCommand())
    {
        command.CommandText = "SELECT COALESCE(to_regclass('public.\"Plans\"')::text, '')";
        var plansTable = command.ExecuteScalar();

        if (plansTable is null || plansTable == DBNull.Value || string.IsNullOrWhiteSpace(plansTable.ToString()))
        {
            var creator = db.Database.GetService<IRelationalDatabaseCreator>();
            creator.CreateTables();
        }
    }

    if (!db.Plans.Any())
    {
        db.Plans.AddRange(
            new Plan
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = PlanName.Basic,
                DisplayName = "Basic",
                MonthlyPrice = 0,
                YearlyPrice = 0,
                MaxRecordsPerMonth = 500,
                MaxExportsPerMonth = 0,
                CanExport = false,
                CanUseApiKeys = false,
                CanUseWebhooks = false,
                CanAccessAdvancedReports = false,
                CanSetGoals = false,
                HasPrioritySupport = false,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Plan
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                Name = PlanName.Pro,
                DisplayName = "Pro",
                MonthlyPrice = 49,
                YearlyPrice = 490,
                MaxRecordsPerMonth = 10000,
                MaxExportsPerMonth = 50,
                CanExport = true,
                CanUseApiKeys = false,
                CanUseWebhooks = false,
                CanAccessAdvancedReports = true,
                CanSetGoals = true,
                HasPrioritySupport = false,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Plan
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                Name = PlanName.Enterprise,
                DisplayName = "Enterprise",
                MonthlyPrice = 199,
                YearlyPrice = 1990,
                MaxRecordsPerMonth = -1,
                MaxExportsPerMonth = -1,
                CanExport = true,
                CanUseApiKeys = true,
                CanUseWebhooks = true,
                CanAccessAdvancedReports = true,
                CanSetGoals = true,
                HasPrioritySupport = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        db.SaveChanges();
    }
}

// ── Middleware Pipeline ───────────────────────────────────────────────────
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseSerilogRequestLogging();
app.UseCors("AllowAll");
app.UseIpRateLimiting();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Greenlytics API v1");
        c.RoutePrefix = "swagger";
        c.DisplayRequestDuration();
    });
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AuditLogMiddleware>();

app.MapControllers();
app.MapHealthChecks("/health");

// ── Hangfire Dashboard (Admin only in production) ─────────────────────────
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireAuthFilter() }
});

// ── Schedule recurring jobs ───────────────────────────────────────────────
HangfireJobScheduler.ScheduleRecurringJobs();

app.Run();

// ── Hangfire auth filter ──────────────────────────────────────────────────
public class HangfireAuthFilter : Hangfire.Dashboard.IDashboardAuthorizationFilter
{
    public bool Authorize(Hangfire.Dashboard.DashboardContext context)
    {
        // MVP: Allow local dev access. In production, properly require authorization
        return true;
    }
}
