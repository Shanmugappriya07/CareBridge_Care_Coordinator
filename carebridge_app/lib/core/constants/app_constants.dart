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
  static const String apiBaseUrl = 'http://10.0.2.2:8080/api/v1';

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
