import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/admission_read_only_banner.dart';
import '../admissions/admission_model.dart';
import '../admissions/admission_service.dart';
import '../treatment_timeline/schedule_model.dart';
import '../notifications/notification_model.dart';

class DashboardScreen extends StatefulWidget {
  final CaregiverRole currentRole;
  final Admission admission;
  final String caregiverMobile;
  final bool isReadOnly;
  final Function(int index) onNavigate;
  final ValueChanged<Admission> onAdmissionUpdated;
  final VoidCallback onLogoTap;
  final VoidCallback onSwitchAdmission;

  const DashboardScreen({
    super.key,
    required this.currentRole,
    required this.admission,
    required this.caregiverMobile,
    required this.isReadOnly,
    required this.onNavigate,
    required this.onAdmissionUpdated,
    required this.onLogoTap,
    required this.onSwitchAdmission,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _refreshInProgress = false;
  List<ScheduleEvent>? _schedules;
  bool _scheduleLoading = true;
  bool _scheduleLoadFailed = false;

  List<PatientNotification> _notifications = [];
  bool _hasUnreadNotifications = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void didUpdateWidget(covariant DashboardScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.admission.id != widget.admission.id ||
        oldWidget.caregiverMobile != widget.caregiverMobile) {
      _loadData();
    }
  }

  Future<void> _loadData() async {
    await Future.wait([
      _loadSchedules(),
      _loadNotifications(),
    ]);
  }

  Future<void> _loadNotifications() async {
    try {
      final notes = await AdmissionService.getNotifications(
        widget.admission.id,
        widget.caregiverMobile,
      );
      if (!mounted) return;
      setState(() {
        _notifications = notes;
        _hasUnreadNotifications = notes.any((n) => !n.isRead);
      });
    } catch (e) {
      debugPrint('[Dashboard] Notification load failed: $e');
    }
  }

  ScheduleEvent? get _nextSchedule {
    for (final schedule in _schedules ?? const <ScheduleEvent>[]) {
      if (schedule.status == 'SCHEDULED') return schedule;
    }
    return null;
  }

  Future<void> _loadSchedules() async {
    setState(() => _scheduleLoading = true);
    try {
      final schedules = await AdmissionService.getSchedules(
        widget.admission.id,
        widget.caregiverMobile,
      );
      if (!mounted) return;
      setState(() {
        _schedules = schedules;
        _scheduleLoading = false;
        _scheduleLoadFailed = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _schedules = const [];
        _scheduleLoading = false;
        _scheduleLoadFailed = true;
      });
    }
  }

  Future<void> _refreshDashboard() async {
    await Future.wait([_refreshAdmission(), _loadData()]);
  }

  Future<void> _refreshAdmission() async {
    if (_refreshInProgress) return;
    _refreshInProgress = true;
    try {
      final latest = await AdmissionService.getAdmission(
        widget.admission.id,
        widget.caregiverMobile,
      );
      if (!mounted) return;
      if (latest.id == widget.admission.id) {
        widget.onAdmissionUpdated(latest);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Admission details could not be refreshed.')),
        );
      }
    } finally {
      _refreshInProgress = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final admission = widget.admission;
    final isReadOnly = widget.isReadOnly;
    final onNavigate = widget.onNavigate;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/carebridge_logo.png',
              width: 32,
              height: 32,
              errorBuilder: (context, error, stackTrace) =>
                  const Icon(Icons.favorite, color: Colors.red),
            ),
            const SizedBox(width: 8),
            const Text(AppConstants.appName),
          ],
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none_outlined),
                tooltip: 'Notifications',
                onPressed: () => onNavigate(7),
              ),
              if (_hasUnreadNotifications)
                Positioned(
                  right: 12,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 8,
                      minHeight: 8,
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: 'Profile',
            onPressed: () => onNavigate(8),
          ),
          IconButton(
            icon: const Icon(Icons.swap_horiz),
            tooltip: 'Switch Admission',
            onPressed: widget.onSwitchAdmission,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshDashboard,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Admitted Patient Demographics Card
              CustomCard(
                backgroundColor: AppColors.primary,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const CircleAvatar(
                          backgroundColor: Colors.white24,
                          radius: 22,
                          child:
                              Icon(Icons.person, color: Colors.white, size: 26),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              admission.patientName.isEmpty
                                  ? 'Patient details unavailable'
                                  : admission.patientName,
                              style: const TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              'Age: ${admission.patientAge ?? 'N/A'} • ${admission.gender.isEmpty ? 'N/A' : admission.gender}',
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.white70),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Divider(color: Colors.white24, height: 1),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _PatientInfoChip(
                            label: 'Patient ID',
                            val: admission.patientId.isEmpty ? 'N/A' : admission.patientId),
                        _PatientInfoChip(
                            label: 'Admission ID', val: admission.id),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _PatientInfoChip(
                            label: 'Room / Ward', val: admission.roomWard),
                        _PatientInfoChip(
                            label: 'Attending Doctor',
                            val: admission.doctor.isEmpty ? 'Attending Physician' : admission.doctor),
                      ],
                    ),
                  ],
                ),
              ),
              if (isReadOnly) ...[
                const SizedBox(height: 12),
                const AdmissionReadOnlyBanner(),
              ],
              const SizedBox(height: 24),
              Text(
                '${admission.department} • ${admission.doctor}',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 12),

              // Quick Access Modules Grid
              const Text(
                'Quick Access',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 0.85,
                children: [
                  _QuickAccessItem(
                    icon: Icons.timeline,
                    label: 'Timeline',
                    color: const Color(0xFF5C6BC0),
                    onTap: () => onNavigate(1),
                  ),
                  _QuickAccessItem(
                    icon: Icons.science_outlined,
                    label: 'Reports',
                    color: const Color(0xFF26A69A),
                    onTap: () => onNavigate(2),
                  ),
                  _QuickAccessItem(
                    icon: Icons.medication_outlined,
                    label: 'Pharmacy',
                    color: const Color(0xFF66BB6A),
                    onTap: () => onNavigate(3),
                  ),
                  _QuickAccessItem(
                    icon: Icons.shield_outlined,
                    label: 'Insurance',
                    color: const Color(0xFFAB47BC),
                    onTap: () => onNavigate(4),
                  ),
                  _QuickAccessItem(
                    icon: Icons.receipt_long_outlined,
                    label: 'Billing',
                    color: const Color(0xFFAB47BC),
                    onTap: () => onNavigate(5),
                  ),
                  _QuickAccessItem(
                    icon: Icons.group_outlined,
                    label: 'Family',
                    color: const Color(0xFF29B6F6),
                    onTap: () => onNavigate(6),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Next Appointment Card
              const Text(
                'Upcoming Schedule',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              CustomCard(
                backgroundColor: AppColors.infoLight.withOpacity(0.3),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.event, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Next Doctor Visit',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w600)),
                          Text(
                              _scheduleLoading
                                  ? 'Loading schedule...'
                                  : _scheduleLoadFailed
                                      ? 'Schedule unavailable'
                                      : _nextSchedule == null
                                          ? 'No scheduled visits available'
                                          : '${DateFormat('dd MMM yyyy').format(_nextSchedule!.eventDate)} at ${_nextSchedule!.appointmentTime}',
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.bold)),
                          if (_nextSchedule != null)
                            Text(
                              '${_nextSchedule!.appointmentType} • ${_nextSchedule!.doctor}${_nextSchedule!.room.isEmpty ? '' : ' • ${_nextSchedule!.room}'}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.textSecondary),
                            ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => onNavigate(1),
                      child: const Text('View Timeline'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickAccessItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAccessItem({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.1), width: 1),
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, color: color, size: 24),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: Icon(
                Icons.arrow_outward,
                size: 14,
                color: color.withOpacity(0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PatientInfoChip extends StatelessWidget {
  final String label;
  final String val;

  const _PatientInfoChip({required this.label, required this.val});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
        const SizedBox(height: 2),
        Text(val,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 14)),
      ],
    );
  }
}
