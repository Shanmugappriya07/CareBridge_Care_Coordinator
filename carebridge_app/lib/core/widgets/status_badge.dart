import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum BadgeType {
  success,
  warning,
  danger,
  info,
  neutral,
}

class StatusBadge extends StatelessWidget {
  final String label;
  final BadgeType type;
  final IconData? icon;

  const StatusBadge({
    Key? key,
    required this.label,
    this.type = BadgeType.info,
    this.icon,
  }) : super(key: key);

  Color get _backgroundColor {
    switch (type) {
      case BadgeType.success:
        return AppColors.successLight;
      case BadgeType.warning:
        return AppColors.warningLight;
      case BadgeType.danger:
        return AppColors.dangerLight;
      case BadgeType.info:
        return AppColors.infoLight;
      case BadgeType.neutral:
        return AppColors.surfaceVariant;
    }
  }

  Color get _textColor {
    switch (type) {
      case BadgeType.success:
        return AppColors.success;
      case BadgeType.warning:
        return AppColors.warning;
      case BadgeType.danger:
        return AppColors.danger;
      case BadgeType.info:
        return AppColors.primary;
      case BadgeType.neutral:
        return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: _textColor),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: _textColor,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
