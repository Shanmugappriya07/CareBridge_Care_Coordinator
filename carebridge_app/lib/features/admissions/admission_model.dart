class Admission {
  final String id;
  final String patientId;
  final String patientName;
  final int? patientAge;
  final String gender;
  final String phone;
  final DateTime admissionDate;
  final DateTime? dischargeDate;
  final String doctor;
  final String department;
  final String roomWard;
  final String hospitalName;
  final String status;
  final String caregiverName;
  final String caregiverMobile;
  final String caregiverRelationship;
  final String primaryCaregiverName;
  final String primaryCaregiverMobile;
  final bool isReadOnly;
  final String caregiverRole;

  const Admission({
    required this.id,
    required this.patientId,
    required this.patientName,
    required this.patientAge,
    required this.gender,
    required this.phone,
    required this.admissionDate,
    this.dischargeDate,
    required this.doctor,
    required this.department,
    required this.roomWard,
    required this.hospitalName,
    required this.status,
    required this.caregiverName,
    required this.caregiverMobile,
    required this.caregiverRelationship,
    this.primaryCaregiverName = '',
    this.primaryCaregiverMobile = '',
    this.isReadOnly = false,
    this.caregiverRole = 'primary',
  });

  bool get isActive => status.toUpperCase() == 'ACTIVE';

  factory Admission.fromJson(Map<String, dynamic> data) {
    final caregiver = data['caregiver'] is Map
        ? Map<String, dynamic>.from(data['caregiver'] as Map)
        : const <String, dynamic>{};
    final primaryCaregiver = data['primaryCaregiver'] is Map
        ? Map<String, dynamic>.from(data['primaryCaregiver'] as Map)
        : const <String, dynamic>{};
    final bool readOnly = data['isReadOnly'] == true ||
        (data['role'] as String? ?? '').toUpperCase() == 'READ_ONLY' ||
        (data['caregiverRole'] as String? ?? '').toLowerCase() == 'family';
    final String cRole = data['caregiverRole'] as String? ??
        (readOnly ? 'family' : 'primary');

    final String pName =
        (primaryCaregiver['name'] as String? ?? '').trim().isNotEmpty
            ? (primaryCaregiver['name'] as String).trim()
            : (!readOnly
                ? (caregiver['caregiverName'] as String? ?? '').trim()
                : '');
    final String pMobile =
        (primaryCaregiver['phone'] as String? ?? '').trim().isNotEmpty
            ? (primaryCaregiver['phone'] as String).trim()
            : (!readOnly
                ? (caregiver['caregiverMobile'] as String? ?? '').trim()
                : '');

    return Admission(
      id: data['admissionId'] as String? ?? '',
      patientId: data['patientId'] as String? ?? '',
      patientName: data['patientName'] as String? ?? '',
      patientAge: int.tryParse(data['patientAge']?.toString() ?? ''),
      gender: data['gender'] as String? ?? '',
      phone: data['phone'] as String? ?? '',
      admissionDate: _dateValue(data['admissionDate'] as String?) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      dischargeDate: _dateValue(data['dischargeDate'] as String?),
      doctor: data['doctor'] as String? ?? '',
      department: data['department'] as String? ?? '',
      roomWard: data['room'] as String? ?? '',
      hospitalName: data['hospitalName'] as String? ?? '',
      status: (data['status'] as String? ?? 'UNKNOWN').toUpperCase(),
      caregiverName: caregiver['caregiverName'] as String? ?? '',
      caregiverMobile: caregiver['caregiverMobile'] as String? ?? '',
      caregiverRelationship: caregiver['relationship'] as String? ?? '',
      primaryCaregiverName: pName,
      primaryCaregiverMobile: pMobile,
      isReadOnly: readOnly,
      caregiverRole: cRole,
    );
  }

  Admission copyWith({
    String? id,
    String? patientId,
    String? patientName,
    int? patientAge,
    String? gender,
    String? phone,
    DateTime? admissionDate,
    DateTime? dischargeDate,
    String? doctor,
    String? department,
    String? roomWard,
    String? hospitalName,
    String? status,
    String? caregiverName,
    String? caregiverMobile,
    String? caregiverRelationship,
    String? primaryCaregiverName,
    String? primaryCaregiverMobile,
    bool? isReadOnly,
    String? caregiverRole,
  }) {
    return Admission(
      id: id ?? this.id,
      patientId: patientId ?? this.patientId,
      patientName: patientName ?? this.patientName,
      patientAge: patientAge ?? this.patientAge,
      gender: gender ?? this.gender,
      phone: phone ?? this.phone,
      admissionDate: admissionDate ?? this.admissionDate,
      dischargeDate: dischargeDate ?? this.dischargeDate,
      doctor: doctor ?? this.doctor,
      department: department ?? this.department,
      roomWard: roomWard ?? this.roomWard,
      hospitalName: hospitalName ?? this.hospitalName,
      status: status ?? this.status,
      caregiverName: caregiverName ?? this.caregiverName,
      caregiverMobile: caregiverMobile ?? this.caregiverMobile,
      caregiverRelationship: caregiverRelationship ?? this.caregiverRelationship,
      primaryCaregiverName: primaryCaregiverName ?? this.primaryCaregiverName,
      primaryCaregiverMobile: primaryCaregiverMobile ?? this.primaryCaregiverMobile,
      isReadOnly: isReadOnly ?? this.isReadOnly,
      caregiverRole: caregiverRole ?? this.caregiverRole,
    );
  }

  static DateTime? _dateValue(String? value) {
    return value == null ? null : DateTime.tryParse(value);
  }
}
