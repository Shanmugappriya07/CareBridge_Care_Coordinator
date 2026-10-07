import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_card.dart';
import '../../core/widgets/status_badge.dart';
import '../admissions/admission_model.dart';
import 'lab_report_model.dart';
import 'lab_report_service.dart';

class LabReportsScreen extends StatefulWidget {
  final Admission admission;
  final String caregiverMobile;

  const LabReportsScreen({
    super.key,
    required this.admission,
    required this.caregiverMobile,
  });

  @override
  State<LabReportsScreen> createState() => _LabReportsScreenState();
}

class _LabReportsScreenState extends State<LabReportsScreen> {
  final Set<String> _downloading = {};
  late Future<List<LabReport>> _reportsFuture;

  @override
  void initState() {
    super.initState();
    _reportsFuture = _loadReports();
  }

  @override
  void didUpdateWidget(covariant LabReportsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.admission.id != widget.admission.id ||
        oldWidget.caregiverMobile != widget.caregiverMobile) {
      _reportsFuture = _loadReports();
    }
  }

  Future<List<LabReport>> _loadReports() =>
      LabReportService.reportsForAdmission(
        widget.admission.id,
        widget.caregiverMobile,
      );

  void _retryLoad() {
    setState(() => _reportsFuture = _loadReports());
  }

  BadgeType _badgeType(String status) {
    switch (status.toLowerCase()) {
      case 'normal':
        return BadgeType.success;
      case 'critical':
        return BadgeType.danger;
      case 'elevated':
      case 'elevated (monitored)':
        return BadgeType.warning;
      default:
        return BadgeType.info;
    }
  }

  Future<void> _download(LabReport report) async {
    setState(() => _downloading.add(report.id));
    final error = await LabReportService.downloadReport(
        context, report, widget.admission);
    if (!mounted) return;
    setState(() => _downloading.remove(report.id));
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Laboratory & Diagnostic Reports'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Reports',
            onPressed: _retryLoad,
          ),
        ],
      ),
      body: FutureBuilder<List<LabReport>>(
        future: _reportsFuture,
        builder: (context, snapshot) {
          // Loading
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          // Error
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 48, color: AppColors.danger),
                    const SizedBox(height: 12),
                    Text(
                      'Failed to load reports.\n${snapshot.error}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: _retryLoad,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final reports = snapshot.data ?? [];

          // Empty state — no placeholder data, only real DB records
          if (reports.isEmpty) {
            return RefreshIndicator(
              onRefresh: () async {
                _retryLoad();
                await _reportsFuture;
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 100),
                  Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.science_outlined,
                            size: 64,
                            color: AppColors.textMuted,
                          ),
                          SizedBox(height: 16),
                          Text(
                            'No Reports Yet',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Lab and diagnostic reports will appear here\nonce they are added by the hospital.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 14, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              _retryLoad();
              await _reportsFuture;
            },
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: reports.length,
            itemBuilder: (context, index) {
              final r = reports[index];
              final isDownloading = _downloading.contains(r.id);
              final dateStr = DateFormat('dd MMM yyyy').format(r.reportDate);

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: CustomCard(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.picture_as_pdf,
                          color: AppColors.primary,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              r.title,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${r.department} • $dateStr • Ref: ${r.refNumber}',
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 6),
                            StatusBadge(
                              label: r.status,
                              type: _badgeType(r.status),
                            ),
                          ],
                        ),
                      ),
                      isDownloading
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2.5),
                              ),
                            )
                          : IconButton(
                              icon: const Icon(
                                Icons.file_download_outlined,
                                color: AppColors.primary,
                              ),
                              tooltip: 'Download PDF',
                              onPressed: () => _download(r),
                            ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
        },
      ),
    );
  }
}
