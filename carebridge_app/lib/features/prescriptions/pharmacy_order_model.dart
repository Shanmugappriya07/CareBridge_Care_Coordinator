import 'dart:convert';

class PharmacyOrder {
  final String recordId;
  final String orderId;
  final String admissionId;
  final String patientId;
  final String prescriptionId;
  final String medicine;
  final int quantity;
  final double price;
  final DateTime? orderDate;
  final String orderStatus;
  final String pickupStatus;
  final String paymentStatus;
  final String pickupLocation;
  final String pickupToken;

  const PharmacyOrder({
    required this.recordId,
    required this.orderId,
    required this.admissionId,
    required this.patientId,
    required this.prescriptionId,
    required this.medicine,
    required this.quantity,
    required this.price,
    required this.orderDate,
    required this.orderStatus,
    required this.pickupStatus,
    required this.paymentStatus,
    required this.pickupLocation,
    required this.pickupToken,
  });

  factory PharmacyOrder.fromRecord(Map<String, dynamic> record) {
    final rawPayload = record['payload'];
    final Map<String, dynamic> payload;
    if (rawPayload is String) {
      final decoded = jsonDecode(rawPayload);
      if (decoded is! Map) {
        throw const FormatException('Pharmacy payload must be a JSON object.');
      }
      payload = Map<String, dynamic>.from(decoded);
    } else if (rawPayload is Map) {
      payload = Map<String, dynamic>.from(rawPayload);
    } else {
      throw const FormatException('Pharmacy payload is missing.');
    }

    return PharmacyOrder(
      recordId: record['id']?.toString() ?? '',
      orderId: payload['orderId'] as String? ?? '',
      admissionId: payload['admissionId'] as String? ?? '',
      patientId: payload['patientId'] as String? ?? '',
      prescriptionId: payload['prescriptionId'] as String? ?? '',
      medicine: payload['medicine'] as String? ?? '',
      quantity: int.tryParse(payload['quantity']?.toString() ?? '') ?? 0,
      price: double.tryParse(payload['price']?.toString() ?? '') ?? 0,
      orderDate: DateTime.tryParse(payload['orderDate'] as String? ?? ''),
      orderStatus:
          (payload['orderStatus'] as String? ?? 'ORDERED').toUpperCase(),
      pickupStatus:
          (payload['pickupStatus'] as String? ?? 'NOT_READY').toUpperCase(),
      paymentStatus:
          (payload['paymentStatus'] as String? ?? 'UNPAID').toUpperCase(),
      pickupLocation: payload['pickupLocation'] as String? ?? '',
      pickupToken: payload['pickupToken'] as String? ?? '',
    );
  }
}
