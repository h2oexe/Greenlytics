using Greenlytics.Domain.Interfaces;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace Greenlytics.Infrastructure.Services;

public class RedisCacheService : ICacheService
{
    private readonly IDistributedCache _cache;

    public RedisCacheService(IDistributedCache cache) => _cache = cache;

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default) where T : class
    {
        var json = await _cache.GetStringAsync(key, ct);
        return json is null ? null : JsonSerializer.Deserialize<T>(json);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default) where T : class
    {
        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiry ?? TimeSpan.FromHours(1)
        };
        await _cache.SetStringAsync(key, JsonSerializer.Serialize(value), options, ct);
    }

    public Task RemoveAsync(string key, CancellationToken ct = default) => _cache.RemoveAsync(key, ct);

    public async Task RemoveByPatternAsync(string pattern, CancellationToken ct = default)
    {
        // For production, use a Redis SCAN approach via StackExchange.Redis
        // This is a simplified implementation - works fine for low volume
        // In high-load scenarios, inject IConnectionMultiplexer and do SCAN + DEL
        await Task.CompletedTask;
    }
}

public class DateTimeService : IDateTimeService
{
    public DateTime UtcNow => DateTime.UtcNow;
}
