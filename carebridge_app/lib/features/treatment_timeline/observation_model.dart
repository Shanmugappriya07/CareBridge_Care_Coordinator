class Observation {
  final String patientId;
  final String admissionId;
  final String doctorName;
  final String department;
  final String note;
  final String vitals;
  final DateTime createdAt;

  const Observation({
    required this.patientId,
    required this.admissionId,
    required this.doctorName,
    required this.department,
    required this.note,
    required this.vitals,
    required this.createdAt,
  });

  factory Observation.fromJson(Map<String, dynamic> data) {
    return Observation(
      patientId: data['patientId'] as String? ?? '',
      admissionId: data['admissionId'] as String? ?? '',
      doctorName: data['doctorName'] as String? ?? '',
      department: data['department'] as String? ?? '',
      note: data['note'] as String? ?? '',
      vitals: data['vitals'] as String? ?? '',
      createdAt: DateTime.tryParse(data['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}
