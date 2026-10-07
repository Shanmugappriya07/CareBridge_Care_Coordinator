import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/constants/app_constants.dart';
import 'admission_model.dart';
import '../billing/billing_model.dart';
import '../prescriptions/prescription_model.dart';
import '../prescriptions/pharmacy_order_model.dart';
import '../lab_reports/lab_report_model.dart';
import '../treatment_timeline/observation_model.dart';
import '../treatment_timeline/schedule_model.dart';
import '../documents/document_model.dart';
import '../notifications/notification_model.dart';

class AdmissionService {
  static const _timeout = Duration(seconds: 15);

  static Future<({bool developmentOnly, String? otp})> sendOtp(
      String mobile) async {
    final response = await http
        .post(
          Uri.parse('${AppConstants.apiBaseUrl}/auth/send-otp'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'mobile': mobile}),
        )
        .timeout(_timeout);
    _ensureSuccess(response);
    
    final decoded = jsonDecode(response.body);
    if (decoded is Map) {
      return (
        developmentOnly: decoded['developmentOnly'] == true,
        otp: decoded['otp']?.toString(),
      );
    }
    return (developmentOnly: false, otp: null);
  }

  static Future<void> verifyOtp(String mobile, String otp) async {
    final response = await http
        .post(
          Uri.parse('${AppConstants.apiBaseUrl}/auth/verify-otp'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'mobile': mobile, 'otp': otp}),
        )
        .timeout(_timeout);
    _ensureSuccess(response);
  }

  static Future<List<Admission>> getAdmissions(String mobile) async {
    final lookupMobile = formatMobileForApi(mobile);
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/caregivers/${Uri.encodeComponent(lookupMobile)}/admissions',
    );
    final response = await http.get(uri).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The admissions service returned an invalid response.');
    }

    final admissions = decoded
        .whereType<Map>()
        .map((data) => Admission.fromJson(Map<String, dynamic>.from(data)))
        .toList();
    return admissions;
  }

  static Future<Admission> getAdmission(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw const AdmissionApiException(
          'The admission service returned an invalid response.');
    }
    return Admission.fromJson(Map<String, dynamic>.from(decoded));
  }

  static Future<List<Observation>> getObservations(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/observations',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The observations service returned an invalid response.');
    }

    return decoded
        .whereType<Map>()
        .map((data) => Observation.fromJson(Map<String, dynamic>.from(data)))
        .toList();
  }

  static Future<List<ScheduleEvent>> getSchedules(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/records/schedule',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The schedule service returned an invalid response.');
    }
    final schedules = decoded
        .whereType<Map>()
        .map((record) =>
            ScheduleEvent.fromRecord(Map<String, dynamic>.from(record)))
        .toList();
    if (schedules.any((schedule) => schedule.admissionId != admissionId)) {
      throw const AdmissionApiException(
          'The schedule service returned a different admission.');
    }
    schedules.sort((a, b) {
      final dateOrder = a.eventDate.compareTo(b.eventDate);
      return dateOrder == 0
          ? a.appointmentTime.compareTo(b.appointmentTime)
          : dateOrder;
    });
    return schedules;
  }

  static Future<List<Prescription>> getPrescriptions(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/records/prescriptions',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The prescription service returned an invalid response.');
    }
    final prescriptions = decoded
        .whereType<Map>()
        .map((record) =>
            Prescription.fromRecord(Map<String, dynamic>.from(record)))
        .toList();
    if (prescriptions.any((prescription) =>
        prescription.admissionId != admissionId ||
        prescription.prescriptionId.isEmpty)) {
      throw const AdmissionApiException(
          'The prescription service returned an invalid admission record.');
    }
    prescriptions.sort((a, b) {
      final aDate =
          a.prescriptionDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate =
          b.prescriptionDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
    return prescriptions;
  }

  static Future<List<PharmacyOrder>> getPharmacyOrders(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/records/pharmacy',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The pharmacy service returned an invalid response.');
    }
    final orders = decoded
        .whereType<Map>()
        .map((record) =>
            PharmacyOrder.fromRecord(Map<String, dynamic>.from(record)))
        .toList();
    if (orders.any(
        (order) => order.admissionId != admissionId || order.orderId.isEmpty)) {
      throw const AdmissionApiException(
          'The pharmacy service returned an invalid admission record.');
    }
    orders.sort((a, b) {
      final aDate = a.orderDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = b.orderDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
    return orders;
  }

  static Future<BillPayment> postPayment({
    required String admissionId,
    required String caregiverMobile,
    required String method,
    required double amount,
  }) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/billing/payments',
    );
    final response = await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
      },
      body: jsonEncode({'method': method, 'amount': amount}),
    ).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw const AdmissionApiException(
          'The payment service returned an invalid response.');
    }
    return BillPayment.fromJson(Map<String, dynamic>.from(decoded));
  }

  static Future<BillingData?> getBilling(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/billing',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);

    if (response.statusCode == 204) return null;
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw const AdmissionApiException(
          'The billing service returned an invalid response.');
    }
    return BillingData.fromJson(Map<String, dynamic>.from(decoded));
  }

  static Future<List<LabReport>> getLabReports(
      String admissionId, String caregiverMobile) async {
    final encodedAdmissionId = Uri.encodeComponent(admissionId);
    final headers = {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    };
    final responses = await Future.wait([
      for (final resourceType in ['tests', 'scans'])
        http
            .get(
              Uri.parse(
                  '${AppConstants.apiBaseUrl}/admissions/$encodedAdmissionId/records/$resourceType'),
              headers: headers,
            )
            .timeout(_timeout),
    ]);
    final reportRows = <Map>[];
    for (final response in responses) {
      _ensureSuccess(response);
      final decoded = jsonDecode(response.body);
      if (decoded is! List) {
        throw const AdmissionApiException(
            'The lab report service returned an invalid response.');
      }
      reportRows.addAll(decoded.whereType<Map>());
    }
    final reports = reportRows
        .map((record) => LabReport.fromRecord(
            Map<String, dynamic>.from(record)))
        .toList();
    if (reports.any(
        (report) => report.admissionId != admissionId || report.id.isEmpty)) {
      throw const AdmissionApiException(
          'The lab report service returned an invalid admission record.');
    }
    reports.sort((a, b) => b.reportDate.compareTo(a.reportDate));
    return reports;
  }

  static Future<List<PatientDocument>> getDocuments(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/records/documents',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);

    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The documents service returned an invalid response.');
    }

    return decoded
        .whereType<Map>()
        .map((data) => PatientDocument.fromJson(Map<String, dynamic>.from(data)))
        .toList();
  }

  static Future<List<PatientNotification>> getNotifications(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/notifications',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);

    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The notifications service returned an invalid response.');
    }

    return decoded
        .whereType<Map>()
        .map((data) =>
            PatientNotification.fromJson(Map<String, dynamic>.from(data)))
        .toList();
  }

  static Future<void> markNotificationAsRead(
      String notificationId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/notifications/${Uri.encodeComponent(notificationId)}/read',
    );
    final response = await http.post(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);

    _ensureSuccess(response);
  }

  static Future<List<Map<String, dynamic>>> getFamilyMembers(
      String admissionId, String caregiverMobile) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/family',
    );
    final response = await http.get(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw const AdmissionApiException(
          'The family service returned an invalid response.');
    }
    return decoded
        .whereType<Map>()
        .map((data) => Map<String, dynamic>.from(data))
        .toList();
  }

  static Future<Map<String, dynamic>> addFamilyMember({
    required String admissionId,
    required String caregiverMobile,
    required String name,
    required String phone,
    String relation = 'Extended Family Member',
  }) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/family',
    );
    final response = await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
      },
      body: jsonEncode({
        'name': name,
        'phone': phone,
        'relation': relation,
        'role': 'READ_ONLY',
      }),
    ).timeout(_timeout);
    _ensureSuccess(response);

    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw const AdmissionApiException(
          'The family service returned an invalid response.');
    }
    return Map<String, dynamic>.from(decoded);
  }

  static Future<void> removeFamilyMember({
    required String admissionId,
    required String caregiverMobile,
    required String memberPhone,
  }) async {
    final uri = Uri.parse(
      '${AppConstants.apiBaseUrl}/admissions/${Uri.encodeComponent(admissionId)}/family/${Uri.encodeComponent(memberPhone)}',
    );
    final response = await http.delete(uri, headers: {
      'X-Caregiver-Mobile': formatMobileForApi(caregiverMobile),
    }).timeout(_timeout);
    _ensureSuccess(response);
  }

  static String formatMobileForApi(String mobile) {
    final digits = mobile.replaceAll(RegExp(r'\D'), '');
    final nationalNumber = digits.length == 12 && digits.startsWith('91')
        ? digits.substring(2)
        : digits;
    if (nationalNumber.length == 10) return '+91 $nationalNumber';
    return mobile;
  }

  static void _ensureSuccess(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;

    String? message;
    try {
      final body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        message = body['message'] as String? ??
            body['detail'] as String? ??
            body['error'] as String?;
      }
    } catch (_) {
      if (response.body.trim().isNotEmpty) message = response.body.trim();
    }
    throw AdmissionApiException(
      message ?? 'Request failed with HTTP ${response.statusCode}.',
    );
  }
}

class AdmissionApiException implements Exception {
  final String message;

  const AdmissionApiException(this.message);

  @override
  String toString() => message;
}
