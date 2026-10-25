import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/digital_receipt_sheet.dart';
import '../admissions/admission_model.dart';
import '../admissions/admission_service.dart';
import 'billing_model.dart';

class BillingScreen extends StatefulWidget {
  final CaregiverRole currentRole;
  final Admission admission;

  const BillingScreen({
    super.key,
    required this.currentRole,
    required this.admission,
  });

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  // ── State ──────────────────────────────────────────────────────────────────
  bool _loading = true;
  String? _error;
  BillingData? _billing;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await AdmissionService.getBilling(
        widget.admission.id,
        widget.admission.caregiverMobile,
      );
      if (mounted) setState(() { _billing = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  void _showReceipt(BillPayment payment) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DigitalReceiptSheet(
        transactionId: payment.txId,
        method: payment.method,
        amount: payment.amount,
        patientName: widget.admission.patientName,
        admissionId: widget.admission.id,
        date: payment.date,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Hospital Bills'),
        actions: [
          if (!_loading)
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh',
              onPressed: _load,
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_billing == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.receipt_long_outlined,
                  size: 56, color: AppColors.textMuted),
              SizedBox(height: 16),
              Text(
                'No billing records yet',
                style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary),
              ),
              SizedBox(height: 8),
              Text(
                'Billing information will appear here once\nthe hospital generates a bill for this admission.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    final b = _billing!;
    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Read-only banner for discharged admissions ───────────────────
            if (b.isReadOnly)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.infoLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.lock_outline, size: 16, color: AppColors.info),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'This admission has been discharged. Billing is read-only.',
                        style: TextStyle(
                            fontSize: 12,
                            color: AppColors.info,
                            fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),

            // ── Summary banner ───────────────────────────────────────────────
            CustomCard(
              backgroundColor: AppColors.primary,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Hospital Billing Summary',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _SummaryCol('Total Billed',
                          '₹${b.totalBill.toStringAsFixed(2)}'),
                      _SummaryCol('Insurance Covered',
                          '₹${b.insuranceCovered.toStringAsFixed(2)}'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Colors.white24),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Pending Balance',
                              style: TextStyle(
                                  color: Colors.white70, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(
                            '₹${b.balance.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: b.balance <= 0
                                  ? AppColors.successLight
                                  : Colors.white,
                            ),
                          ),
                        ],
                      ),
                      if (b.balance <= 0)
                        const StatusBadge(
                            label: 'All Cleared',
                            type: BadgeType.success)
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.white30),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.storefront_outlined,
                                  color: Colors.white, size: 14),
                              SizedBox(width: 6),
                              Text(
                                'Pay at Hospital Desk',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.infoLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: AppColors.info),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Hospital charges and payments are collected and recorded directly at the HMS Billing & Cashier Desk.',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.info,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Bill line items ──────────────────────────────────────────────
            const Text('Hospital Bill Items',
                style:
                    TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (b.items.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('No itemised charges recorded yet.',
                    style: TextStyle(color: AppColors.textSecondary)),
              )
            else
              ...b.items.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: CustomCard(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.desc,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14)),
                                const SizedBox(height: 4),
                                Text(item.category,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary)),
                              ],
                            ),
                          ),
                          Text(
                            '₹${item.amount.toStringAsFixed(2)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: AppColors.primary),
                          ),
                        ],
                      ),
                    ),
                  )),

            const SizedBox(height: 24),

            // ── Payment history ──────────────────────────────────────────────
            const Text('Payment History',
                style:
                    TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (b.payments.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No payments recorded yet.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              )
            else
              ...b.payments.map((payment) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: CustomCard(
                      onTap: () => _showReceipt(payment),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(payment.txId,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14)),
                                const SizedBox(height: 3),
                                Text(payment.method,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary)),
                                const SizedBox(height: 3),
                                Text(payment.date,
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textMuted)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹${payment.amount.toStringAsFixed(2)}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.success,
                                    fontSize: 15),
                              ),
                              const SizedBox(height: 4),
                              const StatusBadge(
                                  label: 'Receipt',
                                  type: BadgeType.info),
                            ],
                          ),
                        ],
                      ),
                    ),
                  )),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

// ─── Helper widget ────────────────────────────────────────────────────────────

class _SummaryCol extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryCol(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(color: Colors.white70, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 17)),
      ],
    );
  }
}
