namespace Greenlytics.Domain.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    Guid? CompanyId { get; }
    string? Email { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
}

public interface IEmailService
{
    Task SendInviteEmailAsync(string toEmail, string inviteToken, string companyName, CancellationToken ct = default);
    Task SendPasswordResetEmailAsync(string toEmail, string resetToken, CancellationToken ct = default);
    Task SendThresholdAlertEmailAsync(string toEmail, string companyName, string message, CancellationToken ct = default);
    Task SendWeeklyReportEmailAsync(string toEmail, string companyName, byte[] pdfAttachment, CancellationToken ct = default);
    Task SendGenericEmailAsync(string toEmail, string subject, string body, CancellationToken ct = default);
}

public interface IStorageService
{
    Task<string> UploadFileAsync(string bucketName, string objectKey, Stream content, string contentType, CancellationToken ct = default);
    Task<string> GetSignedUrlAsync(string bucketName, string objectKey, int expiryMinutes = 60, CancellationToken ct = default);
    Task DeleteFileAsync(string bucketName, string objectKey, CancellationToken ct = default);
}

public interface IPaymentService
{
    Task<string> CreateCheckoutSessionAsync(Guid companyId, string stripePriceId, string successUrl, string cancelUrl, CancellationToken ct = default);
    Task<string> CreateCustomerPortalSessionAsync(string stripeCustomerId, string returnUrl, CancellationToken ct = default);
    Task<bool> HandleWebhookAsync(string payload, string signature, CancellationToken ct = default);
}

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default) where T : class;
    Task RemoveAsync(string key, CancellationToken ct = default);
    Task RemoveByPatternAsync(string pattern, CancellationToken ct = default);
}

public interface IDateTimeService
{
    DateTime UtcNow { get; }
}
