using Greenlytics.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;
using Stripe.Checkout;

namespace Greenlytics.Infrastructure.Services;

public class StripePaymentService : IPaymentService
{
    private readonly ILogger<StripePaymentService> _logger;
    private readonly string _webhookSecret;

    public StripePaymentService(IConfiguration config, ILogger<StripePaymentService> logger)
    {
        _logger = logger;
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"] ?? "sk_test_placeholder";
        _webhookSecret = config["Stripe:WebhookSecret"] ?? string.Empty;
    }

    public async Task<string> CreateCheckoutSessionAsync(
        Guid companyId, string stripePriceId, string successUrl, string cancelUrl, CancellationToken ct = default)
    {
        var options = new SessionCreateOptions
        {
            Mode = "subscription",
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = stripePriceId, Quantity = 1 }
            },
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string> { { "companyId", companyId.ToString() } },
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                Metadata = new Dictionary<string, string> { { "companyId", companyId.ToString() } }
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options, cancellationToken: ct);
        return session.Url;
    }

    public async Task<string> CreateCustomerPortalSessionAsync(string stripeCustomerId, string returnUrl, CancellationToken ct = default)
    {
        var options = new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = stripeCustomerId,
            ReturnUrl = returnUrl
        };
        var service = new Stripe.BillingPortal.SessionService();
        var session = await service.CreateAsync(options, cancellationToken: ct);
        return session.Url;
    }

    public Task<bool> HandleWebhookAsync(string payload, string signature, CancellationToken ct = default)
    {
        try
        {
            var stripeEvent = EventUtility.ConstructEvent(payload, signature, _webhookSecret);
            _logger.LogInformation("Stripe webhook: {Type}", stripeEvent.Type);
            // TODO: Handle subscription.created, payment_intent.payment_failed, customer.subscription.deleted
            // These update the Subscription entity status in the database
            return Task.FromResult(true);
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe webhook validation failed");
            return Task.FromResult(false);
        }
    }
}
