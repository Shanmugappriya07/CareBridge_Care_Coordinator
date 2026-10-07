import 'dart:convert';

import 'package:carebridge_app/features/prescriptions/prescription_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('decodes prescription data from an admission record', () {
    final prescription = Prescription.fromRecord({
      'id': 17,
      'resourceType': 'prescriptions',
      'payload': jsonEncode({
        'prescriptionId': 'RX-17',
        'admissionId': 'ADM-17',
        'patientId': 'PAT-17',
        'medicineName': 'Amoxicillin 500mg Capsule',
        'dosage': '500 mg',
        'frequency': 'Twice daily',
        'duration': '7 days',
        'intake': 'Oral after food',
        'instructions': 'Complete the full course',
        'prescriptionDate': '2026-09-29',
        'doctor': 'Dr. Rao',
      }),
    });

    expect(prescription.recordId, '17');
    expect(prescription.prescriptionId, 'RX-17');
    expect(prescription.admissionId, 'ADM-17');
    expect(prescription.patientId, 'PAT-17');
    expect(prescription.name, 'Amoxicillin 500mg Capsule');
    expect(prescription.dosage, '500 mg');
    expect(prescription.frequency, 'Twice daily');
    expect(prescription.duration, '7 days');
    expect(prescription.intake, 'Oral after food');
    expect(prescription.instructions, 'Complete the full course');
    expect(prescription.prescriptionDate, DateTime(2026, 9, 29));
    expect(prescription.doctor, 'Dr. Rao');
  });
}
