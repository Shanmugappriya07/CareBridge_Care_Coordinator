import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/constants/app_constants.dart';
import '../admissions/admission_model.dart';
import '../admissions/admission_service.dart';
import 'lab_report_model.dart';

class LabReportService {
  static Future<List<LabReport>> reportsForAdmission(
          String admissionId, String caregiverMobile) =>
      AdmissionService.getLabReports(admissionId, caregiverMobile);

  /// Generates a PDF for [report] and opens it with the device viewer.
  /// Returns an error message string on failure, or null on success.
  static Future<String?> downloadReport(
      BuildContext context, LabReport report, Admission admission) async {
    try {
      final pdf = pw.Document();
      final dateStr =
          DateFormat('dd MMM yyyy, hh:mm a').format(report.reportDate);

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          build: (pw.Context ctx) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Header
                pw.Container(
                  padding: const pw.EdgeInsets.all(16),
                  decoration: pw.BoxDecoration(
                    color: PdfColor.fromHex('#0D6EFD'),
                    borderRadius: pw.BorderRadius.circular(8),
                  ),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            AppConstants.appName,
                            style: pw.TextStyle(
                              fontSize: 22,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColors.white,
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          pw.Text(
                            admission.hospitalName,
                            style: const pw.TextStyle(
                              fontSize: 11,
                              color: PdfColors.white,
                            ),
                          ),
                        ],
                      ),
                      pw.Text(
                        'LAB REPORT',
                        style: pw.TextStyle(
                          fontSize: 14,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.white,
                        ),
                      ),
                    ],
                  ),
                ),

                pw.SizedBox(height: 20),

                // Patient & Report Info
                pw.Container(
                  padding: const pw.EdgeInsets.all(12),
                  decoration: pw.BoxDecoration(
                    color: PdfColor.fromHex('#F8FAFC'),
                    border: pw.Border.all(
                        color: PdfColor.fromHex('#E2E8F0'), width: 1),
                    borderRadius: pw.BorderRadius.circular(6),
                  ),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          _infoRow('Patient', admission.patientName),
                          _infoRow('Patient ID', admission.patientId),
                          _infoRow('Age / Gender',
                              '${admission.patientAge ?? 'N/A'} / ${admission.gender}'),
                          _infoRow('Ward', admission.roomWard),
                        ],
                      ),
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          _infoRow('Ref No.', report.refNumber),
                          _infoRow('Report Date', dateStr),
                          _infoRow('Department', report.department),
                          _infoRow('Status', report.status),
                        ],
                      ),
                    ],
                  ),
                ),

                pw.SizedBox(height: 20),

                // Report title
                pw.Text(
                  report.title,
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Divider(color: PdfColor.fromHex('#0D6EFD'), thickness: 1.5),
                pw.SizedBox(height: 10),

                // Parameters table
                if (report.parameters.isNotEmpty) ...[
                  pw.Table(
                    border: pw.TableBorder.all(
                      color: PdfColor.fromHex('#E2E8F0'),
                      width: 0.5,
                    ),
                    children: [
                      pw.TableRow(
                        decoration: pw.BoxDecoration(
                            color: PdfColor.fromHex('#EFF6FF')),
                        children: [
                          _tableCell('Parameter', isHeader: true),
                          _tableCell('Result', isHeader: true),
                        ],
                      ),
                      ...report.parameters.entries.map(
                        (e) => pw.TableRow(
                          children: [
                            _tableCell(e.key),
                            _tableCell(e.value.toString()),
                          ],
                        ),
                      ),
                    ],
                  ),
                  pw.SizedBox(height: 16),
                ],

                // Notes
                if (report.notes != null && report.notes!.isNotEmpty) ...[
                  pw.Text(
                    'Clinical Notes',
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 6),
                  pw.Container(
                    padding: const pw.EdgeInsets.all(10),
                    decoration: pw.BoxDecoration(
                      color: PdfColor.fromHex('#FFFBEB'),
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Text(report.notes!,
                        style: const pw.TextStyle(fontSize: 11)),
                  ),
                ],

                pw.Spacer(),

                // Footer
                pw.Divider(color: PdfColor.fromHex('#E2E8F0')),
                pw.Text(
                  'Generated by CareBridge on ${DateFormat('dd MMM yyyy').format(DateTime.now())} '
                  '• ${admission.hospitalName}',
                  style: const pw.TextStyle(
                    fontSize: 9,
                    color: PdfColors.grey600,
                  ),
                ),
              ],
            );
          },
        ),
      );

      // Save to device Downloads / temp directory
      final Directory dir = Platform.isAndroid
          ? (await getExternalStorageDirectory() ??
              await getApplicationDocumentsDirectory())
          : await getApplicationDocumentsDirectory();

      final fileName =
          '${report.refNumber.replaceAll('-', '_')}_${DateFormat('yyyyMMdd').format(report.reportDate)}.pdf';
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes(await pdf.save());

      // Open with device PDF viewer
      final result = await OpenFilex.open(file.path);
      if (result.type != ResultType.done) {
        return 'Could not open PDF: ${result.message}';
      }
      return null;
    } catch (e) {
      return 'Download failed: $e';
    }
  }

  // PDF helper widgets
  static pw.Widget _infoRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.RichText(
        text: pw.TextSpan(
          children: [
            pw.TextSpan(
              text: '$label: ',
              style: pw.TextStyle(
                  fontSize: 10,
                  fontWeight: pw.FontWeight.bold,
                  color: PdfColors.grey700),
            ),
            pw.TextSpan(
              text: value,
              style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey900),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _tableCell(String text, {bool isHeader = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 10,
          fontWeight: isHeader ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: isHeader ? PdfColor.fromHex('#0D6EFD') : PdfColors.black,
        ),
      ),
    );
  }
}
