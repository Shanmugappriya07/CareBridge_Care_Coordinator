import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'custom_card.dart';

class AdmissionReadOnlyBanner extends StatelessWidget {
  final String? message;
  const AdmissionReadOnlyBanner({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return CustomCard(
      backgroundColor: AppColors.infoLight.withValues(alpha: 0.3),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message ?? 'This admission is in read-only mode.',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
