import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/admission_read_only_banner.dart';
import '../admissions/admission_model.dart';

class InsuranceScreen extends StatefulWidget {
  final Admission admission;
  final bool isReadOnly;

  const InsuranceScreen({
    super.key,
    required this.admission,
    required this.isReadOnly,
  });

  @override
  State<InsuranceScreen> createState() => _InsuranceScreenState();
}

class _InsuranceScreenState extends State<InsuranceScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Insurance'),
            Text('Admission ${widget.admission.id}',
                style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
                icon: Icon(Icons.verified_user_outlined),
                text: 'Cashless Apply'),
            Tab(
                icon: Icon(Icons.track_changes_outlined),
                text: 'Reimbursement'),
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
                _CashlessApplyTab(isReadOnly: widget.isReadOnly),
                const _ReimbursementTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Tab 1: Cashless Apply ────────────────────────────────────────────────────

class _CashlessApplyTab extends StatefulWidget {
  final bool isReadOnly;

  const _CashlessApplyTab({required this.isReadOnly});

  @override
  State<_CashlessApplyTab> createState() => _CashlessApplyTabState();
}

class _CashlessApplyTabState extends State<_CashlessApplyTab> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();
  bool _isSubmitting = false;

  // Picked file state
  String? _insuranceCopyName;
  String? _idProofName;

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  Future<void> _pickFile(String fieldType) async {
    if (widget.isReadOnly) return;

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        withData: false,
      );
      if (!widget.isReadOnly && result != null && result.files.isNotEmpty) {
        setState(() {
          if (fieldType == 'insurance') {
            _insuranceCopyName = result.files.first.name;
          } else {
            _idProofName = result.files.first.name;
          }
        });
      }
    } on PlatformException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('File pick error: ${e.message}'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  Future<void> _submit() async {
    if (widget.isReadOnly) return;
    if (!_formKey.currentState!.validate()) return;
    if (_insuranceCopyName == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please attach your insurance copy (PDF/JPG/PNG).'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }
    if (_idProofName == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please attach an ID proof document (PDF/JPG/PNG).'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    // Simulate network submission
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() => _isSubmitting = false);
    if (widget.isReadOnly) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
            'Cashless application submitted successfully! The hospital TPA team will contact you shortly.'),
        backgroundColor: AppColors.success,
        duration: Duration(seconds: 4),
      ),
    );

    // Reset form
    _formKey.currentState!.reset();
    _nameController.clear();
    _mobileController.clear();
    setState(() {
      _insuranceCopyName = null;
      _idProofName = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Info banner
            CustomCard(
              backgroundColor: AppColors.primaryLight,
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: AppColors.primary, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Submit your insurance details and documents to apply for cashless hospitalisation. '
                      'The TPA desk will process your request within 2–4 hours.',
                      style: TextStyle(
                          fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text('Applicant Details',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            // Name field
            TextFormField(
              enabled: !widget.isReadOnly,
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Full Name *',
                prefixIcon: Icon(Icons.person_outline),
                hintText: 'Enter your full name',
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Full name is required';
                }
                if (v.trim().length < 3) {
                  return 'Name must be at least 3 characters';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),

            // Mobile field
            TextFormField(
              enabled: !widget.isReadOnly,
              controller: _mobileController,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(
                labelText: 'Mobile Number *',
                prefixIcon: Icon(Icons.phone_outlined),
                prefixText: '+91  ',
                hintText: '10-digit mobile number',
                counterText: '',
              ),
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Mobile number is required';
                }
                if (v.trim().length != 10) {
                  return 'Enter a valid 10-digit mobile number';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),

            const Text('Document Uploads',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('Accepted formats: PDF, JPG, JPEG, PNG',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 14),

            // Insurance copy picker
            _FilePicker(
              label: 'Insurance Policy Copy *',
              description:
                  'Upload your health insurance card or policy document',
              icon: Icons.shield_outlined,
              fileName: _insuranceCopyName,
              enabled: !widget.isReadOnly,
              onTap: () => _pickFile('insurance'),
            ),
            const SizedBox(height: 12),

            // ID proof picker
            _FilePicker(
              label: 'ID Proof *',
              description:
                  'Aadhaar, PAN, Passport, Driving Licence or Voter ID',
              icon: Icons.badge_outlined,
              fileName: _idProofName,
              enabled: !widget.isReadOnly,
              onTap: () => _pickFile('idproof'),
            ),
            const SizedBox(height: 28),

            // Submit button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: widget.isReadOnly || _isSubmitting ? null : _submit,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : const Icon(Icons.send_outlined, size: 18),
                label: Text(_isSubmitting
                    ? 'Submitting…'
                    : 'Submit Cashless Application'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

// ─── Tab 2: Reimbursement Tracking ───────────────────────────────────────────

class _ReimbursementTab extends StatelessWidget {
  const _ReimbursementTab();

  @override
  Widget build(BuildContext context) {
    const stages = <_ReimbStage>[];
    return Column(
      children: [
        const Expanded(
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'No reimbursement records are available for this admission.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
          ),
        ),
        ...stages.map((stage) => _ReimbursementStageRow(stage: stage)),
      ],
    );
  }
}

// ─── Reimbursement stage row ──────────────────────────────────────────────────

class _ReimbStage {
  final String title;
  final String description;
  final String date;
  final bool isDone;
  final bool isCurrent;
  final bool isLast;

  const _ReimbStage({
    required this.title,
    required this.description,
    required this.date,
    required this.isDone,
    required this.isCurrent,
    required this.isLast,
  });
}

class _ReimbursementStageRow extends StatelessWidget {
  final _ReimbStage stage;

  const _ReimbursementStageRow({required this.stage});

  @override
  Widget build(BuildContext context) {
    final dotColor = stage.isDone
        ? AppColors.success
        : stage.isCurrent
            ? AppColors.warning
            : AppColors.surfaceVariant;

    final lineColor = stage.isDone ? AppColors.success : AppColors.border;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
                border: stage.isCurrent
                    ? Border.all(
                        color: AppColors.warning.withValues(alpha: 0.35),
                        width: 4)
                    : null,
              ),
              child: Icon(
                stage.isDone
                    ? Icons.check
                    : stage.isCurrent
                        ? Icons.hourglass_top
                        : Icons.circle_outlined,
                size: 15,
                color: stage.isDone || stage.isCurrent
                    ? Colors.white
                    : AppColors.textMuted,
              ),
            ),
            if (!stage.isLast)
              Container(width: 3, height: 60, color: lineColor),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        stage.title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: stage.isCurrent
                              ? FontWeight.bold
                              : FontWeight.w600,
                          color: stage.isDone || stage.isCurrent
                              ? AppColors.textPrimary
                              : AppColors.textMuted,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(stage.date,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textSecondary)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(stage.description,
                    style: TextStyle(
                        fontSize: 12,
                        color: stage.isDone || stage.isCurrent
                            ? AppColors.textSecondary
                            : AppColors.textMuted)),
                if (stage.isCurrent) ...[
                  const SizedBox(height: 8),
                  const StatusBadge(
                      label: 'In Progress', type: BadgeType.warning),
                ],
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Shared helper widgets ────────────────────────────────────────────────────

class _FilePicker extends StatelessWidget {
  final String label;
  final String description;
  final IconData icon;
  final String? fileName;
  final bool enabled;
  final VoidCallback onTap;

  const _FilePicker({
    required this.label,
    required this.description,
    required this.icon,
    required this.fileName,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasFile = fileName != null;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(
              color: hasFile ? AppColors.success : AppColors.primary,
              width: hasFile ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(12),
            color: hasFile
                ? AppColors.successLight.withValues(alpha: 0.4)
                : AppColors.primaryLight.withValues(alpha: 0.5),
          ),
          child: Row(
            children: [
              Icon(
                hasFile ? Icons.check_circle : icon,
                color: hasFile ? AppColors.success : AppColors.primary,
                size: 26,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 3),
                    Text(
                      hasFile ? fileName! : description,
                      style: TextStyle(
                          fontSize: 12,
                          color: hasFile
                              ? AppColors.success
                              : AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(
                hasFile ? Icons.edit_outlined : Icons.upload_file_outlined,
                color: hasFile ? AppColors.success : AppColors.primary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
