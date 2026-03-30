using FluentValidation;
using Greenlytics.Application.Common.Models;

namespace Greenlytics.Application.Common.Validators;

public class RegisterCompanyValidator : AbstractValidator<RegisterCompanyRequest>
{
    public RegisterCompanyValidator()
    {
        RuleFor(x => x.CompanyName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain at least one digit.");
    }
}

public class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class ForgotPasswordValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public class ResetPasswordValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
        RuleFor(x => x.ConfirmPassword).Equal(x => x.NewPassword)
            .WithMessage("Passwords do not match.");
    }
}

public class CreateEnergyEntryValidator : AbstractValidator<CreateEnergyEntryRequest>
{
    public CreateEnergyEntryValidator()
    {
        RuleFor(x => x.KWh).GreaterThan(0).LessThan(10_000_000);
        RuleFor(x => x.RecordedAt).LessThanOrEqualTo(DateTime.UtcNow.AddDays(1));
    }
}

public class CreateWaterEntryValidator : AbstractValidator<CreateWaterEntryRequest>
{
    public CreateWaterEntryValidator()
    {
        RuleFor(x => x.Liters).GreaterThan(0).LessThan(100_000_000);
        RuleFor(x => x.RecordedAt).LessThanOrEqualTo(DateTime.UtcNow.AddDays(1));
    }
}

public class CreateWasteEntryValidator : AbstractValidator<CreateWasteEntryRequest>
{
    public CreateWasteEntryValidator()
    {
        RuleFor(x => x.Kg).GreaterThan(0).LessThan(1_000_000);
        RuleFor(x => x.RecordedAt).LessThanOrEqualTo(DateTime.UtcNow.AddDays(1));
    }
}

public class CreateCarbonInputValidator : AbstractValidator<CreateCarbonInputRequest>
{
    public CreateCarbonInputValidator()
    {
        RuleFor(x => x.Value).GreaterThan(0);
        RuleFor(x => x.Unit).NotEmpty().MaximumLength(20);
        RuleFor(x => x.RecordedAt).LessThanOrEqualTo(DateTime.UtcNow.AddDays(1));
    }
}

public class CreateGoalValidator : AbstractValidator<CreateGoalRequest>
{
    public CreateGoalValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.TargetValue).GreaterThan(0);
        RuleFor(x => x.Unit).NotEmpty();
        RuleFor(x => x.StartDate).LessThan(x => x.EndDate)
            .WithMessage("Start date must be before end date.");
    }
}

public class InviteUserValidator : AbstractValidator<InviteUserRequest>
{
    public InviteUserValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}
