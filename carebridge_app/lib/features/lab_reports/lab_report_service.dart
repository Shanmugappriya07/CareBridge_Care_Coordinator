import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/constants/app_constants.dart';
import '../admissions/admission_model.dart';
import '../admissions/admission_service.dart';
import 'lab_report_model.dart';

class LabReportService {
  static Future<List<LabReport>> reportsForAdmission(
          String admissionId, String caregiverMobile) =>
      AdmissionService.getLabReports(admissionId, caregiverMobile);

  /// Resolves a potentially relative file URL (e.g. `/uploads/123_report.pdf`)
  /// to an absolute URL using the backend origin from [AppConstants.apiBaseUrl].
  static String resolveFileUrl(String fileUrl) {
    final trimmed = fileUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final baseUri = Uri.parse(AppConstants.apiBaseUrl);
    final origin =
        '${baseUri.scheme}://${baseUri.host}${baseUri.hasPort ? ':${baseUri.port}' : ''}';
    final normalized = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$origin$normalized';
  }

  /// Downloads the real uploaded file for [report] and opens it with the device native viewer.
  /// Returns an error message string on failure, or null on success.
  static Future<String?> downloadReport(
      BuildContext context, LabReport report, Admission admission) async {
    try {
      if (!report.hasFile) {
        return 'No uploaded file is available for this lab report.';
      }

      final rawUrl = report.fileUrl!.trim();
      List<int> bytes;

      if (rawUrl.startsWith('data:')) {
        // Base64 data URL
        final commaIdx = rawUrl.indexOf(',');
        final base64Str =
            commaIdx >= 0 ? rawUrl.substring(commaIdx + 1) : rawUrl;
        bytes = base64Decode(base64Str);
      } else {
        final resolvedUrl = resolveFileUrl(rawUrl);
        final response = await http
            .get(Uri.parse(resolvedUrl))
            .timeout(const Duration(seconds: 30));
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return 'Failed to download report from server (HTTP ${response.statusCode}).';
        }
        bytes = response.bodyBytes;
      }

      if (bytes.isEmpty) {
        return 'The downloaded file was empty.';
      }

      // Determine disk filename
      String targetName = (report.fileName ?? '').trim();
      if (targetName.isEmpty) {
        final uriPath = Uri.tryParse(rawUrl)?.path ?? rawUrl;
        final lastSegment = uriPath.split('/').last.split('\\').last;
        if (lastSegment.contains('.')) {
          targetName = lastSegment;
        }
      }
      if (targetName.isEmpty) {
        targetName =
            '${report.title.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}.pdf';
      }

      final cleanDiskFileName =
          targetName.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');

      final Directory dir = Platform.isAndroid
          ? (await getExternalStorageDirectory() ??
              await getApplicationDocumentsDirectory())
          : await getApplicationDocumentsDirectory();

      final file = File('${dir.path}/$cleanDiskFileName');
      await file.writeAsBytes(bytes, flush: true);

      final result = await OpenFilex.open(file.path);
      if (result.type != ResultType.done) {
        return 'Could not open file: ${result.message}';
      }
      return null;
    } catch (e) {
      return 'Failed to open uploaded report: $e';
    }
  }
}
