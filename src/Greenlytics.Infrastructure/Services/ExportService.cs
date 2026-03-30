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
    private readonly IApplicationDbContext _db;
    private readonly IAggregationService _aggregation;

    public ExportService(IApplicationDbContext db, IAggregationService aggregation)
    {
        _db = db;
        _aggregation = aggregation;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    // ── PDF Export ────────────────────────────────────────────────────────
    public async Task<byte[]> ExportToPdfAsync(Guid companyId, ExportRequest request, CancellationToken ct = default)
    {
        var company = await _db.Companies.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == companyId, ct)
            ?? throw new KeyNotFoundException("Company not found.");
        var data = await GatherDataAsync(companyId, request, ct);
        var summary = await _aggregation.GetSummaryAsync(companyId, request.From, request.To, ct);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text($"{company.Name}").FontSize(20).SemiBold().FontColor("#22c55e");
                        row.ConstantItem(200).AlignRight().Text($"Sustainability Report").FontSize(14).FontColor("#6b7280");
                    });
                    col.Item().Text($"Period: {request.From?.ToString("yyyy-MM-dd") ?? "All time"} – {request.To?.ToString("yyyy-MM-dd") ?? "Today"}").FontSize(9).FontColor("#9ca3af");
                    col.Item().PaddingTop(5).LineHorizontal(1).LineColor("#e5e7eb");
                });

                page.Content().Column(col =>
                {
                    // Summary Cards
                    col.Item().PaddingTop(15).Text("Summary").FontSize(14).SemiBold();
                    col.Item().PaddingTop(8).Table(table =>
                    {
                        table.ColumnsDefinition(cols => { cols.RelativeColumn(); cols.RelativeColumn(); cols.RelativeColumn(); cols.RelativeColumn(); });
                        table.Header(header =>
                        {
                            foreach (var h in new[] { "Energy (kWh)", "Water (L)", "Waste (kg)", "Carbon (kgCO2e)" })
                                header.Cell().Background("#f3f4f6").Padding(8).Text(h).FontSize(9).FontColor("#374151");
                        });
                        table.Cell().Padding(8).Text(summary.TotalEnergyKWh.ToString("N2")).SemiBold();
                        table.Cell().Padding(8).Text(summary.TotalWaterLiters.ToString("N2")).SemiBold();
                        table.Cell().Padding(8).Text(summary.TotalWasteKg.ToString("N2")).SemiBold();
                        table.Cell().Padding(8).Text(summary.TotalCO2eKg.ToString("N2")).SemiBold();
                    });

                    // Energy Table
                    if (request.IncludeEnergy && data.EnergyEntries.Any())
                    {
                        col.Item().PaddingTop(20).Text("Energy Consumption").FontSize(13).SemiBold();
                        col.Item().PaddingTop(5).Table(table =>
                        {
                            table.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(3); });
                            table.Header(h =>
                            {
                                foreach (var hd in new[] { "Date", "Category", "kWh", "Notes" })
                                    h.Cell().Background("#f0fdf4").Padding(6).Text(hd).FontSize(9).SemiBold().FontColor("#166534");
                            });
                            foreach (var e in data.EnergyEntries)
                            {
                                table.Cell().Padding(5).Text(e.RecordedAt.ToString("yyyy-MM-dd"));
                                table.Cell().Padding(5).Text(e.CategoryName ?? e.Category.ToString());
                                table.Cell().Padding(5).Text(e.KWh.ToString("N2"));
                                table.Cell().Padding(5).Text(e.Notes ?? "-").FontSize(9).FontColor("#6b7280");
                            }
                        });
                    }

                    // Water Table
                    if (request.IncludeWater && data.WaterEntries.Any())
                    {
                        col.Item().PaddingTop(20).Text("Water Consumption").FontSize(13).SemiBold();
                        col.Item().PaddingTop(5).Table(table =>
                        {
                            table.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(3); });
                            table.Header(h =>
                            {
                                foreach (var hd in new[] { "Date", "Category", "Liters", "Notes" })
                                    h.Cell().Background("#eff6ff").Padding(6).Text(hd).FontSize(9).SemiBold().FontColor("#1e40af");
                            });
                            foreach (var w in data.WaterEntries)
                            {
                                table.Cell().Padding(5).Text(w.RecordedAt.ToString("yyyy-MM-dd"));
                                table.Cell().Padding(5).Text(w.CategoryName ?? w.Category.ToString());
                                table.Cell().Padding(5).Text(w.Liters.ToString("N2"));
                                table.Cell().Padding(5).Text(w.Notes ?? "-").FontSize(9).FontColor("#6b7280");
                            }
                        });
                    }

                    // Carbon Table
                    if (request.IncludeCarbon && data.CarbonInputs.Any())
                    {
                        col.Item().PaddingTop(20).Text("Carbon Emissions").FontSize(13).SemiBold();
                        col.Item().PaddingTop(5).Table(table =>
                        {
                            table.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });
                            table.Header(h =>
                            {
                                foreach (var hd in new[] { "Date", "Source", "Value", "CO2e (kg)" })
                                    h.Cell().Background("#fefce8").Padding(6).Text(hd).FontSize(9).SemiBold().FontColor("#854d0e");
                            });
                            foreach (var c in data.CarbonInputs)
                            {
                                table.Cell().Padding(5).Text(c.RecordedAt.ToString("yyyy-MM-dd"));
                                table.Cell().Padding(5).Text(c.Source.ToString());
                                table.Cell().Padding(5).Text($"{c.Value:N2} {c.Unit}");
                                table.Cell().Padding(5).Text(c.CO2eKg.ToString("N4"));
                            }
                        });
                    }
                });

                page.Footer().AlignCenter().Text(txt =>
                {
                    txt.Span("Generated by Greenlytics – ").FontSize(8).FontColor("#9ca3af");
                    txt.Span(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm")).FontSize(8).FontColor("#9ca3af");
                    txt.Span(" | Page ").FontSize(8).FontColor("#9ca3af");
                    txt.CurrentPageNumber().FontSize(8);
                    txt.Span(" of ").FontSize(8).FontColor("#9ca3af");
                    txt.TotalPages().FontSize(8);
                });
            });
        }).GeneratePdf();
    }

    // ── Excel Export ────────────────────────────────────────────────────────
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

    // ── CSV Export ────────────────────────────────────────────────────────
    public async Task<byte[]> ExportToCsvAsync(Guid companyId, ExportRequest request, CancellationToken ct = default)
    {
        var data = await GatherDataAsync(companyId, request, ct);
        using var ms = new MemoryStream();
        using var writer = new System.IO.StreamWriter(ms, leaveOpen: true);
        using var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture));

        // Write energy to CSV (combined flat format)
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

    // ── Data Gathering ────────────────────────────────────────────────────
    private async Task<ExportData> GatherDataAsync(Guid companyId, ExportRequest req, CancellationToken ct)
    {
        var from = req.From ?? DateTime.MinValue;
        var to   = req.To   ?? DateTime.MaxValue;

        var energy = req.IncludeEnergy
            ? await _db.EnergyEntries.IgnoreQueryFilters()
                .Where(e => e.CompanyId == companyId && e.RecordedAt >= from && e.RecordedAt <= to)
                .OrderBy(e => e.RecordedAt).ToListAsync(ct)
            : new();

        var water = req.IncludeWater
            ? await _db.WaterEntries.IgnoreQueryFilters()
                .Where(w => w.CompanyId == companyId && w.RecordedAt >= from && w.RecordedAt <= to)
                .OrderBy(w => w.RecordedAt).ToListAsync(ct)
            : new();

        var waste = req.IncludeWaste
            ? await _db.WasteEntries.IgnoreQueryFilters()
                .Where(w => w.CompanyId == companyId && w.RecordedAt >= from && w.RecordedAt <= to)
                .OrderBy(w => w.RecordedAt).ToListAsync(ct)
            : new();

        var carbon = req.IncludeCarbon
            ? await _db.CarbonInputs.IgnoreQueryFilters()
                .Where(c => c.CompanyId == companyId && c.RecordedAt >= from && c.RecordedAt <= to)
                .OrderBy(c => c.RecordedAt).ToListAsync(ct)
            : new();

        return new ExportData(energy, water, waste, carbon);
    }

    private record ExportData(
        List<Domain.Entities.EnergyEntry> EnergyEntries,
        List<Domain.Entities.WaterEntry> WaterEntries,
        List<Domain.Entities.WasteEntry> WasteEntries,
        List<Domain.Entities.CarbonInput> CarbonInputs);
}
