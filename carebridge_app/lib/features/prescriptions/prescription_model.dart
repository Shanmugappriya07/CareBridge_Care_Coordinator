import 'dart:convert';

class Prescription {
  final String recordId;
  final String prescriptionId;
  final String admissionId;
  final String patientId;
  final String name;
  final String dosage;
  final String frequency;
  final String duration;
  final String intake;
  final String instructions;
  final DateTime? prescriptionDate;
  final String doctor;

  final double price;
  final String pharmacyCounter;
  final String pickupToken;
  bool isOrdered;
  bool isPaid;
  bool isReadyAtPharmacy;
  bool isCollected;
  String? collectedAt;

  Prescription({
    required this.recordId,
    required this.prescriptionId,
    required this.admissionId,
    required this.patientId,
    required this.name,
    required this.dosage,
    required this.frequency,
    required this.duration,
    required this.intake,
    required this.instructions,
    required this.prescriptionDate,
    required this.doctor,
    this.price = 0,
    this.pharmacyCounter = '',
    this.pickupToken = '',
    this.isOrdered = false,
    this.isPaid = false,
    this.isReadyAtPharmacy = false,
    this.isCollected = false,
    this.collectedAt,
  });

  factory Prescription.fromRecord(Map<String, dynamic> record) {
    final rawPayload = record['payload'];
    final Map<String, dynamic> payload;
    if (rawPayload is String) {
      final decoded = jsonDecode(rawPayload);
      if (decoded is! Map) {
        throw const FormatException(
            'Prescription payload must be a JSON object.');
      }
      payload = Map<String, dynamic>.from(decoded);
    } else if (rawPayload is Map) {
      payload = Map<String, dynamic>.from(rawPayload);
    } else {
      throw const FormatException('Prescription payload is missing.');
    }

    return Prescription(
      recordId: record['id']?.toString() ?? '',
      prescriptionId: payload['prescriptionId'] as String? ?? '',
      admissionId: payload['admissionId'] as String? ?? '',
      patientId: payload['patientId'] as String? ?? '',
      name: payload['medicineName'] as String? ?? '',
      dosage: payload['dosage'] as String? ?? '',
      frequency: payload['frequency'] as String? ?? '',
      duration: payload['duration'] as String? ?? '',
      intake: payload['intake'] as String? ?? '',
      instructions: payload['instructions'] as String? ?? '',
      prescriptionDate:
          DateTime.tryParse(payload['prescriptionDate'] as String? ?? ''),
      doctor: payload['doctor'] as String? ?? '',
    );
  }
}
