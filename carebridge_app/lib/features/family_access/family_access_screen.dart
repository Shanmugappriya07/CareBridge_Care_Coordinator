import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/admission_read_only_banner.dart';
import '../admissions/admission_model.dart';
import '../admissions/admission_service.dart';

class FamilyAccessScreen extends StatefulWidget {
  final CaregiverRole currentRole;
  final bool isReadOnly;
  final Admission admission;
  final Function(CaregiverRole newRole) onRoleSwitched;
  final String? caregiverMobile;

  const FamilyAccessScreen({
    Key? key,
    required this.currentRole,
    required this.isReadOnly,
    required this.admission,
    required this.onRoleSwitched,
    this.caregiverMobile,
  }) : super(key: key);

  @override
  State<FamilyAccessScreen> createState() => _FamilyAccessScreenState();
}

class _FamilyAccessScreenState extends State<FamilyAccessScreen> {
  List<Map<String, String>> _familyMembers = [];
  bool _isLoading = true;
  bool _isSaving = false;

  final _invitePhoneController = TextEditingController();
  final _inviteNameController = TextEditingController();

  String get _activeMobile =>
      (widget.caregiverMobile != null && widget.caregiverMobile!.isNotEmpty)
          ? widget.caregiverMobile!
          : widget.admission.caregiverMobile;

  @override
  void initState() {
    super.initState();
    _loadFamilyMembers();
  }

