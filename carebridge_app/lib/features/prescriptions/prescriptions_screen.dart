import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/admission_read_only_banner.dart';
import '../admissions/admission_model.dart';
import '../admissions/admission_service.dart';
import 'pharmacy_order_model.dart';
import 'prescription_model.dart';

// ─── Data models ────────────────────────────────────────────────────────────

class _Medication {
  final String id;
  final String name;
  final String dosage; // e.g. "1 tablet at bedtime"
  final String timing; // e.g. "09:00 PM"
  final String intake; // e.g. "Oral – with water after dinner"
  final String duration; // e.g. "30 Tablets Pack"
  final double price;
  final String prescribedBy;
  final String instructions;
  // order / pharmacy status (read-only for user)
  final String pharmacyCounter;
  final String pickupToken;
  bool isOrdered;
  bool isPaid;
  bool isReadyAtPharmacy; // set by hospital/pharmacy staff – read-only
  bool isCollected; // set by hospital/pharmacy staff – read-only
  String? collectedAt;

  _Medication({
    required this.id,
    required this.name,
    required this.dosage,
    required this.timing,
    required this.intake,
    required this.duration,
    required this.price,
    required this.prescribedBy,
    required this.instructions,
    required this.pharmacyCounter,
    required this.pickupToken,
    required this.isOrdered,
    required this.isPaid,
    required this.isReadyAtPharmacy,
    required this.isCollected,
    required this.collectedAt,
  });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

class PrescriptionsScreen extends StatefulWidget {
  final Admission admission;
  final String caregiverMobile;
  final bool isReadOnly;

  const PrescriptionsScreen({
    super.key,
    required this.admission,
    required this.caregiverMobile,
    required this.isReadOnly,
  });

