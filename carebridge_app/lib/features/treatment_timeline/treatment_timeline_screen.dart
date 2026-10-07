import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/admission_read_only_banner.dart';
import '../admissions/admission_model.dart';
import '../admissions/admission_service.dart';
import 'observation_model.dart';
import 'schedule_model.dart';

class TreatmentTimelineScreen extends StatefulWidget {
  final Admission admission;
  final String caregiverMobile;

  const TreatmentTimelineScreen({
    super.key,
    required this.admission,
    required this.caregiverMobile,
  });

  @override
  State<TreatmentTimelineScreen> createState() =>
      _TreatmentTimelineScreenState();
}

class _TreatmentTimelineScreenState extends State<TreatmentTimelineScreen> {
  List<Observation>? _observations;
  bool _isLoading = true;
  bool _loadFailed = false;
  bool _refreshInProgress = false;
  int _requestId = 0;
  List<ScheduleEvent>? _schedules;
  bool _isScheduleLoading = true;
  bool _scheduleLoadFailed = false;
  bool _scheduleRefreshInProgress = false;
  int _scheduleRequestId = 0;

  @override
  void initState() {
    super.initState();
    _fetchObservations();
    _fetchSchedules();
  }

  @override
  void didUpdateWidget(covariant TreatmentTimelineScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.admission.id != widget.admission.id ||
        oldWidget.caregiverMobile != widget.caregiverMobile) {
      _requestId++;
      _refreshInProgress = false;
      _observations = null;
      _isLoading = true;
      _loadFailed = false;
      _fetchObservations();
      _scheduleRequestId++;
      _scheduleRefreshInProgress = false;
      _schedules = null;
      _isScheduleLoading = true;
      _scheduleLoadFailed = false;
      _fetchSchedules();
    }
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      _fetchObservations(fromRefresh: true),
      _fetchSchedules(fromRefresh: true)
    ]);
  }

  Future<void> _fetchObservations({bool fromRefresh = false}) async {
    if (_refreshInProgress) return;
    _refreshInProgress = true;
    final requestId = ++_requestId;
    try {
      final observations = await AdmissionService.getObservations(
        widget.admission.id,
        widget.caregiverMobile,
      );
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _observations = observations;
        _isLoading = false;
        _loadFailed = false;
      });
    } catch (_) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _isLoading = false;
        _loadFailed = _observations == null;
      });
      if (fromRefresh || _observations != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Observations could not be refreshed.')),
        );
      }
    } finally {
      if (requestId == _requestId) _refreshInProgress = false;
    }
  }

  Future<void> _fetchSchedules({bool fromRefresh = false}) async {
    if (_scheduleRefreshInProgress) return;
    _scheduleRefreshInProgress = true;
    final requestId = ++_scheduleRequestId;
    try {
      final schedules = await AdmissionService.getSchedules(
        widget.admission.id,
        widget.caregiverMobile,
      );
      if (!mounted || requestId != _scheduleRequestId) return;
      setState(() {
        _schedules = schedules;
        _isScheduleLoading = false;
        _scheduleLoadFailed = false;
      });
    } catch (_) {
      if (!mounted || requestId != _scheduleRequestId) return;
      setState(() {
        _isScheduleLoading = false;
        _scheduleLoadFailed = _schedules == null;
      });
      if (fromRefresh || _schedules != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Schedule could not be refreshed.')),
        );
      }
    } finally {
      if (requestId == _scheduleRequestId) _scheduleRefreshInProgress = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Treatment Timeline'),
      ),
      body: RefreshIndicator(
        onRefresh: _refreshAll,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.admission.status == 'DISCHARGED')
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: AdmissionReadOnlyBanner(),
                ),
              // Next Scheduled Visit Section
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: CustomCard(
                  backgroundColor: AppColors.infoLight.withOpacity(0.5),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.event_note, color: AppColors.info),
                          SizedBox(width: 8),
                          Text(
                            'Next Scheduled Doctor Visit',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (_isScheduleLoading && _schedules == null)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (_scheduleLoadFailed && _schedules == null)
                        const Text(
                          'Schedule could not be loaded. Pull to refresh.',
                          style: TextStyle(
                              fontSize: 13, color: AppColors.textSecondary),
                        )
                      else if (_schedules!.isEmpty)
                        const Text(
                          'No scheduled visits are available for this admission.',
                          style: TextStyle(
                              fontSize: 13, color: AppColors.textSecondary),
                        )
                      else
                        ..._schedules!.map(_scheduleItem),
                    ],
                  ),
                ),
              ),

              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  'Visit History & Summaries',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),

              if (_isLoading && _observations == null)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_loadFailed && _observations == null)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child:
                      Center(child: Text('Observations could not be loaded.')),
                )
              else if (_observations!.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: Text('No observations recorded yet.')),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _observations!.length,
                  itemBuilder: (context, index) => _observationItem(
                    _observations![index],
                    isLast: index == _observations!.length - 1,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _scheduleItem(ScheduleEvent schedule) {
    final badgeType = schedule.status == 'CANCELLED'
        ? BadgeType.warning
        : schedule.status == 'COMPLETED'
            ? BadgeType.success
            : BadgeType.info;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${DateFormat('EEE, dd MMM yyyy').format(schedule.eventDate)} at ${schedule.appointmentTime}',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              StatusBadge(label: schedule.status, type: badgeType),
            ],
          ),
          const SizedBox(height: 4),
          Text('${schedule.doctor} • ${schedule.department}',
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary)),
          Text(schedule.appointmentType,
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
          if (schedule.room.isNotEmpty)
            Text(schedule.room,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  Widget _observationItem(Observation observation, {required bool isLast}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
              if (!isLast)
                Container(width: 2, height: 140, color: AppColors.border),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: CustomCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          DateFormat('dd MMM yyyy, hh:mm a')
                              .format(observation.createdAt.toLocal()),
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      StatusBadge(
                        label: observation.department,
                        type: BadgeType.info,
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    observation.doctorName,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Visit Summary:',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    observation.note,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Vitals Captured:',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          observation.vitals,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
