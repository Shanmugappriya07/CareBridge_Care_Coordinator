/// A single charge line on the hospital bill.
/// Maps to BillingItemDto: { desc, category, amount }
class BillItem {
  final String desc;
  final String category;
  final double amount;

  const BillItem({
    required this.desc,
    required this.category,
    required this.amount,
  });

  factory BillItem.fromJson(Map<String, dynamic> j) => BillItem(
        desc: j['desc'] as String? ?? '',
        category: j['category'] as String? ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
      );
}

/// A single payment transaction.
/// Maps to BillingPaymentDto: { txId, date, method, amount, status }
class BillPayment {
  final String txId;
  final String date;
  final String method;
  final double amount;
  final String status;

  const BillPayment({
    required this.txId,
    required this.date,
    required this.method,
    required this.amount,
    required this.status,
  });

  factory BillPayment.fromJson(Map<String, dynamic> j) => BillPayment(
        txId: j['txId'] as String? ?? '',
        date: j['date'] as String? ?? '',
        method: j['method'] as String? ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        status: j['status'] as String? ?? '',
      );

  bool get isPaid {
    final s = status.toLowerCase();
    return s == 'paid' || s == 'success';
  }
}

/// Full billing snapshot for one admission.
/// Maps to BillingResponse from Spring Boot.
class BillingData {
  final String admissionId;
  final List<BillItem> items;
  final double totalBill;
  final double insuranceCovered;
  final double paidAmount;
  final double balance;
  final String claimStatus;
  final List<BillPayment> payments;
  final bool isReadOnly;
  final int? recordId;

  const BillingData({
    required this.admissionId,
    required this.items,
    required this.totalBill,
    required this.insuranceCovered,
    required this.paidAmount,
    required this.balance,
    required this.claimStatus,
    required this.payments,
    required this.isReadOnly,
    this.recordId,
  });

  /// Parses the JSON body returned by
  /// GET /api/v1/admissions/{id}/billing
  factory BillingData.fromJson(Map<String, dynamic> j) {
    final rawItems = j['items'] as List? ?? [];
    final rawPayments = j['payments'] as List? ?? [];

    return BillingData(
      admissionId: j['admissionId'] as String? ?? '',
      items: rawItems
          .whereType<Map>()
          .map((e) => BillItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      totalBill: (j['totalBill'] as num?)?.toDouble() ?? 0,
      insuranceCovered: (j['insuranceCovered'] as num?)?.toDouble() ?? 0,
      paidAmount: (j['paidAmount'] as num?)?.toDouble() ?? 0,
      balance: (j['balance'] as num?)?.toDouble() ?? 0,
      claimStatus: j['claimStatus'] as String? ?? 'Unknown',
      payments: rawPayments
          .whereType<Map>()
          .map((e) => BillPayment.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      isReadOnly: j['isReadOnly'] as bool? ?? false,
      recordId: (j['recordId'] as num?)?.toInt(),
    );
  }
}