  Future<void> _loadFamilyMembers() async {
    setState(() => _isLoading = true);
    try {
      final list = await AdmissionService.getFamilyMembers(
        widget.admission.id,
        _activeMobile,
      );
      if (!mounted) return;
      setState(() {
        _familyMembers = list.map((item) => {
          'id': item['id']?.toString() ?? '',
          'name': item['name']?.toString() ?? '',
          'phone': item['phone']?.toString() ?? '',
          'relation': item['relation']?.toString() ?? 'Extended Family Member',
          'role': item['role']?.toString() ?? 'Extended Family Member (Read-Only)',
          'isPrimary': item['isPrimary']?.toString() ?? 'false',
        }).toList();
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  Future<void> _revokeFamilyMember(int index, String phone) async {
    if (widget.isReadOnly) return;
    try {
      await AdmissionService.removeFamilyMember(
        admissionId: widget.admission.id,
        caregiverMobile: _activeMobile,
        memberPhone: phone,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Family access revoked')),
      );
      _loadFamilyMembers();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to revoke access: $e')),
      );
    }
  }

  void _showInviteModal() {
    if (widget.isReadOnly) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(modalContext).viewInsets.bottom,
                left: 20,
                right: 20,
                top: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Add Extended Family Member',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text(
                      'As the Primary Caregiver, enter their name and mobile number to grant them Read-Only access to the patient timeline, reports, & prescriptions.',
                      style:
                          TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _inviteNameController,
                    decoration: const InputDecoration(
                        labelText: 'Full Name', prefixIcon: Icon(Icons.person)),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _invitePhoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                        labelText: 'Mobile Number (+91)',
                        prefixIcon: Icon(Icons.phone)),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isSaving
                          ? null
                          : () async {
                              if (widget.isReadOnly) return;
                              final name = _inviteNameController.text.trim();
                              final phone = _invitePhoneController.text.trim();
                              if (name.isEmpty || phone.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Please enter both name and mobile number.')),
                                );
                                return;
                              }

                              String cleanDigits(String p) =>
                                  p.replaceAll(RegExp(r'\D'), '');
                              final enteredDigits = cleanDigits(phone);
                              final primaryPhone = widget.admission.primaryCaregiverMobile.isNotEmpty
                                  ? widget.admission.primaryCaregiverMobile
                                  : widget.admission.caregiverMobile;
                              final primaryDigits = cleanDigits(primaryPhone);
                              final activeDigits = cleanDigits(_activeMobile);

                              final entered10 = enteredDigits.length >= 10
                                  ? enteredDigits.substring(enteredDigits.length - 10)
                                  : enteredDigits;
                              final primary10 = primaryDigits.length >= 10
                                  ? primaryDigits.substring(primaryDigits.length - 10)
                                  : primaryDigits;
                              final active10 = activeDigits.length >= 10
                                  ? activeDigits.substring(activeDigits.length - 10)
                                  : activeDigits;

                              if (entered10.isNotEmpty &&
                                  (entered10 == primary10 || entered10 == active10)) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                        'Cannot add the Primary Caregiver as an extended family member. Please enter the family member’s unique mobile number.'),
                                  ),
                                );
                                return;
                              }

                              final messenger = ScaffoldMessenger.of(context);
                              final navigator = Navigator.of(modalContext);

                              setModalState(() => _isSaving = true);
                              try {
                                await AdmissionService.addFamilyMember(
                                  admissionId: widget.admission.id,
                                  caregiverMobile: _activeMobile,
                                  name: name,
                                  phone: phone,
                                  relation: 'Extended Family Member',
                                );
                                if (!mounted) return;
                                _inviteNameController.clear();
                                _invitePhoneController.clear();
                                navigator.pop();
                                messenger.showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Extended family member added — access granted!')),
                                );
                                _loadFamilyMembers();
                              } catch (e) {
                                if (modalContext.mounted) {
                                  setModalState(() => _isSaving = false);
                                }
                                messenger.showSnackBar(
                                  SnackBar(
                                      content: Text(
                                          'Failed to add family member: $e')),
                                );
                              }
                            },
                      child: _isSaving
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Grant Extended Family Access'),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            );
          },
        );
      },
    ).whenComplete(() {
      _isSaving = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isPrimary = widget.currentRole == CaregiverRole.primary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Extended Family Access'),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.isReadOnly) ...[
                const AdmissionReadOnlyBanner(),
                const SizedBox(height: 12),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Text('Extended Family Members',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold),
                        overflow: TextOverflow.ellipsis),
                  ),
                  const SizedBox(width: 8),
                  if (isPrimary)
                    OutlinedButton.icon(
                      onPressed: widget.isReadOnly ? null : _showInviteModal,
                      icon: const Icon(Icons.person_add_alt_1, size: 18),
                      label: const Text('Add Family'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              CustomCard(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const CircleAvatar(
                    backgroundColor: AppColors.primaryLight,
                    child: Icon(Icons.person, color: AppColors.primary),
                  ),
                  title: Text(
                    widget.admission.primaryCaregiverName.isNotEmpty
                        ? widget.admission.primaryCaregiverName
                        : (!widget.isReadOnly && widget.admission.caregiverName.isNotEmpty
                            ? widget.admission.caregiverName
                            : 'Primary Caregiver'),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    '${widget.admission.primaryCaregiverMobile.isNotEmpty ? widget.admission.primaryCaregiverMobile : (!widget.isReadOnly && widget.admission.caregiverMobile.isNotEmpty ? widget.admission.caregiverMobile : 'Mobile unavailable')} • Primary Caregiver',
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: const StatusBadge(
                    label: 'Primary',
                    type: BadgeType.success,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_familyMembers.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                    child: Text(
                      'No additional family members are available.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _familyMembers.length,
                  itemBuilder: (context, index) {
                    final mem = _familyMembers[index];
                    final isMemPrimary = mem['isPrimary'] == 'true';

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: CustomCard(
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: isMemPrimary
                                  ? AppColors.primary
                                  : AppColors.surfaceVariant,
                              child: Icon(
                                isMemPrimary
                                    ? Icons.star
                                    : Icons.person_outline,
                                color: isMemPrimary
                                    ? Colors.white
                                    : AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(mem['name']!,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15),
                                      overflow: TextOverflow.ellipsis),
                                  const SizedBox(height: 2),
                                  Text('${mem['phone']} • ${mem['relation']}',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis),
                                  const SizedBox(height: 6),
                                  StatusBadge(
                                    label: mem['role']!,
                                    type: isMemPrimary
                                        ? BadgeType.success
                                        : BadgeType.neutral,
                                  ),
                                ],
                              ),
                            ),
                            if (isPrimary && !isMemPrimary)
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline,
                                    color: AppColors.danger),
                                onPressed: widget.isReadOnly
                                    ? null
                                    : () => _revokeFamilyMember(
                                        index, mem['phone']!),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
