import 'dart:convert';

import 'package:carebridge_app/features/lab_reports/lab_report_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('decodes a lab report from an admission test record', () {
    final report = LabReport.fromRecord({
      'id': 31,
      'resourceType': 'tests',
      'payload': jsonEncode({
        'reportId': 'LAB-31',
        'admissionId': 'ADM-31',
        'patientId': 'PAT-31',
        'title': 'Complete Blood Count',
        'department': 'Pathology',
        'refNumber': 'LAB-31',
        'reportDate': '2026-09-29T10:30:00Z',
        'status': 'Normal',
        'notes': 'No abnormal findings',
        'parameters': {'Result / Reference Notes': 'Hemoglobin 13.8 g/dL'},
      }),
    });

    expect(report.admissionId, 'ADM-31');
    expect(report.patientId, 'PAT-31');
    expect(report.title, 'Complete Blood Count');
    expect(report.department, 'Pathology');
    expect(report.refNumber, 'LAB-31');
    expect(report.reportDate, DateTime.utc(2026, 9, 29, 10, 30));
    expect(report.status, 'Normal');
    expect(report.notes, 'No abnormal findings');
    expect(
        report.parameters['Result / Reference Notes'], 'Hemoglobin 13.8 g/dL');
  });

  test('decodes a scan report from an admission scan record', () {
    final report = LabReport.fromRecord({
      'id': 32,
      'resourceType': 'scans',
      'payload': jsonEncode({
        'reportId': 'SCAN-32',
        'admissionId': 'ADM-32',
        'patientId': 'PAT-32',
        'title': 'CT Scan Thorax (Contrast)',
        'department': 'Radiology',
        'refNumber': 'SCAN-32',
        'reportDate': '2026-09-29T11:00:00Z',
        'status': 'Completed',
        'notes': 'No acute findings',
        'parameters': {'Result': 'No acute findings'},
      }),
    });

    expect(report.admissionId, 'ADM-32');
    expect(report.title, 'CT Scan Thorax (Contrast)');
    expect(report.department, 'Radiology');
    expect(report.refNumber, 'SCAN-32');
    expect(report.reportDate, DateTime.utc(2026, 9, 29, 11));
    expect(report.status, 'Completed');
    expect(report.notes, 'No acute findings');
    expect(report.parameters['Result'], 'No acute findings');
  });
}
