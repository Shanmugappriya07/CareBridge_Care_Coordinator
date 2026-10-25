import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/status_badge.dart';
import '../admissions/admission_model.dart';

class ProfileScreen extends StatelessWidget {
  final CaregiverRole currentRole;
  final String caregiverMobile;
  final Admission admission;
  final VoidCallback onLogout;

  const ProfileScreen({
    Key? key,
    required this.currentRole,
    required this.caregiverMobile,
    required this.admission,
    required this.onLogout,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final bool isFamily =
        currentRole == CaregiverRole.family || admission.isReadOnly;

    final String activeUserName = isFamily
        ? (admission.caregiverName.isNotEmpty
            ? admission.caregiverName
            : 'Extended Family Member')
        : (admission.primaryCaregiverName.isNotEmpty
            ? admission.primaryCaregiverName
            : (admission.caregiverName.isNotEmpty
                ? admission.caregiverName
                : 'Primary Caregiver'));

    final String activeUserMobile = caregiverMobile.isNotEmpty
        ? caregiverMobile
        : (isFamily
            ? admission.caregiverMobile
            : admission.primaryCaregiverMobile);

    final String activeUserRelation = isFamily
        ? (admission.caregiverRelationship.isNotEmpty
            ? admission.caregiverRelationship
            : 'Extended Family Member')
        : (admission.caregiverRelationship.isNotEmpty
            ? admission.caregiverRelationship
            : 'Primary Caregiver');

    final String primaryName = admission.primaryCaregiverName.isNotEmpty
        ? admission.primaryCaregiverName
        : (!admission.isReadOnly && admission.caregiverName.isNotEmpty
            ? admission.caregiverName
            : 'Primary Caregiver');

    final String primaryPhone = admission.primaryCaregiverMobile.isNotEmpty
        ? admission.primaryCaregiverMobile
        : (!admission.isReadOnly && admission.caregiverMobile.isNotEmpty
            ? admission.caregiverMobile
            : 'Contact via Hospital');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile & Identity Details'),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // CARD 1: Caregiver App Account
              const Text('Caregiver App User (You)',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              CustomCard(
                child: Column(
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: isFamily
                              ? AppColors.surfaceVariant
                              : AppColors.primaryLight,
                          child: Icon(
                            isFamily ? Icons.person_outline : Icons.person,
                            size: 32,
                            color: isFamily
                                ? AppColors.textPrimary
                                : AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                activeUserName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 17),
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                '$activeUserMobile • $activeUserRelation',
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              StatusBadge(
                                label: AppConstants.getRoleName(currentRole),
                                type: isFamily
                                    ? BadgeType.neutral
                                    : BadgeType.success,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Divider(),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                            child: _ProfileIdChip(
                                label: 'Access Level',
                                val: isFamily ? 'Read-Only' : 'Full Access')),
                        const Expanded(
                            child: _ProfileIdChip(
                                label: 'Phone Auth', val: 'Verified')),
                        const Expanded(
                            child: _ProfileIdChip(
                                label: 'Session', val: 'Active')),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // CARD 2: Primary Caregiver (Shown when logged in as an Extended Family Member)
              if (isFamily) ...[
                const Text('Primary Caregiver for Patient',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                CustomCard(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(
                      backgroundColor: AppColors.primaryLight,
                      child: Icon(Icons.star, color: AppColors.primary),
                    ),
                    title: Text(
                      primaryName,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '$primaryPhone • Primary Decision Maker',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                    ),
                    trailing: const StatusBadge(
                      label: 'Primary',
                      type: BadgeType.success,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // CARD 3: Admitted Patient Details
              const Text('Admitted Patient Details',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              CustomCard(
                backgroundColor: AppColors.surface,
                border: Border.all(color: AppColors.primary, width: 1.5),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const CircleAvatar(
                          radius: 26,
                          backgroundColor: AppColors.primaryLight,
                          child: Icon(Icons.local_hospital,
                              size: 30, color: AppColors.primary),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                admission.patientName.isEmpty
                                    ? 'Patient details unavailable'
                                    : admission.patientName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 18),
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                'Age: ${admission.patientAge ?? 'N/A'} • ${admission.gender.isEmpty ? 'N/A' : admission.gender}',
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        StatusBadge(
                          label: admission.isActive ? 'Admitted' : 'Discharged',
                          type: admission.isActive
                              ? BadgeType.success
                              : BadgeType.neutral,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Divider(),
                    const SizedBox(height: 8),
                    _SettingRow('Patient ID', admission.patientId),
                    const Divider(),
                    _SettingRow('Patient Phone Number', admission.phone),
                    const Divider(),
                    _SettingRow('Hospital Admission ID', admission.id),
                    const Divider(),
                    _SettingRow('Hospital & Ward',
                        '${admission.hospitalName} (${admission.roomWard})'),
                    const Divider(),
                    _SettingRow('Attending Doctor', admission.doctor),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                  ),
                  onPressed: onLogout,
                  icon: const Icon(Icons.logout),
                  label: const Text('Sign Out Caregiver Account'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileIdChip extends StatelessWidget {
  final String label;
  final String val;

  const _ProfileIdChip({Key? key, required this.label, required this.val})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style:
                const TextStyle(fontSize: 10, color: AppColors.textSecondary),
            overflow: TextOverflow.ellipsis),
        Text(val,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: AppColors.primary),
            overflow: TextOverflow.ellipsis),
      ],
    );
  }
}

class _SettingRow extends StatelessWidget {
  final String title;
  final String val;

  const _SettingRow(this.title, this.val, {Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(title,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 13)),
          ),
          Text(val,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              textAlign: TextAlign.end),
        ],
      ),
    );
  }
}
