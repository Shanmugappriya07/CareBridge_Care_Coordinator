import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_card.dart';
import 'admission_model.dart';
import 'admission_service.dart';

class AdmissionSelectionScreen extends StatefulWidget {
  final String caregiverMobile;
  final ValueChanged<Admission> onAdmissionSelected;

  const AdmissionSelectionScreen({
    super.key,
    required this.caregiverMobile,
    required this.onAdmissionSelected,
  });

  @override
  State<AdmissionSelectionScreen> createState() =>
      _AdmissionSelectionScreenState();
}

class _AdmissionSelectionScreenState extends State<AdmissionSelectionScreen> {
  List<Admission>? _admissions;
  bool _isLoading = true;
  bool _loadFailed = false;
  bool _refreshInProgress = false;

  @override
  void initState() {
    super.initState();
    _loadAdmissions();
  }

  Future<void> _loadAdmissions({bool fromRefresh = false}) async {
    if (_refreshInProgress) return;
    _refreshInProgress = true;
    try {
      final admissions =
          await AdmissionService.getAdmissions(widget.caregiverMobile);
      if (!mounted) return;
      setState(() {
        _admissions = admissions;
        _isLoading = false;
        _loadFailed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _loadFailed = _admissions == null;
      });
      if (fromRefresh || _admissions != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Admissions could not be refreshed.')),
        );
      }
    } finally {
      _refreshInProgress = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Select Admission')),
      body: RefreshIndicator(
        onRefresh: () => _loadAdmissions(fromRefresh: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            if (_isLoading)
              const SizedBox(
                height: 300,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_loadFailed)
              const SizedBox(
                height: 300,
                child: _MessageState(
                  icon: Icons.cloud_off_outlined,
                  message: 'Admissions could not be loaded.',
                ),
              )
            else if (_admissions!.isEmpty)
              const SizedBox(
                height: 300,
                child: _MessageState(
                  icon: Icons.folder_open_outlined,
                  message: 'No authorized admissions are available.',
                ),
              )
            else ...[
              const Text(
                'Choose an admission to continue',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text('Caregiver: ${widget.caregiverMobile}',
                  style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 18),
              ..._admissions!.map((admission) => _AdmissionCard(
                    admission: admission,
                    onTap: () => widget.onAdmissionSelected(admission),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}

class _AdmissionCard extends StatelessWidget {
  final Admission admission;
  final VoidCallback onTap;

  const _AdmissionCard({required this.admission, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final active = admission.isActive;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: CustomCard(
          onTap: onTap,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      active ? 'Current Admission' : 'Previous Admission',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                  if (admission.isReadOnly) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.shade300),
                      ),
                      child: Text(
                        'READ-ONLY',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                  ],
                  Chip(
                    label: Text(active ? 'ACTIVE' : 'DISCHARGED'),
                    backgroundColor: active
                        ? AppColors.primaryLight.withOpacity(0.3)
                        : Colors.grey.shade200,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _row('Patient', admission.patientName),
              _row('Patient ID', admission.patientId),
              _row('Admission ID', admission.id),
              _row('Admission date', _formatDate(admission.admissionDate)),
              if (admission.dischargeDate != null)
                _row('Discharge date', _formatDate(admission.dischargeDate!)),
              _row('Doctor', admission.doctor),
              _row('Department', admission.department),
              _row('Room / Ward', admission.roomWard),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: ElevatedButton.icon(
                  onPressed: onTap,
                  icon: const Icon(Icons.arrow_forward, size: 16),
                  label: Text(active ? 'Open Dashboard' : 'View Admission'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            SizedBox(
                width: 120,
                child: Text(label,
                    style: const TextStyle(color: AppColors.textSecondary))),
            Expanded(child: Text(value.isEmpty ? 'Not available' : value)),
          ],
        ),
      );

  String _formatDate(DateTime date) => DateFormat('dd MMM yyyy').format(date);
}

class _MessageState extends StatelessWidget {
  final IconData icon;
  final String message;

  const _MessageState({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}

class AdmissionDetailsScreen extends StatelessWidget {
  final Admission admission;

  const AdmissionDetailsScreen({super.key, required this.admission});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admission Information')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Previous Admission',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Read-only record',
              style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 18),
          CustomCard(
            child: Column(
              children: [
                _detail('Status', admission.status),
                _detail('Admission ID', admission.id),
                _detail('Admission date', _formatDate(admission.admissionDate)),
                _detail(
                    'Discharge date',
                    admission.dischargeDate == null
                        ? 'Not available'
                        : _formatDate(admission.dischargeDate!)),
                _detail('Doctor', admission.doctor),
                _detail('Department', admission.department),
                _detail('Room / Ward', admission.roomWard),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detail(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
                width: 125,
                child: Text(label,
                    style: const TextStyle(color: AppColors.textSecondary))),
            Expanded(child: Text(value.isEmpty ? 'Not available' : value)),
          ],
        ),
      );

  String _formatDate(DateTime date) => DateFormat('dd MMM yyyy').format(date);
}
