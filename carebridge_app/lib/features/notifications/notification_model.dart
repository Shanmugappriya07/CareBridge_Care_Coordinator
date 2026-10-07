import 'package:flutter/material.dart';
import '../../core/widgets/status_badge.dart';

class PatientNotification {
  final String id;
  final String title;
  final String message;
  final String type;
  final DateTime timestamp;
  final bool isRead;
  final String admissionId;

  const PatientNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.timestamp,
    required this.isRead,
    required this.admissionId,
  });

  factory PatientNotification.fromJson(Map<String, dynamic> json) {
    return PatientNotification(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      type: json['type'] ?? 'General',
      timestamp: json['timestamp'] != null 
          ? DateTime.tryParse(json['timestamp']) ?? DateTime.now()
          : DateTime.now(),
      isRead: json['isRead'] ?? false,
      admissionId: json['admissionId']?.toString() ?? '',
    );
  }

  IconData get icon {
    switch (type.toLowerCase()) {
      case 'treatment':
      case 'schedule':
        return Icons.medical_information;
      case 'observation':
        return Icons.visibility;
      case 'prescription':
        return Icons.medication;
      case 'laboratory':
      case 'lab':
        return Icons.science;
      case 'scan':
      case 'radiology':
        return Icons.document_scanner;
      case 'billing':
      case 'payment':
        return Icons.receipt;
      case 'discharge':
        return Icons.exit_to_app;
      default:
        return Icons.notifications;
    }
  }

  BadgeType get badgeType {
    switch (type.toLowerCase()) {
      case 'treatment':
      case 'schedule':
      case 'observation':
        return BadgeType.info;
      case 'prescription':
      case 'laboratory':
      case 'lab':
      case 'scan':
      case 'radiology':
      case 'discharge':
        return BadgeType.success;
      case 'billing':
      case 'payment':
        return BadgeType.warning;
      default:
        return BadgeType.neutral;
    }
  }
}
