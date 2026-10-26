import 'dart:convert';

class LabReport {
  final String id;
  final String admissionId;
  final String title;
  final String department;
  final String refNumber;
  final DateTime reportDate;
  final String status; // 'Normal' | 'Elevated' | 'Critical' | 'Completed'
  final String patientId;
  final String? notes;
  final Map<String, dynamic>
      parameters; // e.g. {'Hemoglobin': '13.2 g/dL', ...}
  final String? fileUrl;
  final String? fileName;

  const LabReport({
    required this.id,
    required this.admissionId,
    required this.title,
    required this.department,
    required this.refNumber,
    required this.reportDate,
    required this.status,
    required this.patientId,
    this.notes,
    this.parameters = const {},
    this.fileUrl,
    this.fileName,
  });

  bool get hasFile => fileUrl != null && fileUrl!.trim().isNotEmpty;

  factory LabReport.fromRecord(Map<String, dynamic> record) {
    final rawPayload = record['payload'];
    final Map<String, dynamic> data;
    if (rawPayload is String) {
      final decoded = jsonDecode(rawPayload);
      if (decoded is! Map) {
        throw const FormatException(
            'Lab report payload must be a JSON object.');
      }
      data = Map<String, dynamic>.from(decoded);
    } else if (rawPayload is Map) {
      data = Map<String, dynamic>.from(rawPayload);
    } else {
      throw const FormatException('Lab report payload is missing.');
    }

    final String? resolvedFileUrl = (data['fileUrl'] ??
            data['file_url'] ??
            record['fileUrl'] ??
            record['file_url'])
        ?.toString();

    final String? resolvedFileName = (data['fileName'] ??
            data['file_name'] ??
            record['fileName'] ??
            record['file_name'])
        ?.toString();

    return LabReport(
      id: data['reportId'] as String? ?? record['id']?.toString() ?? '',
      admissionId: data['admissionId'] as String? ?? '',
      title: data['title'] as String? ?? '',
      department:
          data['department'] as String? ?? data['testType'] as String? ?? '',
      refNumber:
          data['refNumber'] as String? ?? data['reportId'] as String? ?? '',
      reportDate: DateTime.tryParse(data['reportDate'] as String? ?? '') ??
          DateTime.tryParse(data['report_date'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      status: data['status'] as String? ?? 'Completed',
      patientId: data['patientId'] as String? ?? '',
      notes: data['notes'] as String?,
      parameters: Map<String, dynamic>.from(data['parameters'] as Map? ?? {}),
      fileUrl: resolvedFileUrl,
      fileName: resolvedFileName,
    );
  }
}
