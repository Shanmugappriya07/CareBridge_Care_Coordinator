import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/constants/app_constants.dart';
import 'features/auth/auth_screen.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/treatment_timeline/treatment_timeline_screen.dart';
import 'features/lab_reports/lab_reports_screen.dart';
import 'features/prescriptions/prescriptions_screen.dart';
import 'features/billing/billing_screen.dart';
import 'features/insurance/insurance_screen.dart';
import 'features/family_access/family_access_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/hospital_navigation/hospital_navigation_screen.dart';
import 'features/splash/splash_screen.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'features/admissions/admission_model.dart';
import 'features/admissions/admission_selection_screen.dart';
import 'features/documents/documents_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const CareBridgeApp());
}

class CareBridgeApp extends StatefulWidget {
  const CareBridgeApp({super.key});

  @override
  State<CareBridgeApp> createState() => _CareBridgeAppState();
}

class _CareBridgeAppState extends State<CareBridgeApp> {
  bool _showSplash = true;
  bool _isAuthenticated = false;
  int _currentIndex = 0;
  CaregiverRole _currentRole = CaregiverRole.primary;
  String _caregiverMobile = '';
  Admission? _selectedAdmission;

  void _handleLoginSuccess(CaregiverRole role, String mobile) {
    setState(() {
      _currentRole = role;
      _caregiverMobile = mobile;
      _isAuthenticated = true;
      _selectedAdmission = null;
    });
  }

  void _handleAdmissionSelected(Admission admission) {
    setState(() {
      _selectedAdmission = admission;
      _currentRole = admission.isReadOnly ? CaregiverRole.family : CaregiverRole.primary;
      _currentIndex = 0;
    });
  }

  void _switchAdmission() {
    setState(() {
      _selectedAdmission = null;
      _currentIndex = 0;
    });
  }

  void _completeSplash() {
    if (mounted) {
      setState(() => _showSplash = false);
    }
  }

  void _replayLogoTransition() {
    if (!_showSplash) {
      setState(() => _showSplash = true);
    }
  }

  void _handleRoleSwitch(CaregiverRole newRole) {
    setState(() {
      _currentRole = newRole;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 450),
        switchInCurve: Curves.easeOut,
        switchOutCurve: Curves.easeIn,
        child: _showSplash
            ? SplashScreen(
                key: const ValueKey('splash'),
                onComplete: _completeSplash,
              )
            : _isAuthenticated && _selectedAdmission == null
                ? AdmissionSelectionScreen(
                    key: const ValueKey('admission-selection'),
                    caregiverMobile: _caregiverMobile,
                    onAdmissionSelected: _handleAdmissionSelected,
                  )
                : _isAuthenticated
                    ? PopScope(
                        key: const ValueKey('authenticated'),
                        canPop: _currentIndex == 0,
                        onPopInvokedWithResult: (didPop, result) {
                          if (!didPop && _currentIndex != 0) {
                            setState(() => _currentIndex = 0);
                          }
                        },
                        child: Scaffold(
                          body: IndexedStack(
                            index: _currentIndex,
                            children: [
                              DashboardScreen(
                                currentRole: _currentRole,
                                admission: _selectedAdmission!,
                                caregiverMobile: _caregiverMobile,
                                isReadOnly: _currentRole == CaregiverRole.family || _selectedAdmission!.isReadOnly,
                                onNavigate: (index) =>
                                    setState(() => _currentIndex = index),
                                onAdmissionUpdated: (updated) =>
                                    setState(() {
                                      _selectedAdmission = updated;
                                      if (updated.isReadOnly) {
                                        _currentRole = CaregiverRole.family;
                                      }
                                    }),
                                onLogoTap: _replayLogoTransition,
                                onSwitchAdmission: _switchAdmission,
                              ),
                              TreatmentTimelineScreen(
                                admission: _selectedAdmission!,
                                caregiverMobile: _caregiverMobile,
                              ),
                              LabReportsScreen(
                                admission: _selectedAdmission!,
                                caregiverMobile: _caregiverMobile,
                              ),
                              PrescriptionsScreen(
                                admission: _selectedAdmission!,
                                caregiverMobile: _caregiverMobile,
                                isReadOnly: _currentRole == CaregiverRole.family || _selectedAdmission!.isReadOnly,
                              ),
                              InsuranceScreen(
                                admission: _selectedAdmission!,
                                isReadOnly: _currentRole == CaregiverRole.family || _selectedAdmission!.isReadOnly,
                              ),
                              BillingScreen(
                                currentRole: _currentRole,
                                admission: _selectedAdmission!,
                              ),
                              FamilyAccessScreen(
                                currentRole: _currentRole,
                                isReadOnly: _currentRole == CaregiverRole.family || _selectedAdmission!.isReadOnly,
                                admission: _selectedAdmission!,
                                onRoleSwitched: _handleRoleSwitch,
                                caregiverMobile: _caregiverMobile,
                              ),
                              NotificationsScreen(
                                admission: _selectedAdmission!,
                                caregiverMobile: _caregiverMobile,
                              ),
                              ProfileScreen(
                                currentRole: _currentRole,
                                caregiverMobile: _caregiverMobile,
                                admission: _selectedAdmission!,
                                onLogout: () => setState(() {
                                  _isAuthenticated = false;
                                  _selectedAdmission = null;
                                  _caregiverMobile = '';
                                }),
                              ),
                              HospitalNavigationScreen(
                                admission: _selectedAdmission!,
                              ),
                              DocumentsScreen(
                                admissionId: _selectedAdmission!.id,
                                caregiverMobile: _caregiverMobile,
                              ),
                            ],
                          ),
                          bottomNavigationBar: BottomNavigationBar(
                            currentIndex: _currentIndex > 4 ? 0 : _currentIndex,
                            onTap: (index) => setState(() => _currentIndex = index),
                            items: const [
                              BottomNavigationBarItem(
                                icon: Icon(Icons.dashboard_outlined),
                                activeIcon: Icon(Icons.dashboard),
                                label: 'Dashboard',
                              ),
                              BottomNavigationBarItem(
                                icon: Icon(Icons.timeline),
                                label: 'Timeline',
                              ),
                              BottomNavigationBarItem(
                                icon: Icon(Icons.science_outlined),
                                activeIcon: Icon(Icons.science),
                                label: 'Reports',
                              ),
                              BottomNavigationBarItem(
                                icon: Icon(Icons.medication_outlined),
                                activeIcon: Icon(Icons.medication),
                                label: 'Pharmacy',
                              ),
                              BottomNavigationBarItem(
                                icon: Icon(Icons.shield_outlined),
                                activeIcon: Icon(Icons.shield),
                                label: 'Insurance',
                              ),
                            ],
                          ),
                        ),
                      )
                    : AuthScreen(
                        key: const ValueKey('auth'),
                        onLoginSuccess: _handleLoginSuccess,
                      ),
      ),
    );
  }
}
