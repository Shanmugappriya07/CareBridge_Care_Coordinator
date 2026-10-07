import 'package:intl/intl.dart';

class PatientDocument {
  final String id;
  final String admissionId;
  final String name;
  final String type; // e.g., 'Admission', 'Identity', 'Insurance', 'Diagnostics'
  final DateTime date;
  final String size;
  final String fileReference;
  final String? description;

  const PatientDocument({
    required this.id,
    required this.admissionId,
    required this.name,
    required this.type,
    required this.date,
    required this.size,
    required this.fileReference,
    this.description,
  });

  factory PatientDocument.fromJson(Map<String, dynamic> json) {
    return PatientDocument(
      id: json['id']?.toString() ?? '',
      admissionId: json['admissionId']?.toString() ?? '',
      name: json['name'] ?? 'Untitled Document',
      type: json['type'] ?? 'General',
      date: json['date'] != null 
          ? DateTime.tryParse(json['date']) ?? DateTime.now()
          : DateTime.now(),
      size: json['size'] ?? '0 KB',
      fileReference: json['fileReference'] ?? '',
      description: json['description'],
    );
  }

  String get formattedDate => DateFormat('dd MMM yyyy').format(date);
}
