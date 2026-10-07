import 'dart:convert';

import 'package:carebridge_app/features/prescriptions/pharmacy_order_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('decodes admission-scoped pharmacy order details', () {
    final order = PharmacyOrder.fromRecord({
      'id': 21,
      'resourceType': 'pharmacy',
      'payload': jsonEncode({
        'orderId': 'PH-21',
        'admissionId': 'ADM-21',
        'patientId': 'PAT-21',
        'prescriptionId': 'RX-21',
        'medicine': 'Amoxicillin 500mg Capsule',
        'quantity': 14,
        'price': 875.5,
        'orderDate': '2026-09-29',
        'orderStatus': 'READY',
        'pickupStatus': 'READY',
        'paymentStatus': 'UNPAID',
        'pickupLocation': 'Counter 3',
        'pickupToken': 'PH-1021',
      }),
    });

    expect(order.recordId, '21');
    expect(order.orderId, 'PH-21');
    expect(order.admissionId, 'ADM-21');
    expect(order.patientId, 'PAT-21');
    expect(order.prescriptionId, 'RX-21');
    expect(order.medicine, 'Amoxicillin 500mg Capsule');
    expect(order.quantity, 14);
    expect(order.price, 875.5);
    expect(order.orderDate, DateTime(2026, 9, 29));
    expect(order.orderStatus, 'READY');
    expect(order.pickupStatus, 'READY');
    expect(order.paymentStatus, 'UNPAID');
    expect(order.pickupLocation, 'Counter 3');
    expect(order.pickupToken, 'PH-1021');
  });
}
