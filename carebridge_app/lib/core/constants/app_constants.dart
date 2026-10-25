import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum CaregiverRole {
  primary,
  family,
}

enum InsuranceStatus {
  submitted,
  underReview,
  approved,
  rejected,
  settled,
}

enum PaymentMethod {
  upi,
  debitCard,
  creditCard,
  netBanking,
}

enum PaymentStatus {
  pending,
  paid,
  failed,
  refunded,
}

class AppConstants {
  static const String appName = 'CareBridge';
  static const String appTagline =
      'Caregiver Platform for Tracking Admitted Patients';

  static String _customApiBaseUrl = '';

  /// Default URL automatically adapts based on platform:
  /// - Web / Windows / macOS / Linux: localhost:8080
  /// - Android emulator: 10.0.2.2:8080 (in-built emulator alias to laptop localhost)
  /// - Can also be set at compile time via: --dart-define=API_BASE_URL=...
  static String get defaultApiBaseUrl {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    if (kIsWeb) return 'http://localhost:8080/api/v1';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        // Android emulator in laptop maps 10.0.2.2 to laptop's 127.0.0.1 (localhost:8080)
        return 'http://10.0.2.2:8080/api/v1';
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      default:
        return 'http://localhost:8080/api/v1';
    }
  }

  static String get apiBaseUrl =>
      _customApiBaseUrl.isNotEmpty ? _customApiBaseUrl : defaultApiBaseUrl;

  static set apiBaseUrl(String url) {
    _customApiBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  static Future<void> loadCustomBaseUrl() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('carebridge_api_base_url');
      if (saved != null && saved.trim().isNotEmpty) {
        // Automatically clear stale or non-functional 127.0.0.1 / Wi-Fi IPs so emulator uses 10.0.2.2
        if (saved.contains('127.0.0.1') || saved.contains('172.20.241.82') || saved.contains('192.168.')) {
          await prefs.remove('carebridge_api_base_url');
          _customApiBaseUrl = '';
        } else {
          _customApiBaseUrl = saved.trim().replaceAll(RegExp(r'/+$'), '');
        }
      }
    } catch (_) {}
  }

  static Future<void> setAndSaveBaseUrl(String url) async {
    final cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    _customApiBaseUrl = cleanUrl;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (cleanUrl.isEmpty) {
        await prefs.remove('carebridge_api_base_url');
      } else {
        await prefs.setString('carebridge_api_base_url', cleanUrl);
      }
    } catch (_) {}
  }

  static Future<void> resetBaseUrl() async {
    _customApiBaseUrl = '';
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('carebridge_api_base_url');
    } catch (_) {}
  }

  static String getRoleName(CaregiverRole role) {
    switch (role) {
      case CaregiverRole.primary:
        return 'Primary Caregiver (Full Access)';
      case CaregiverRole.family:
        return 'Family Member (Read-Only)';
    }
  }

  static String getInsuranceStatusText(InsuranceStatus status) {
    switch (status) {
      case InsuranceStatus.submitted:
        return 'Submitted';
      case InsuranceStatus.underReview:
        return 'Under Review';
      case InsuranceStatus.approved:
        return 'Approved';
      case InsuranceStatus.rejected:
        return 'Rejected';
      case InsuranceStatus.settled:
        return 'Settled';
    }
  }
}
