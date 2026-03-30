using Greenlytics.Domain.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;

namespace Greenlytics.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private string Host => _config["Email:Host"] ?? "localhost";
    private int Port => int.TryParse(_config["Email:Port"], out var p) ? p : 1025;
    private string From => _config["Email:From"] ?? "noreply@greenlytics.app";
    private string? Username => _config["Email:Username"];
    private string? Password => _config["Email:Password"];
    private bool UseSsl => bool.TryParse(_config["Email:UseSsl"], out var s) && s;
    private string AppUrl => _config["AppUrl"] ?? "http://localhost:3000";

    public EmailService(IConfiguration config) => _config = config;

    public Task SendInviteEmailAsync(string toEmail, string token, string companyName, CancellationToken ct = default)
    {
        var link = $"{AppUrl}/accept-invite?token={token}";
        return SendAsync(toEmail, $"You're invited to join {companyName} on Greenlytics",
            $"""
            <h2>You've been invited to Greenlytics!</h2>
            <p>You've been invited to join <strong>{companyName}</strong> on Greenlytics, the sustainability management platform.</p>
            <p><a href="{link}" style="background:#22c55e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">Accept Invitation</a></p>
            <p>This link expires in 7 days.</p>
            """, ct);
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string token, CancellationToken ct = default)
    {
        var link = $"{AppUrl}/reset-password?token={token}";
        return SendAsync(toEmail, "Reset your Greenlytics password",
            $"""
            <h2>Password Reset</h2>
            <p>We received a request to reset your password.</p>
            <p><a href="{link}" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
            <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
            """, ct);
    }

    public Task SendThresholdAlertEmailAsync(string toEmail, string companyName, string message, CancellationToken ct = default) =>
        SendAsync(toEmail, $"⚠️ Sustainability Threshold Alert – {companyName}",
            $"<h2>Threshold Alert</h2><p>{message}</p>", ct);

    public Task SendWeeklyReportEmailAsync(string toEmail, string companyName, byte[] pdfAttachment, CancellationToken ct = default) =>
        SendWithAttachmentAsync(toEmail, $"📊 Weekly Sustainability Report – {companyName}",
            "<h2>Your weekly report is attached.</h2>", pdfAttachment, "weekly-report.pdf", ct);

    public Task SendGenericEmailAsync(string toEmail, string subject, string body, CancellationToken ct = default) =>
        SendAsync(toEmail, subject, body, ct);

    private async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct)
    {
        var message = BuildMessage(toEmail, subject, htmlBody);
        await DeliverAsync(message, ct);
    }

    private async Task SendWithAttachmentAsync(string toEmail, string subject, string htmlBody, byte[] attachment, string fileName, CancellationToken ct)
    {
        var message = BuildMessage(toEmail, subject, htmlBody);
        var builder = new BodyBuilder { HtmlBody = htmlBody };
        builder.Attachments.Add(fileName, attachment, ContentType.Parse("application/pdf"));
        message.Body = builder.ToMessageBody();
        await DeliverAsync(message, ct);
    }

    private MimeMessage BuildMessage(string toEmail, string subject, string htmlBody)
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(From));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };
        return message;
    }

    private async Task DeliverAsync(MimeMessage message, CancellationToken ct)
    {
        using var client = new SmtpClient();
        await client.ConnectAsync(Host, Port, UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.None, ct);
        if (!string.IsNullOrEmpty(Username))
            await client.AuthenticateAsync(Username, Password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
