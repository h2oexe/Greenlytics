namespace Greenlytics.Application.Common;

public static class DateTimeNormalization
{
    public static DateTime ToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            _ => value
        };
    }

    public static DateTime? ToUtc(DateTime? value) => value.HasValue ? ToUtc(value.Value) : null;
}
