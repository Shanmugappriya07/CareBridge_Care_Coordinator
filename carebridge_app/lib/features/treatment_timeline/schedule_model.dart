import 'dart:convert';

class ScheduleEvent {
  final String recordId;
  final String admissionId;
  final String patientId;
  final String doctor;
  final String department;
  final DateTime eventDate;
  final String appointmentTime;
  final String appointmentType;
  final String room;
  final String status;

  const ScheduleEvent({
    required this.recordId,
    required this.admissionId,
    required this.patientId,
    required this.doctor,
    required this.department,
    required this.eventDate,
    required this.appointmentTime,
    required this.appointmentType,
    required this.room,
    required this.status,
  });

  factory ScheduleEvent.fromRecord(Map<String, dynamic> record) {
    final rawPayload = record['payload'];
    final Map<String, dynamic> payload;
    if (rawPayload is String) {
      final decoded = jsonDecode(rawPayload);
      if (decoded is! Map) {
        throw const FormatException('Schedule payload must be a JSON object.');
      }
      payload = Map<String, dynamic>.from(decoded);
    } else if (rawPayload is Map) {
      payload = Map<String, dynamic>.from(rawPayload);
    } else {
      throw const FormatException('Schedule payload is missing.');
    }

    return ScheduleEvent(
      recordId: record['id']?.toString() ?? '',
      admissionId: payload['admissionId'] as String? ?? '',
      patientId: payload['patientId'] as String? ?? '',
      doctor: payload['doctor'] as String? ?? '',
      department: payload['department'] as String? ?? '',
      eventDate: DateTime.tryParse(payload['eventDate'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      appointmentTime: payload['appointmentTime'] as String? ?? '',
      appointmentType: payload['appointmentType'] as String? ?? '',
      room: payload['room'] as String? ?? '',
      status: (payload['status'] as String? ?? 'SCHEDULED').toUpperCase(),
    );
  }
}
