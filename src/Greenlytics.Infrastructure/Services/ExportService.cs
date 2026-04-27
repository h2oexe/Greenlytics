using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using Greenlytics.Application.Common.Models;
using Greenlytics.Application.Common.Services;
using Greenlytics.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;

namespace Greenlytics.Infrastructure.Services;

public class ExportService : IExportService
{
    private static readonly CultureInfo ReportCulture = new("tr-TR");

    private readonly IApplicationDbContext _db;
    private readonly IGoalService _goals;

    public ExportService(IApplicationDbContext db, IGoalService goals)
    {
        _db = db;
        _goals = goals;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<byte[]> ExportToPdfAsync(Guid companyId, ExportRequest request, CancellationToken ct = default)
    {
        var company = await _db.Companies.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == companyId, ct)
            ?? throw new KeyNotFoundException("Company not found.");

        var data = await GatherDataAsync(companyId, request, ct);
        var goals = await _goals.GetAllProgressAsync(companyId, ct);
        var report = BuildPdfReport(company, request, data, goals);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.6f, Unit.Centimetre);
                page.PageColor("#f5f1e8");
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial").FontColor("#173a2b"));

                page.Content().Column(column =>
                {
                    column.Spacing(18);

                    column.Item().Background("#173a2b").Padding(28).Column(hero =>
                    {
                        hero.Spacing(18);
                        hero.Item().Row(row =>
                        {
                            row.Spacing(20);
                            row.ConstantItem(96).Height(96).Element(c => ComposeLogo(c, report.LogoBytes));
                            row.RelativeItem().Column(copy =>
                            {
                                copy.Spacing(6);
                                copy.Item().Text(report.ReportTitle).FontSize(28).Bold().FontColor("#f8faf8");
                                copy.Item().Text(report.CoverTagline).FontSize(13).FontColor("#dbe6df");
                                copy.Item().Text($"Hazırlayan: {report.PreparedBy}").FontSize(10).FontColor("#b7c8be");
                            });
                        });

                        hero.Item().Text(report.CompanyName).FontSize(22).SemiBold().FontColor("#ecf4ef");
                        hero.Item().Text($"Rapor tarihi: {report.ReportDate:dd MMMM yyyy}").FontSize(11).FontColor("#dbe6df");
                        hero.Item().Text($"Rapor dönemi: {report.PeriodLabel}").FontSize(11).FontColor("#dbe6df");
                    });

                    column.Item().Row(row =>
                    {
                        row.Spacing(14);
                        row.RelativeItem().Element(c => ComposeMetricCard(c, "Çevresel kapsam", report.IncludedModuleCount.ToString(ReportCulture), "aktif modül", "#2f855a"));
                        row.RelativeItem().Element(c => ComposeMetricCard(c, "Raporlama standardı", report.Frameworks.Count.ToString(ReportCulture), "seçili çerçeve", "#1d4ed8"));
                        row.RelativeItem().Element(c => ComposeMetricCard(c, "Toplam veri kaydı", report.Summary.RecordCount.ToString(ReportCulture), "zaman damgalı kayıt", "#92400e"));
                    });

                    column.Item().PaddingTop(10).Column(copy =>
                    {
                        copy.Spacing(10);
                        copy.Item().Text("Bu PDF, yönetim sunumu ve paydaş paylaşımı için profesyonel ESG düzeninde hazırlanmıştır.")
                            .FontSize(13)
                            .SemiBold();
                        copy.Item().Text(report.ExecutiveSummary).FontSize(11).FontColor("#30463d");
                    });
                });
            });

            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.PageColor("#fcfcfa");
                page.DefaultTextStyle(x => x.FontSize(10.5f).FontFamily("Arial").FontColor("#173a2b"));

                page.Header().Element(c => ComposeHeader(c, report));
                page.Content().PaddingVertical(12).Column(column =>
                {
                    column.Spacing(20);

                    column.Item().Element(c => ComposeContentsSection(c, report));
                    column.Item().PageBreak();
                    column.Item().Element(c => ComposeOverviewSection(c, report));
                    column.Item().PageBreak();
                    column.Item().Element(c => ComposeEnvironmentalSection(c, report));
                    column.Item().PageBreak();
                    column.Item().Element(c => ComposeSocialGovernanceSection(c, report));
                    column.Item().PageBreak();
                    column.Item().Element(c => ComposeClosingSection(c, report));
                });
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();
    }

    public async Task<byte[]> ExportToExcelAsync(Guid companyId, ExportRequest request, CancellationToken ct = default)
    {
        var data = await GatherDataAsync(companyId, request, ct);

        using var wb = new XLWorkbook();

        if (request.IncludeEnergy && data.EnergyEntries.Any())
        {
            var ws = wb.Worksheets.Add("Energy");
            ws.Cell(1, 1).Value = "Date"; ws.Cell(1, 2).Value = "Category"; ws.Cell(1, 3).Value = "kWh"; ws.Cell(1, 4).Value = "Notes";
            ws.Row(1).Style.Font.Bold = true; ws.Row(1).Style.Fill.BackgroundColor = XLColor.LightGreen;
            for (var i = 0; i < data.EnergyEntries.Count; i++)
            {
                var e = data.EnergyEntries[i]; var r = i + 2;
                ws.Cell(r, 1).Value = e.RecordedAt.ToString("yyyy-MM-dd");
                ws.Cell(r, 2).Value = e.CategoryName ?? e.Category.ToString();
                ws.Cell(r, 3).Value = (double)e.KWh;
                ws.Cell(r, 4).Value = e.Notes ?? "";
            }
            ws.Columns().AdjustToContents();
        }

        if (request.IncludeWater && data.WaterEntries.Any())
        {
            var ws = wb.Worksheets.Add("Water");
            ws.Cell(1, 1).Value = "Date"; ws.Cell(1, 2).Value = "Category"; ws.Cell(1, 3).Value = "Liters"; ws.Cell(1, 4).Value = "Notes";
            ws.Row(1).Style.Font.Bold = true; ws.Row(1).Style.Fill.BackgroundColor = XLColor.LightBlue;
            for (var i = 0; i < data.WaterEntries.Count; i++)
            {
                var w = data.WaterEntries[i]; var r = i + 2;
                ws.Cell(r, 1).Value = w.RecordedAt.ToString("yyyy-MM-dd");
                ws.Cell(r, 2).Value = w.CategoryName ?? w.Category.ToString();
                ws.Cell(r, 3).Value = (double)w.Liters;
                ws.Cell(r, 4).Value = w.Notes ?? "";
            }
            ws.Columns().AdjustToContents();
        }

        if (request.IncludeWaste && data.WasteEntries.Any())
        {
            var ws = wb.Worksheets.Add("Waste");
            ws.Cell(1, 1).Value = "Date"; ws.Cell(1, 2).Value = "Category"; ws.Cell(1, 3).Value = "Recyclable"; ws.Cell(1, 4).Value = "Kg"; ws.Cell(1, 5).Value = "Notes";
            ws.Row(1).Style.Font.Bold = true; ws.Row(1).Style.Fill.BackgroundColor = XLColor.LightYellow;
            for (var i = 0; i < data.WasteEntries.Count; i++)
            {
                var w = data.WasteEntries[i]; var r = i + 2;
                ws.Cell(r, 1).Value = w.RecordedAt.ToString("yyyy-MM-dd");
                ws.Cell(r, 2).Value = w.CategoryName ?? w.Category.ToString();
                ws.Cell(r, 3).Value = w.IsRecyclable;
                ws.Cell(r, 4).Value = (double)w.Kg;
                ws.Cell(r, 5).Value = w.Notes ?? "";
            }
            ws.Columns().AdjustToContents();
        }

        if (request.IncludeCarbon && data.CarbonInputs.Any())
        {
            var ws = wb.Worksheets.Add("Carbon");
            ws.Cell(1, 1).Value = "Date"; ws.Cell(1, 2).Value = "Source"; ws.Cell(1, 3).Value = "Value"; ws.Cell(1, 4).Value = "Unit"; ws.Cell(1, 5).Value = "CO2e (kg)";
            ws.Row(1).Style.Font.Bold = true; ws.Row(1).Style.Fill.BackgroundColor = XLColor.LightCoral;
            for (var i = 0; i < data.CarbonInputs.Count; i++)
            {
                var c = data.CarbonInputs[i]; var r = i + 2;
                ws.Cell(r, 1).Value = c.RecordedAt.ToString("yyyy-MM-dd");
                ws.Cell(r, 2).Value = c.Source.ToString();
                ws.Cell(r, 3).Value = (double)c.Value;
                ws.Cell(r, 4).Value = c.Unit;
                ws.Cell(r, 5).Value = (double)c.CO2eKg;
            }
            ws.Columns().AdjustToContents();
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public async Task<byte[]> ExportToCsvAsync(Guid companyId, ExportRequest request, CancellationToken ct = default)
    {
        var data = await GatherDataAsync(companyId, request, ct);
        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, leaveOpen: true);
        using var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture));

        csv.WriteField("Type"); csv.WriteField("Date"); csv.WriteField("Category");
        csv.WriteField("Value"); csv.WriteField("Unit"); csv.WriteField("Notes");
        await csv.NextRecordAsync();

        foreach (var e in data.EnergyEntries)
        {
            csv.WriteField("Energy"); csv.WriteField(e.RecordedAt.ToString("yyyy-MM-dd"));
            csv.WriteField(e.CategoryName ?? e.Category.ToString()); csv.WriteField(e.KWh); csv.WriteField("kWh"); csv.WriteField(e.Notes ?? "");
            await csv.NextRecordAsync();
        }
        foreach (var w in data.WaterEntries)
        {
            csv.WriteField("Water"); csv.WriteField(w.RecordedAt.ToString("yyyy-MM-dd"));
            csv.WriteField(w.CategoryName ?? w.Category.ToString()); csv.WriteField(w.Liters); csv.WriteField("Liters"); csv.WriteField(w.Notes ?? "");
            await csv.NextRecordAsync();
        }
        foreach (var w in data.WasteEntries)
        {
            csv.WriteField("Waste"); csv.WriteField(w.RecordedAt.ToString("yyyy-MM-dd"));
            csv.WriteField(w.CategoryName ?? w.Category.ToString()); csv.WriteField(w.Kg); csv.WriteField("kg"); csv.WriteField(w.Notes ?? "");
            await csv.NextRecordAsync();
        }
        foreach (var c in data.CarbonInputs)
        {
            csv.WriteField("Carbon"); csv.WriteField(c.RecordedAt.ToString("yyyy-MM-dd"));
            csv.WriteField(c.Source.ToString()); csv.WriteField(c.CO2eKg); csv.WriteField("kgCO2e"); csv.WriteField(c.Notes ?? "");
            await csv.NextRecordAsync();
        }

        await writer.FlushAsync();
        return ms.ToArray();
    }

    private PdfReportModel BuildPdfReport(
        Domain.Entities.Company company,
        ExportRequest request,
        ExportData data,
        List<GoalProgressDto> goals)
    {
        var companyName = string.IsNullOrWhiteSpace(request.CompanyDisplayName) ? company.Name : request.CompanyDisplayName.Trim();
        var reportDate = request.ReportDate?.Date ?? DateTime.UtcNow.Date;
        var reportTitle = string.IsNullOrWhiteSpace(request.ReportTitle) ? "Kurumsal ESG Performans Raporu" : request.ReportTitle.Trim();
        var coverTagline = string.IsNullOrWhiteSpace(request.CoverTagline)
            ? "Sürdürülebilirlik performansı, iklim riski ve gelecek hedefleri"
            : request.CoverTagline.Trim();
        var preparedBy = string.IsNullOrWhiteSpace(request.PreparedBy) ? "Greenlytics Platformu" : request.PreparedBy.Trim();

        var summary = new ConsumptionSummaryDto(
            data.EnergyEntries.Sum(x => x.KWh),
            data.WaterEntries.Sum(x => x.Liters),
            data.WasteEntries.Sum(x => x.Kg),
            data.CarbonInputs.Sum(x => x.CO2eKg),
            request.From ?? GetEarliestRecordDate(data) ?? reportDate,
            request.To ?? reportDate,
            data.EnergyEntries.Count + data.WaterEntries.Count + data.WasteEntries.Count + data.CarbonInputs.Count);

        var energyBreakdown = BuildBreakdown(
            data.EnergyEntries,
            entry => entry.CategoryName ?? entry.Category.ToString(),
            entry => entry.KWh,
            "kWh");
        var wasteBreakdown = BuildBreakdown(
            data.WasteEntries,
            entry => entry.CategoryName ?? entry.Category.ToString(),
            entry => entry.Kg,
            "kg");
        var carbonBreakdown = BuildBreakdown(
            data.CarbonInputs,
            input => input.Source.ToString(),
            input => input.CO2eKg,
            "kgCO2e");

        var recyclingRate = summary.TotalWasteKg > 0
            ? decimal.Round(data.WasteEntries.Where(x => x.IsRecyclable).Sum(x => x.Kg) / summary.TotalWasteKg * 100m, 1)
            : 0m;

        var frameworks = BuildFrameworkDefinitions(request.ReportingFrameworks);
        var environmentalHighlights = BuildEnvironmentalHighlights(summary, energyBreakdown, wasteBreakdown, carbonBreakdown, recyclingRate);
        var socialHighlights = BuildNarrativeList(
            request.SocialHighlights,
            "Çalışan güvenliği, eğitim saatleri, çeşitlilik ve toplumsal katkı gibi sosyal KPI'lar ayrı bir veri seti olarak izlenmelidir.",
            "Bu rapor sürümünde sosyal bölüm, yönetimin önceliklerini ve paydaş etkisini metinsel anlatımla destekler.",
            "GRI ve ESRS uyumu için çalışan deneyimi, tedarik zinciri etik kontrolleri ve topluluk etkisi göstergeleri eklenmelidir.");
        var governanceHighlights = BuildNarrativeList(
            request.GovernanceHighlights,
            "Yönetişim bölümü; sorumluluk matrisi, politika sahipliği, risk izleme ve yönetim kurulu gözetimini açıkça göstermelidir.",
            "TCFD, ISSB ve ESRS perspektifi için iklim riskleri, karar alma mekanizması ve kontrol döngüsü birlikte sunulmalıdır.",
            "Politika uyumu, iç kontrol ve denetim notları ayrı KPI setleriyle güçlendirilebilir.");
        var futureTargets = BuildFutureTargets(request.FutureTargets, goals);
        var conclusion = string.IsNullOrWhiteSpace(request.Conclusion)
            ? BuildDefaultConclusion(summary, goals, frameworks.Count)
            : request.Conclusion.Trim();
        var executiveSummary = string.IsNullOrWhiteSpace(request.ExecutiveSummary)
            ? BuildDefaultExecutiveSummary(summary, frameworks.Count, environmentalHighlights)
            : request.ExecutiveSummary.Trim();

        return new PdfReportModel(
            CompanyName: companyName,
            ReportTitle: reportTitle,
            CoverTagline: coverTagline,
            PreparedBy: preparedBy,
            ReportDate: reportDate,
            PeriodLabel: BuildPeriodLabel(request.From, request.To, reportDate),
            IncludedModuleCount: CountIncludedModules(request),
            LogoBytes: TryDecodeImage(request.LogoDataUrl),
            Summary: summary,
            Frameworks: frameworks,
            Goals: goals.OrderByDescending(goal => goal.ProgressPercent).Take(6).ToList(),
            EnergyTrend: BuildMonthlyTrendSeries(data.EnergyEntries, request.To, 6, entry => entry.RecordedAt, entry => entry.KWh),
            WaterTrend: BuildMonthlyTrendSeries(data.WaterEntries, request.To, 6, entry => entry.RecordedAt, entry => entry.Liters),
            WasteTrend: BuildMonthlyTrendSeries(data.WasteEntries, request.To, 6, entry => entry.RecordedAt, entry => entry.Kg),
            CarbonTrend: BuildMonthlyTrendSeries(data.CarbonInputs, request.To, 6, entry => entry.RecordedAt, entry => entry.CO2eKg),
            EnergyBreakdown: energyBreakdown,
            WasteBreakdown: wasteBreakdown,
            CarbonBreakdown: carbonBreakdown,
            ExecutiveSummary: executiveSummary,
            EnvironmentalHighlights: environmentalHighlights,
            SocialHighlights: socialHighlights,
            GovernanceHighlights: governanceHighlights,
            FutureTargets: futureTargets,
            Conclusion: conclusion,
            RecyclingRate: recyclingRate);
    }

    private static void ComposeHeader(IContainer container, PdfReportModel report)
    {
        container.PaddingBottom(10).Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Spacing(2);
                column.Item().Text(report.ReportTitle).FontSize(14).SemiBold();
                column.Item().Text(report.CompanyName).FontSize(9).FontColor("#6b7280");
            });

            row.ConstantItem(180).AlignRight().Column(column =>
            {
                column.Spacing(2);
                column.Item().AlignRight().Text(report.PeriodLabel).FontSize(9).FontColor("#6b7280");
                column.Item().AlignRight().Text($"Rapor tarihi: {report.ReportDate:dd.MM.yyyy}").FontSize(9).FontColor("#6b7280");
            });
        });
    }

    private static void ComposeFooter(IContainer container)
    {
        container.PaddingTop(10).AlignCenter().Text(text =>
        {
            text.Span("Generated by Greenlytics").FontSize(8).FontColor("#8a948d");
            text.Span("  |  ").FontSize(8).FontColor("#8a948d");
            text.Span(DateTime.UtcNow.ToString("dd.MM.yyyy HH:mm", ReportCulture)).FontSize(8).FontColor("#8a948d");
            text.Span("  |  Page ").FontSize(8).FontColor("#8a948d");
            text.CurrentPageNumber().FontSize(8).FontColor("#173a2b");
            text.Span(" / ").FontSize(8).FontColor("#8a948d");
            text.TotalPages().FontSize(8).FontColor("#173a2b");
        });
    }

    private static void ComposeContentsSection(IContainer container, PdfReportModel report)
    {
        var contents = new[]
        {
            "01  İçindekiler ve rapor kapsamı",
            "02  Yönetici özeti ve ESG omurgası",
            "03  Çevresel performans metrikleri",
            "04  Grafikler ve kategori kırılımları",
            "05  Sosyal ve yönetişim anlatısı",
            "06  Sonuç, aktif hedefler ve gelecek aksiyonları"
        };

        container.Column(column =>
        {
            column.Spacing(18);
            column.Item().Element(c => ComposeSectionHeading(c, "İçindekiler", "Raporun profesyonel sunum akışı ve kapsam özeti"));

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeInfoCard(
                    c,
                    "Seçili standartlar",
                    string.Join(", ", report.Frameworks.Select(x => x.Key)),
                    "PDF içinde her çerçeve için uyum perspektifi sunulur."));
                row.RelativeItem().Element(c => ComposeInfoCard(
                    c,
                    "Rapor dönemi",
                    report.PeriodLabel,
                    "Tarih ve kategori filtreleri tüm özetleri ve kırılımları etkiler."));
            });

            foreach (var item in contents)
            {
                column.Item().Element(c => ComposeListItem(c, item, "#173a2b"));
            }
        });
    }

    private static void ComposeOverviewSection(IContainer container, PdfReportModel report)
    {
        container.Column(column =>
        {
            column.Spacing(18);
            column.Item().Element(c => ComposeSectionHeading(c, "Yönetici Özeti", "ISSB, GRI, SASB, TCFD, CDP, IR ve ESRS perspektifleriyle özet görünüm"));

            column.Item().Element(c => ComposeNarrativePanel(c, "Öne çıkan mesaj", report.ExecutiveSummary));

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeInfoCard(c, "Environment", $"{FormatMetric(report.Summary.TotalEnergyKWh)} kWh enerji, {FormatMetric(report.Summary.TotalCO2eKg)} kgCO2e", "Operasyonel çevresel performans ve iklim baskısı."));
                row.RelativeItem().Element(c => ComposeInfoCard(c, "Social", "Niteliksel anlatım ve veri boşluğu yönetimi", "İnsan, topluluk ve tedarik zinciri başlıkları için yönetim notları."));
                row.RelativeItem().Element(c => ComposeInfoCard(c, "Governance", $"{report.Frameworks.Count} standart seçimi ile yönetim perspektifi", "Risk sahipliği, politika ve gözetim anlatısı."));
            });

            column.Item().Text("Raporlama standartları").FontSize(13).SemiBold();

            foreach (var chunk in report.Frameworks.Chunk(2))
            {
                column.Item().Row(row =>
                {
                    row.Spacing(14);
                    foreach (var framework in chunk)
                    {
                        row.RelativeItem().Element(c => ComposeFrameworkCard(c, framework));
                    }

                    if (chunk.Length == 1)
                    {
                        row.RelativeItem().Element(c => ComposeInfoCard(
                            c,
                            "Uygulama notu",
                            "Çevresel veriler güçlü, sosyal ve yönetişim katmanı anlatı ağırlıklı",
                            "İlerleyen sürümlerde yeni veri setleri eklenerek tam ESG derinliği artırılabilir."));
                    }
                });
            }
        });
    }

    private static void ComposeEnvironmentalSection(IContainer container, PdfReportModel report)
    {
        container.Column(column =>
        {
            column.Spacing(18);
            column.Item().Element(c => ComposeSectionHeading(c, "Çevresel Performans", "Enerji, su, atık ve karbon verilerinden oluşturulan profesyonel grafikler"));

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeMetricCard(c, "Enerji", FormatMetric(report.Summary.TotalEnergyKWh), "kWh", "#2f855a"));
                row.RelativeItem().Element(c => ComposeMetricCard(c, "Su", FormatMetric(report.Summary.TotalWaterLiters), "L", "#2563eb"));
            });

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeMetricCard(c, "Atık", FormatMetric(report.Summary.TotalWasteKg), "kg", "#b7791f"));
                row.RelativeItem().Element(c => ComposeMetricCard(c, "Karbon", FormatMetric(report.Summary.TotalCO2eKg), "kgCO2e", "#7c2d12"));
            });

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeTrendCard(c, "Enerji trendi", report.EnergyTrend, "kWh", "#2f855a"));
                row.RelativeItem().Element(c => ComposeTrendCard(c, "Su trendi", report.WaterTrend, "L", "#2563eb"));
            });

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeTrendCard(c, "Atık trendi", report.WasteTrend, "kg", "#b7791f"));
                row.RelativeItem().Element(c => ComposeTrendCard(c, "Karbon trendi", report.CarbonTrend, "kgCO2e", "#7c2d12"));
            });

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeBreakdownCard(c, "Enerji kategorileri", report.EnergyBreakdown, "#2f855a"));
                row.RelativeItem().Element(c => ComposeBreakdownCard(c, "Atık kategorileri", report.WasteBreakdown, "#b7791f"));
            });

            column.Item().Element(c => ComposeBreakdownCard(c, "Karbon kaynakları", report.CarbonBreakdown, "#7c2d12"));
            column.Item().Element(c => ComposeBulletCard(c, "Çevresel yorumlar", report.EnvironmentalHighlights, "#173a2b"));
        });
    }

    private static void ComposeSocialGovernanceSection(IContainer container, PdfReportModel report)
    {
        container.Column(column =>
        {
            column.Spacing(18);
            column.Item().Element(c => ComposeSectionHeading(c, "Sosyal ve Yönetişim", "Veri kapsamını destekleyen anlatı, kontrol ve risk yönetimi çerçevesi"));

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeBulletCard(c, "Sosyal başlıklar", report.SocialHighlights, "#2563eb"));
                row.RelativeItem().Element(c => ComposeBulletCard(c, "Yönetişim başlıkları", report.GovernanceHighlights, "#7c3aed"));
            });

            column.Item().Element(c => ComposeInfoCard(
                c,
                "Metodoloji notu",
                "Bu rapor, platformda tutulan zaman damgalı çevresel kayıtları yönetim seviyesinde okunabilir bölümlere dönüştürür.",
                "Sosyal ve yönetişim derinliği; kullanıcı tarafından girilen notlar, seçilen standartlar ve hedef programı ile desteklenir."));
        });
    }

    private static void ComposeClosingSection(IContainer container, PdfReportModel report)
    {
        container.Column(column =>
        {
            column.Spacing(18);
            column.Item().Element(c => ComposeSectionHeading(c, "Sonuç ve Gelecek Hedefler", "Aktif hedefler, önerilen aksiyonlar ve yönetim kapanış notu"));

            column.Item().Element(c => ComposeGoalCard(c, report.Goals));

            column.Item().Row(row =>
            {
                row.Spacing(14);
                row.RelativeItem().Element(c => ComposeBulletCard(c, "Gelecek dönem hedefleri", report.FutureTargets, "#2f855a"));
                row.RelativeItem().Element(c => ComposeNarrativePanel(c, "Sonuç", report.Conclusion));
            });
        });
    }

    private static void ComposeSectionHeading(IContainer container, string title, string description)
    {
        container.Column(column =>
        {
            column.Spacing(4);
            column.Item().Text(title).FontSize(20).SemiBold();
            column.Item().Text(description).FontSize(10).FontColor("#6b7280");
        });
    }

    private static void ComposeNarrativePanel(IContainer container, string title, string body)
    {
        container.Border(1).BorderColor("#e5e7eb").Background("#f8faf8").Padding(18).Column(column =>
        {
            column.Spacing(8);
            column.Item().Text(title).FontSize(12).SemiBold();
            column.Item().Text(body).FontSize(10.5f).FontColor("#30463d");
        });
    }

    private static void ComposeInfoCard(IContainer container, string title, string value, string helper)
    {
        container.Border(1).BorderColor("#e5e7eb").Background("#f8faf8").Padding(18).Column(column =>
        {
            column.Spacing(6);
            column.Item().Text(title).FontSize(11).SemiBold();
            column.Item().Text(value).FontSize(12).FontColor("#173a2b");
            column.Item().Text(helper).FontSize(9).FontColor("#6b7280");
        });
    }

    private static void ComposeMetricCard(IContainer container, string title, string value, string unit, string accentColor)
    {
        container.Border(1).BorderColor("#e5e7eb").Background("#ffffff").Padding(16).Column(column =>
        {
            column.Spacing(8);
            column.Item().Text(title).FontSize(10).FontColor("#6b7280");
            column.Item().Text($"{value} {unit}".Trim()).FontSize(18).SemiBold().FontColor(accentColor);
            column.Item().Height(6).Background("#eef2ef").Element(c => ComposeFillBar(c, 100, accentColor));
        });
    }

    private static void ComposeFrameworkCard(IContainer container, ReportFrameworkDefinition framework)
    {
        container.Border(1).BorderColor("#d8e1da").Background("#ffffff").Padding(16).Column(column =>
        {
            column.Spacing(6);
            column.Item().Text(framework.Title).FontSize(12).SemiBold();
            column.Item().Text(framework.Lens).FontSize(10).FontColor("#30463d");
            column.Item().Text(framework.OutputNote).FontSize(9).FontColor("#6b7280");
        });
    }

    private static void ComposeTrendCard(IContainer container, string title, IReadOnlyList<ReportTrendPoint> points, string unit, string accentColor)
    {
        var maxValue = points.Count == 0 ? 0m : points.Max(point => point.Value);

        container.Border(1).BorderColor("#e5e7eb").Background("#ffffff").Padding(16).Column(column =>
        {
            column.Spacing(10);
            column.Item().Text(title).FontSize(12).SemiBold();

            if (points.All(point => point.Value <= 0))
            {
                column.Item().Text("Seçilen kapsamda grafik oluşturacak veri bulunamadı.").FontSize(9.5f).FontColor("#6b7280");
                return;
            }

            foreach (var point in points)
            {
                column.Item().Row(row =>
                {
                    row.Spacing(10);
                    row.ConstantItem(48).Text(point.Label).FontSize(9).FontColor("#6b7280");
                    row.RelativeItem().Height(10).Background("#eef2ef").Element(c => ComposeFillBar(c, ToPercentage(point.Value, maxValue), accentColor));
                    row.ConstantItem(72).AlignRight().Text($"{FormatMetric(point.Value)} {unit}").FontSize(9).FontColor("#30463d");
                });
            }
        });
    }

    private static void ComposeBreakdownCard(IContainer container, string title, IReadOnlyList<CategoryBreakdownDto> items, string accentColor)
    {
        container.Border(1).BorderColor("#e5e7eb").Background("#ffffff").Padding(16).Column(column =>
        {
            column.Spacing(10);
            column.Item().Text(title).FontSize(12).SemiBold();

            if (items.Count == 0)
            {
                column.Item().Text("Bu kırılım için kullanılabilir veri bulunamadı.").FontSize(9.5f).FontColor("#6b7280");
                return;
            }

            foreach (var item in items.Take(5))
            {
                column.Item().Column(entry =>
                {
                    entry.Spacing(4);
                    entry.Item().Row(row =>
                    {
                        row.Spacing(10);
                        row.RelativeItem().Text(item.Category).FontSize(9.5f);
                        row.ConstantItem(110).AlignRight().Text($"{FormatMetric(item.Value)} {item.Unit}").FontSize(9.5f).FontColor("#30463d");
                    });
                    entry.Item().Height(8).Background("#eef2ef").Element(c => ComposeFillBar(c, item.PercentageOfTotal, accentColor));
                    entry.Item().Text($"{item.PercentageOfTotal.ToString("N1", ReportCulture)}% pay").FontSize(8.5f).FontColor("#6b7280");
                });
            }
        });
    }

    private static void ComposeBulletCard(IContainer container, string title, IReadOnlyList<string> items, string accentColor)
    {
        container.Border(1).BorderColor("#e5e7eb").Background("#ffffff").Padding(18).Column(column =>
        {
            column.Spacing(10);
            column.Item().Text(title).FontSize(12).SemiBold();

            foreach (var item in items)
            {
                column.Item().Element(c => ComposeListItem(c, item, accentColor));
            }
        });
    }

    private static void ComposeGoalCard(IContainer container, IReadOnlyList<GoalProgressDto> goals)
    {
        container.Border(1).BorderColor("#e5e7eb").Background("#ffffff").Padding(18).Column(column =>
        {
            column.Spacing(12);
            column.Item().Text("Aktif hedef görünümü").FontSize(12).SemiBold();

            if (goals.Count == 0)
            {
                column.Item().Text("Aktif hedef tanımlı değil. Gelecek dönem hedef listesi bu boşluğu doldurmak için kullanılır.")
                    .FontSize(9.5f)
                    .FontColor("#6b7280");
                return;
            }

            foreach (var goal in goals)
            {
                var progress = Math.Clamp(goal.ProgressPercent, 0, 100);
                column.Item().Column(entry =>
                {
                    entry.Spacing(5);
                    entry.Item().Row(row =>
                    {
                        row.Spacing(10);
                        row.RelativeItem().Text(goal.Name).FontSize(10.5f).SemiBold();
                        row.ConstantItem(140).AlignRight().Text($"{FormatMetric(goal.CurrentValue)} / {FormatMetric(goal.TargetValue)} {goal.Unit}").FontSize(9.5f).FontColor("#30463d");
                    });
                    entry.Item().Height(8).Background("#eef2ef").Element(c => ComposeFillBar(c, progress, "#2f855a"));
                    entry.Item().Text($"Durum: {goal.Status} | İlerleme: {goal.ProgressPercent.ToString("N1", ReportCulture)}%").FontSize(8.5f).FontColor("#6b7280");
                });
            }
        });
    }

    private static void ComposeListItem(IContainer container, string text, string accentColor)
    {
        container.Row(row =>
        {
            row.Spacing(8);
            row.ConstantItem(10).PaddingTop(1).Text("•").FontColor(accentColor).FontSize(11);
            row.RelativeItem().Text(text).FontSize(9.8f).FontColor("#30463d");
        });
    }

    private static void ComposeFillBar(IContainer container, double percentage, string accentColor)
    {
        var clamped = Math.Clamp(percentage, 0, 100);
        var filled = (int)Math.Round(clamped);
        var empty = 100 - filled;

        container.Row(row =>
        {
            if (filled > 0)
            {
                row.RelativeItem(filled).Background(accentColor);
            }

            if (empty > 0)
            {
                row.RelativeItem(empty).Background("#eef2ef");
            }

            if (filled == 0 && empty == 0)
            {
                row.RelativeItem().Background("#eef2ef");
            }
        });
    }

    private static void ComposeLogo(IContainer container, byte[]? logoBytes)
    {
        container.Border(1).BorderColor("#cfd8d2").Background("#ffffff").Padding(10).AlignCenter().AlignMiddle().Element(inner =>
        {
            if (logoBytes is not null)
            {
                inner.Image(logoBytes).FitArea();
                return;
            }

            inner.Text("LOGO").FontSize(13).SemiBold().FontColor("#6b7280");
        });
    }

    private async Task<ExportData> GatherDataAsync(Guid companyId, ExportRequest req, CancellationToken ct)
    {
        var from = req.From ?? DateTime.MinValue;
        var to = req.To ?? DateTime.MaxValue;

        var energy = req.IncludeEnergy
            ? await _db.EnergyEntries.IgnoreQueryFilters()
                .Where(e => e.CompanyId == companyId && e.RecordedAt >= from && e.RecordedAt <= to)
                .OrderBy(e => e.RecordedAt)
                .ToListAsync(ct)
            : new List<Domain.Entities.EnergyEntry>();

        var water = req.IncludeWater
            ? await _db.WaterEntries.IgnoreQueryFilters()
                .Where(w => w.CompanyId == companyId && w.RecordedAt >= from && w.RecordedAt <= to)
                .OrderBy(w => w.RecordedAt)
                .ToListAsync(ct)
            : new List<Domain.Entities.WaterEntry>();

        var waste = req.IncludeWaste
            ? await _db.WasteEntries.IgnoreQueryFilters()
                .Where(w => w.CompanyId == companyId && w.RecordedAt >= from && w.RecordedAt <= to)
                .OrderBy(w => w.RecordedAt)
                .ToListAsync(ct)
            : new List<Domain.Entities.WasteEntry>();

        var carbon = req.IncludeCarbon
            ? await _db.CarbonInputs.IgnoreQueryFilters()
                .Where(c => c.CompanyId == companyId && c.RecordedAt >= from && c.RecordedAt <= to)
                .OrderBy(c => c.RecordedAt)
                .ToListAsync(ct)
            : new List<Domain.Entities.CarbonInput>();

        if (!string.IsNullOrWhiteSpace(req.Category))
        {
            var filter = req.Category.Trim();
            energy = energy.Where(entry => MatchesFilter(filter, entry.CategoryName, entry.Category.ToString(), entry.Notes)).ToList();
            water = water.Where(entry => MatchesFilter(filter, entry.CategoryName, entry.Category.ToString(), entry.Notes)).ToList();
            waste = waste.Where(entry => MatchesFilter(filter, entry.CategoryName, entry.Category.ToString(), entry.Notes)).ToList();
            carbon = carbon.Where(entry => MatchesFilter(filter, entry.Description, entry.Source.ToString(), entry.Notes)).ToList();
        }

        return new ExportData(energy, water, waste, carbon);
    }

    private static List<CategoryBreakdownDto> BuildBreakdown<T>(
        IEnumerable<T> items,
        Func<T, string> categorySelector,
        Func<T, decimal> valueSelector,
        string unit)
    {
        var groups = items
            .GroupBy(item => string.IsNullOrWhiteSpace(categorySelector(item)) ? "Diğer" : categorySelector(item))
            .Select(group => new { Category = group.Key, Value = group.Sum(valueSelector) })
            .OrderByDescending(group => group.Value)
            .ToList();

        var total = groups.Sum(group => group.Value);
        return groups
            .Select(group => new CategoryBreakdownDto(
                group.Category,
                group.Value,
                unit,
                total <= 0 ? 0 : (double)(group.Value / total * 100m)))
            .ToList();
    }

    private static List<ReportTrendPoint> BuildMonthlyTrendSeries<T>(
        IEnumerable<T> items,
        DateTime? reportEnd,
        int monthCount,
        Func<T, DateTime> dateSelector,
        Func<T, decimal> valueSelector)
    {
        var end = reportEnd ?? DateTime.UtcNow;
        var endMonth = new DateTime(end.Year, end.Month, 1);
        var points = new List<ReportTrendPoint>();

        for (var i = monthCount - 1; i >= 0; i--)
        {
            var monthStart = endMonth.AddMonths(-i);
            var monthEnd = monthStart.AddMonths(1);
            var total = items
                .Where(item => dateSelector(item) >= monthStart && dateSelector(item) < monthEnd)
                .Sum(valueSelector);

            points.Add(new ReportTrendPoint(monthStart.ToString("MMM yy", ReportCulture), total));
        }

        return points;
    }

    private static DateTime? GetEarliestRecordDate(ExportData data)
    {
        var candidates = new List<DateTime>();

        if (data.EnergyEntries.Count > 0) candidates.Add(data.EnergyEntries.Min(x => x.RecordedAt));
        if (data.WaterEntries.Count > 0) candidates.Add(data.WaterEntries.Min(x => x.RecordedAt));
        if (data.WasteEntries.Count > 0) candidates.Add(data.WasteEntries.Min(x => x.RecordedAt));
        if (data.CarbonInputs.Count > 0) candidates.Add(data.CarbonInputs.Min(x => x.RecordedAt));

        return candidates.Count == 0 ? null : candidates.Min();
    }

    private static string BuildPeriodLabel(DateTime? from, DateTime? to, DateTime reportDate)
    {
        var start = from.HasValue ? from.Value.ToString("dd MMM yyyy", ReportCulture) : "Tüm kayıtlar";
        var end = (to ?? reportDate).ToString("dd MMM yyyy", ReportCulture);
        return $"{start} - {end}";
    }

    private static int CountIncludedModules(ExportRequest request)
        => new[] { request.IncludeEnergy, request.IncludeWater, request.IncludeWaste, request.IncludeCarbon }.Count(x => x);

    private static string BuildDefaultExecutiveSummary(
        ConsumptionSummaryDto summary,
        int frameworkCount,
        IReadOnlyList<string> environmentalHighlights)
    {
        var lead = environmentalHighlights.FirstOrDefault() ?? "Çevresel veriler raporun ana omurgasını oluşturuyor.";
        return $"Bu rapor, seçilen dönemde {summary.RecordCount.ToString("N0", ReportCulture)} ESG kaydını kapsar ve {frameworkCount.ToString(ReportCulture)} farklı raporlama çerçevesine uyumlu bir yönetim akışı sunar. {lead}";
    }

    private static List<string> BuildEnvironmentalHighlights(
        ConsumptionSummaryDto summary,
        IReadOnlyList<CategoryBreakdownDto> energyBreakdown,
        IReadOnlyList<CategoryBreakdownDto> wasteBreakdown,
        IReadOnlyList<CategoryBreakdownDto> carbonBreakdown,
        decimal recyclingRate)
    {
        var items = new List<string>
        {
            $"Toplam çevresel kayıt hacmi {summary.RecordCount.ToString("N0", ReportCulture)} satır olup enerji, su, atık ve karbon modüllerini kapsar."
        };

        if (energyBreakdown.FirstOrDefault() is { } topEnergy)
        {
            items.Add($"En yüksek enerji kategorisi {topEnergy.Category} olup toplam enerji tüketiminin %{topEnergy.PercentageOfTotal.ToString("N1", ReportCulture)}'ini temsil eder.");
        }

        if (carbonBreakdown.FirstOrDefault() is { } topCarbon)
        {
            items.Add($"Karbon ayak izinin ana kaynağı {topCarbon.Category} ve toplam emisyon içindeki payı %{topCarbon.PercentageOfTotal.ToString("N1", ReportCulture)} seviyesindedir.");
        }

        if (wasteBreakdown.Count > 0)
        {
            items.Add($"Atık akışında geri dönüştürülebilir malzeme oranı yaklaşık %{recyclingRate.ToString("N1", ReportCulture)} olarak hesaplanmıştır.");
        }

        if (summary.TotalWaterLiters > 0)
        {
            items.Add($"Su tüketimi toplam {FormatMetric(summary.TotalWaterLiters)} litre seviyesindedir ve operasyonel verimlilik açısından ayrı izlenmelidir.");
        }

        return items;
    }

    private static List<string> BuildNarrativeList(string? input, params string[] fallbacks)
    {
        var lines = SplitLines(input);
        return lines.Count > 0 ? lines : fallbacks.ToList();
    }

    private static List<string> BuildFutureTargets(string? input, IReadOnlyList<GoalProgressDto> goals)
    {
        var lines = SplitLines(input);
        if (lines.Count > 0)
        {
            return lines;
        }

        if (goals.Count > 0)
        {
            return goals.Take(3)
                .Select(goal => $"{goal.Name}: {FormatMetric(goal.CurrentValue)} / {FormatMetric(goal.TargetValue)} {goal.Unit} seviyesinden hedefe ilerle.")
                .ToList();
        }

        return new List<string>
        {
            "Enerji ve karbon verimliliği için ölçülebilir dönemsel hedefler tanımla.",
            "Sosyal ve yönetişim alanında veri toplama kapsamını genişlet.",
            "Seçilen raporlama standardı için düzenli yönetim gözden geçirme döngüsü kur."
        };
    }

    private static string BuildDefaultConclusion(ConsumptionSummaryDto summary, IReadOnlyList<GoalProgressDto> goals, int frameworkCount)
    {
        var goalNote = goals.Count > 0
            ? $"{goals.Count} aktif hedef rapora entegre edildi."
            : "Aktif hedef seti henüz sınırlı olduğu için gelecek dönem hedef planı önem kazanıyor.";

        return $"Rapor, {frameworkCount} çerçeve seçimiyle yönetim seviyesinde okunabilir bir ESG paketi sunuyor. Toplam karbon yükü {FormatMetric(summary.TotalCO2eKg)} kgCO2e seviyesinde olup enerji ve süreç verimliliği öncelikli aksiyon alanları olarak öne çıkıyor. {goalNote}";
    }

    private static List<ReportFrameworkDefinition> BuildFrameworkDefinitions(List<string>? requestedFrameworks)
    {
        var selected = requestedFrameworks is { Count: > 0 }
            ? requestedFrameworks
            : new List<string> { "ISSB", "GRI", "SASB", "TCFD", "CDP", "IR", "ESRS" };

        return selected
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(key => key.ToUpperInvariant() switch
            {
                "ISSB" => new ReportFrameworkDefinition("ISSB", "ISSB / IFRS S1-S2", "Genel sürdürülebilirlik açıklamaları ve iklim odaklı çekirdek yapı", "Kapak, yönetici özeti, iklim metrikleri ve yönetişim anlatısı bu çerçeveye hizmet eder."),
                "GRI" => new ReportFrameworkDefinition("GRI", "Global Reporting Initiative", "Etki odaklı paydaş anlatısı", "Çevresel toplamlar ve sosyal-yönetişim notları, etki perspektifinde sunulur."),
                "SASB" => new ReportFrameworkDefinition("SASB", "Sustainability Accounting Standards Board", "Finansal önemlilik ve sektörel risk görünümü", "Karbon, enerji ve kaynak kullanımı finansal risk diliyle okunabilir hale getirilir."),
                "TCFD" => new ReportFrameworkDefinition("TCFD", "Task Force on Climate-related Financial Disclosures", "İklim riski, gözetim ve strateji odaklı yapı", "Karbon trendleri, yönetişim notları ve yönetim aksiyonları TCFD bakışını destekler."),
                "CDP" => new ReportFrameworkDefinition("CDP", "Carbon Disclosure Project", "Karbon ve su disclosure hazırlığı", "Karbon kaynak kırılımı ve su trendleri CDP hazırlık mantığında özetlenir."),
                "IR" => new ReportFrameworkDefinition("IR", "Integrated Reporting", "Finansal ve sürdürülebilirlik hikayesinin birleşik akışı", "Yönetici özeti, hedefler ve sonuç bölümü tek bir kurumsal anlatı kurar."),
                "ESRS" => new ReportFrameworkDefinition("ESRS", "European Sustainability Reporting Standards", "AB uyumlu çift önemlilik yaklaşımı", "Çevresel veri omurgası ile sosyal-yönetişim anlatısı aynı rapor içinde eşlenir."),
                _ => new ReportFrameworkDefinition(key.ToUpperInvariant(), key.ToUpperInvariant(), "Özel çerçeve seçimi", "Bu çerçeve için özel anlatı kullanıcı tarafından sağlanan notlarla desteklenir.")
            })
            .ToList();
    }

    private static bool MatchesFilter(string filter, params string?[] values)
        => values.Any(value => !string.IsNullOrWhiteSpace(value) && value.Contains(filter, StringComparison.OrdinalIgnoreCase));

    private static List<string> SplitLines(string? text)
        => string.IsNullOrWhiteSpace(text)
            ? new List<string>()
            : text
                .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                .Select(line => line.Trim().TrimStart('-', '*', '•').Trim())
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .ToList();

    private static string FormatMetric(decimal value) => value.ToString("N1", ReportCulture);

    private static double ToPercentage(decimal value, decimal max)
        => max <= 0 ? 0 : (double)(value / max * 100m);

    private static byte[]? TryDecodeImage(string? dataUrl)
    {
        if (string.IsNullOrWhiteSpace(dataUrl))
        {
            return null;
        }

        try
        {
            var markerIndex = dataUrl.IndexOf("base64,", StringComparison.OrdinalIgnoreCase);
            var base64 = markerIndex >= 0 ? dataUrl[(markerIndex + "base64,".Length)..] : dataUrl;
            return Convert.FromBase64String(base64);
        }
        catch
        {
            return null;
        }
    }

    private record ExportData(
        List<Domain.Entities.EnergyEntry> EnergyEntries,
        List<Domain.Entities.WaterEntry> WaterEntries,
        List<Domain.Entities.WasteEntry> WasteEntries,
        List<Domain.Entities.CarbonInput> CarbonInputs);

    private sealed record ReportFrameworkDefinition(string Key, string Title, string Lens, string OutputNote);

    private sealed record ReportTrendPoint(string Label, decimal Value);

    private sealed record PdfReportModel(
        string CompanyName,
        string ReportTitle,
        string CoverTagline,
        string PreparedBy,
        DateTime ReportDate,
        string PeriodLabel,
        int IncludedModuleCount,
        byte[]? LogoBytes,
        ConsumptionSummaryDto Summary,
        List<ReportFrameworkDefinition> Frameworks,
        List<GoalProgressDto> Goals,
        List<ReportTrendPoint> EnergyTrend,
        List<ReportTrendPoint> WaterTrend,
        List<ReportTrendPoint> WasteTrend,
        List<ReportTrendPoint> CarbonTrend,
        List<CategoryBreakdownDto> EnergyBreakdown,
        List<CategoryBreakdownDto> WasteBreakdown,
        List<CategoryBreakdownDto> CarbonBreakdown,
        string ExecutiveSummary,
        List<string> EnvironmentalHighlights,
        List<string> SocialHighlights,
        List<string> GovernanceHighlights,
        List<string> FutureTargets,
        string Conclusion,
        decimal RecyclingRate);
}
