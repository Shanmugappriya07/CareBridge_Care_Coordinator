import 'dart:convert';

import 'package:carebridge_app/features/treatment_timeline/schedule_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('decodes a schedule from an admission record response', () {
    final schedule = ScheduleEvent.fromRecord({
      'id': 42,
      'resourceType': 'schedule',
      'payload': jsonEncode({
        'admissionId': 'ADM-42',
        'patientId': 'PAT-42',
        'doctor': 'Dr. Rao',
        'department': 'Cardiology',
        'eventDate': '2026-10-02',
        'appointmentTime': '09:30',
        'appointmentType': 'Cardiology review',
        'room': 'Clinic 4',
        'status': 'SCHEDULED',
      }),
    });

    expect(schedule.recordId, '42');
    expect(schedule.admissionId, 'ADM-42');
    expect(schedule.patientId, 'PAT-42');
    expect(schedule.doctor, 'Dr. Rao');
    expect(schedule.department, 'Cardiology');
    expect(schedule.eventDate, DateTime(2026, 10, 2));
    expect(schedule.appointmentTime, '09:30');
    expect(schedule.appointmentType, 'Cardiology review');
    expect(schedule.room, 'Clinic 4');
    expect(schedule.status, 'SCHEDULED');
  });
}