  @override
  State<PrescriptionsScreen> createState() => _PrescriptionsScreenState();
}

class _PrescriptionsScreenState extends State<PrescriptionsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  final List<_Medication> _medications = [];
  List<Prescription> _prescriptions = [];
  bool _prescriptionsLoading = true;
  String? _prescriptionsError;
  int _prescriptionRequestId = 0;
  List<PharmacyOrder> _pharmacyOrders = [];
  bool _pharmacyOrdersLoading = true;
  String? _pharmacyOrdersError;
  int _pharmacyRequestId = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadPrescriptions();
    _loadPharmacyOrders();
  }

  @override
  void didUpdateWidget(covariant PrescriptionsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.admission.id != widget.admission.id ||
        oldWidget.caregiverMobile != widget.caregiverMobile) {
      _prescriptionRequestId++;
      _prescriptions = [];
      _prescriptionsLoading = true;
      _prescriptionsError = null;
      _loadPrescriptions();
      _pharmacyRequestId++;
      _pharmacyOrders = [];
      _pharmacyOrdersLoading = true;
      _pharmacyOrdersError = null;
      _loadPharmacyOrders();
    }
  }

  Future<void> _loadPrescriptions() async {
    final requestId = ++_prescriptionRequestId;
    try {
      final prescriptions = await AdmissionService.getPrescriptions(
        widget.admission.id,
        widget.caregiverMobile,
      );
      if (!mounted || requestId != _prescriptionRequestId) return;
      setState(() {
        _prescriptions = prescriptions;
        _prescriptionsLoading = false;
        _prescriptionsError = null;
      });
    } catch (error) {
      if (!mounted || requestId != _prescriptionRequestId) return;
      debugPrint(
          '[Prescriptions] Load failed for ${widget.admission.id}: $error');
      setState(() {
        _prescriptions = [];
        _prescriptionsLoading = false;
        _prescriptionsError = 'Prescriptions could not be loaded.';
      });
    }
  }

  Future<void> _loadPharmacyOrders() async {
    final requestId = ++_pharmacyRequestId;
    try {
      final orders = await AdmissionService.getPharmacyOrders(
        widget.admission.id,
        widget.caregiverMobile,
      );
      if (!mounted || requestId != _pharmacyRequestId) return;
      setState(() {
        _pharmacyOrders = orders;
        _pharmacyOrdersLoading = false;
        _pharmacyOrdersError = null;
      });
    } catch (error) {
      if (!mounted || requestId != _pharmacyRequestId) return;
      debugPrint('[Pharmacy] Load failed for ${widget.admission.id}: $error');
      setState(() {
        _pharmacyOrders = [];
        _pharmacyOrdersLoading = false;
        _pharmacyOrdersError = 'Pharmacy information could not be loaded.';
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // ── Order & Payment ────────────────────────────────────────────────────────

  void _placeOrder(int index) {
    if (widget.isReadOnly) return;

    final med = _medications[index];
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Order'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(med.name, style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Dosage: ${med.dosage} at ${med.timing}'),
            Text('Intake: ${med.intake}'),
            Text('Duration: ${med.duration}'),
            const SizedBox(height: 8),
            Text('Amount: ₹${med.price.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                    fontSize: 16)),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              if (widget.isReadOnly) return;
              setState(() => _medications[index].isOrdered = true);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                      'Order placed for ${med.name}. Payment is processed directly at the Hospital Pharmacy Counter.'),
                  backgroundColor: AppColors.info,
                ),
              );
            },
            child: const Text('Confirm Order'),
          ),
        ],
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Hospital Pharmacy'),
            Text('Admission ${widget.admission.id}',
                style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Pharmacy & Prescriptions',
            onPressed: () {
              setState(() {
                _prescriptionsLoading = true;
                _pharmacyOrdersLoading = true;
              });
              _loadPrescriptions();
              _loadPharmacyOrders();
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
                icon: Icon(Icons.medication_outlined),
                text: 'View Prescriptions'),
            Tab(
                icon: Icon(Icons.inventory_2_outlined),
                text: 'Medicine Status'),
          ],
        ),
      ),
      body: Column(
        children: [
          if (widget.isReadOnly)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: AdmissionReadOnlyBanner(),
            ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _PrescriptionsTab(
                  prescriptions: _prescriptions,
                  medications: _medications,
                  isReadOnly: widget.isReadOnly,
                  isLoading: _prescriptionsLoading,
                  errorMessage: _prescriptionsError,
                  onRetry: _loadPrescriptions,
                  onPlaceOrder: _placeOrder,
                ),
                _MedicineStatusTab(
                  medications: _medications,
                  pharmacyOrders: _pharmacyOrders,
                  isLoading: _pharmacyOrdersLoading,
                  errorMessage: _pharmacyOrdersError,
                  onRetry: _loadPharmacyOrders,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Tab 1 : View Prescriptions ──────────────────────────────────────────────

class _PrescriptionsTab extends StatelessWidget {
  final List<Prescription> prescriptions;
  final List<_Medication> medications;
  final bool isReadOnly;
  final bool isLoading;
  final String? errorMessage;
  final Future<void> Function() onRetry;
  final void Function(int) onPlaceOrder;

  const _PrescriptionsTab({
    required this.prescriptions,
    required this.medications,
    required this.isReadOnly,
    required this.isLoading,
    required this.errorMessage,
    required this.onRetry,
    required this.onPlaceOrder,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading && prescriptions.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (errorMessage != null && prescriptions.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(errorMessage!, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    if (medications.isEmpty && prescriptions.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'No prescriptions are available for this admission.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRetry,
      child: ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: prescriptions.length + medications.length,
      itemBuilder: (context, index) {
        if (index < prescriptions.length) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: _SyncedPrescriptionCard(prescription: prescriptions[index]),
          );
        }
        index -= prescriptions.length;
        final m = medications[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: CustomCard(
            border: Border.all(
              color: m.isOrdered ? AppColors.border : AppColors.warning,
              width: m.isOrdered ? 1 : 1.5,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title + status
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(m.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                    ),
                    if (m.isOrdered)
                      const StatusBadge(
                        label: 'Order Placed',
                        type: BadgeType.info,
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                // Dosage / timing / intake details
                _DetailRow(
                    Icons.schedule, 'Dosage', '${m.dosage} at ${m.timing}'),
                const SizedBox(height: 4),
                _DetailRow(Icons.medical_services_outlined, 'Intake', m.intake),
                const SizedBox(height: 4),
                _DetailRow(Icons.inventory_2_outlined, 'Duration', m.duration),
                const SizedBox(height: 4),
                _DetailRow(
                    Icons.person_outline, 'Prescribed by', m.prescribedBy),
                const SizedBox(height: 8),

                // Instructions
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline,
                          size: 16, color: AppColors.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(m.instructions,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textSecondary)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Price
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Price',
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary)),
                    Text('₹${m.price.toStringAsFixed(2)}',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                            fontSize: 15)),
                  ],
                ),
                const SizedBox(height: 12),

                // Action button
                SizedBox(
                  width: double.infinity,
                  child: !m.isOrdered
                      ? ElevatedButton.icon(
                          onPressed:
                              isReadOnly ? null : () => onPlaceOrder(index),
                          icon: const Icon(Icons.shopping_cart_outlined,
                              size: 18),
                          label: const Text('Place Order at Pharmacy'),
                        )
                      : OutlinedButton.icon(
                          onPressed: null,
                          icon: const Icon(Icons.check_circle,
                              size: 18, color: AppColors.success),
                          label: const Text('Order Placed (Pay at Pharmacy Desk)',
                              style: TextStyle(color: AppColors.success)),
                        ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}
}

class _SyncedPrescriptionCard extends StatelessWidget {
  final Prescription prescription;

  const _SyncedPrescriptionCard({required this.prescription});

  @override
  Widget build(BuildContext context) {
    final date = prescription.prescriptionDate == null
        ? 'Not available'
        : DateFormat('dd MMM yyyy').format(prescription.prescriptionDate!);
    return CustomCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(prescription.name,
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 10),
          _DetailRow(Icons.badge_outlined, 'Prescription ID',
              prescription.prescriptionId),
          _DetailRow(Icons.local_hospital_outlined, 'Admission ID',
              prescription.admissionId),
          _DetailRow(
              Icons.person_outline, 'Patient ID', prescription.patientId),
          _DetailRow(Icons.schedule, 'Prescription date', date),
          _DetailRow(Icons.medication_outlined, 'Dosage', prescription.dosage),
          _DetailRow(Icons.repeat, 'Frequency', prescription.frequency),
          _DetailRow(
              Icons.inventory_2_outlined, 'Duration', prescription.duration),
          if (prescription.intake.isNotEmpty)
            _DetailRow(
                Icons.medical_services_outlined, 'Intake', prescription.intake),
          _DetailRow(
              Icons.person_outline, 'Prescribed by', prescription.doctor),
          if (prescription.instructions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline,
                      size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(prescription.instructions,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Tab 2 : Medicine Status (read-only) ─────────────────────────────────────

class _MedicineStatusTab extends StatelessWidget {
  final List<_Medication> medications;
  final List<PharmacyOrder> pharmacyOrders;
  final bool isLoading;
  final String? errorMessage;
  final Future<void> Function() onRetry;

  const _MedicineStatusTab({
    required this.medications,
    required this.pharmacyOrders,
    required this.isLoading,
    required this.errorMessage,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final ordered = medications.where((m) => m.isOrdered).toList();

    if (isLoading && pharmacyOrders.isEmpty && ordered.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (errorMessage != null && pharmacyOrders.isEmpty && ordered.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(errorMessage!, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    if (ordered.isEmpty && pharmacyOrders.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.inventory_2_outlined,
                  size: 56, color: AppColors.textMuted),
              SizedBox(height: 16),
              Text('No orders placed yet',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary)),
              SizedBox(height: 8),
              Text(
                'Place an order from the Prescriptions tab\nto see medicine status here.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        // Read-only banner
        Container(
          color: AppColors.infoLight,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: const Row(
            children: [
              Icon(Icons.lock_outline, size: 16, color: AppColors.info),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Medicine status is updated by the hospital pharmacy. ',
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.info,
                      fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: onRetry,
            child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: pharmacyOrders.length + ordered.length,
            itemBuilder: (context, index) {
              if (index < pharmacyOrders.length) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _PharmacyOrderCard(order: pharmacyOrders[index]),
                );
              }
              final m = ordered[index - pharmacyOrders.length];
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: CustomCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(m.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                      const SizedBox(height: 4),
                      Text(m.pickupToken,
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary)),
                      const SizedBox(height: 12),

                      // Status stepper
                      _StatusStep(
                        label: 'Order Placed',
                        isDone: m.isOrdered,
                        icon: Icons.receipt_long_outlined,
                      ),
                      _StatusStep(
                        label: 'Payment Confirmed',
                        isDone: m.isPaid,
                        icon: Icons.payment,
                      ),
                      _StatusStep(
                        label: 'Ready at Pharmacy Counter',
                        isDone: m.isReadyAtPharmacy,
                        icon: Icons.local_pharmacy_outlined,
                        subLabel:
                            m.isReadyAtPharmacy ? m.pharmacyCounter : null,
                      ),
                      _StatusStep(
                        label: 'Collected',
                        isDone: m.isCollected,
                        icon: Icons.check_circle_outline,
                        subLabel: m.collectedAt,
                        isLast: true,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
      ],
    );
  }
}

class _PharmacyOrderCard extends StatelessWidget {
  final PharmacyOrder order;

  const _PharmacyOrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final orderDate = order.orderDate == null
        ? 'Not available'
        : DateFormat('dd MMM yyyy').format(order.orderDate!);
    return CustomCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(order.medicine,
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 8),
          _DetailRow(
              Icons.local_hospital_outlined, 'Admission ID', order.admissionId),
          _DetailRow(
              Icons.confirmation_number_outlined, 'Order ID', order.orderId),
          _DetailRow(
              Icons.inventory_2_outlined, 'Quantity', '${order.quantity}'),
          _DetailRow(Icons.payments_outlined, 'Price',
              '₹${order.price.toStringAsFixed(2)}'),
          _DetailRow(Icons.event_outlined, 'Order date', orderDate),
          _DetailRow(
              Icons.assignment_outlined, 'Order status', order.orderStatus),
          _DetailRow(Icons.local_pharmacy_outlined, 'Pickup status',
              order.pickupStatus),
          if (order.pickupLocation.isNotEmpty)
            _DetailRow(
                Icons.place_outlined, 'Pickup location', order.pickupLocation),
          if (order.pickupToken.isNotEmpty)
            _DetailRow(Icons.qr_code_2, 'Pickup token', order.pickupToken),
          _DetailRow(
              Icons.payment_outlined, 'Payment status', order.paymentStatus),
        ],
      ),
    );
  }
}

// ─── Shared helper widgets ────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: AppColors.primary),
        const SizedBox(width: 6),
        Text('$label: ',
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary)),
        Expanded(
          child: Text(value,
              style:
                  const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
        ),
      ],
    );
  }
}

class _StatusStep extends StatelessWidget {
  final String label;
  final bool isDone;
  final IconData icon;
  final String? subLabel;
  final bool isLast;

  const _StatusStep({
    required this.label,
    required this.isDone,
    required this.icon,
    this.subLabel,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isDone ? AppColors.success : AppColors.textMuted;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor:
                  isDone ? AppColors.successLight : AppColors.surfaceVariant,
              child: Icon(icon, size: 14, color: color),
            ),
            if (!isLast)
              Container(width: 2, height: 28, color: AppColors.border),
          ],
        ),
        const SizedBox(width: 12),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: color)),
              if (subLabel != null)
                Text(subLabel!,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary)),
            ],
          ),
        ),
      ],
    );
  }
}
