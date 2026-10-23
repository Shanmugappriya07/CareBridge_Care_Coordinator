import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_card.dart';
import '../admissions/admission_service.dart';

class AuthScreen extends StatefulWidget {
  final void Function(CaregiverRole role, String mobile) onLoginSuccess;

  const AuthScreen({super.key, required this.onLoginSuccess});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  static const _splashTeal = Color(0xFF98D5CD);
  static const _splashTealInk = Color(0xFF276D67);

  final _phoneController = TextEditingController(text: '+919876543210');
  final _otpController = TextEditingController();

  bool _otpSent = false;
  bool _isLoading = false;
  String? _developmentOtp;
  final CaregiverRole _detectedRole = CaregiverRole.primary;

  Timer? _timer;
  int _secondsRemaining = 30;
  bool _canResend = false;

  @override
  void dispose() {
    _timer?.cancel();
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  void _startTimer() {
    setState(() {
      _secondsRemaining = 30;
      _canResend = false;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          if (_secondsRemaining > 0) {
            _secondsRemaining--;
          } else {
            _canResend = true;
            _timer?.cancel();
          }
        });
      }
    });
  }

  String _normalizedMobile(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    final nationalNumber = digits.length == 12 && digits.startsWith('91')
        ? digits.substring(2)
        : digits;

    if (nationalNumber.length == 10) {
      return '+91$nationalNumber';
    }
    return value.trim();
  }

  Future<void> _sendOtp() async {
    final phone = _normalizedMobile(_phoneController.text);

    if (!phone.startsWith('+') ||
        phone.replaceAll(RegExp(r'\D'), '').length < 8) {
      _showMessage(
          'Enter a valid phone number with country code, e.g. +919876543210');
      return;
    }

    setState(() => _isLoading = true);
    setState(() {
      _isLoading = true;
      _developmentOtp = null;
    });
    try {
      final result = await AdmissionService.sendOtp(phone);
      if (!mounted) return;
      setState(() {
        _otpSent = true;
        _isLoading = false;
        _developmentOtp = kDebugMode && result.developmentOnly
            ? result.otp
            : null;
        if (result.developmentOnly && result.otp != null) {
          _otpController.text = result.otp!;
        }
      });
      _startTimer();
      _showMessage('OTP sent to $phone');
    } catch (error) {
      if (mounted) {
        setState(() => _isLoading = false);
        final errText = error.toString();
        if (errText.contains('timed out') ||
            errText.contains('TimeoutException') ||
            errText.contains('Cannot connect') ||
            errText.contains('SocketException')) {
          _showConnectionErrorDialog(errText);
        } else {
          _showMessage('Could not send OTP: $error');
        }
      }
    }
  }

  Future<void> _verifyOtp() async {
    final phone = _normalizedMobile(_phoneController.text);
    final code = _otpController.text.trim();
    if (code.length != 6) {
      _showMessage('Enter the 6-digit OTP sent to your phone.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AdmissionService.verifyOtp(phone, code);
      if (mounted) {
        widget.onLoginSuccess(_detectedRole, phone);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _isLoading = false);
        final errText = error.toString();
        if (errText.contains('timed out') ||
            errText.contains('TimeoutException') ||
            errText.contains('Cannot connect') ||
            errText.contains('SocketException')) {
          _showConnectionErrorDialog(errText);
        } else {
          _showMessage('Could not verify OTP: $error');
        }
      }
    }
  }

  void _showConnectionErrorDialog(String details) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.wifi_off, color: Colors.redAccent),
            SizedBox(width: 8),
            Text('Server Connection Timeout', style: TextStyle(fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Could not reach the CareBridge backend server within 15 seconds.',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Text(
                'Endpoint:\n${AppConstants.apiBaseUrl}',
                style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Resolution:\n'
              '• If using a Physical Phone: 10.0.2.2 cannot route to your PC. Tap "Server Settings" below to set your PC\'s Wi-Fi IP (e.g. http://172.20.241.82:8080/api/v1).\n'
              '• If using an Android Emulator: Make sure the backend server is running on port 8080.\n'
              '• If testing on Web/Desktop: Use http://localhost:8080/api/v1.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Dismiss'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: _splashTeal,
              foregroundColor: _splashTealInk,
            ),
            icon: const Icon(Icons.settings, size: 16),
            label: const Text('Server Settings'),
            onPressed: () {
              Navigator.pop(ctx);
              _showServerConfigDialog();
            },
          ),
        ],
      ),
    );
  }

  void _showServerConfigDialog() {
    final controller = TextEditingController(text: AppConstants.apiBaseUrl);
    String testStatus = '';
    bool testing = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              title: const Row(
                children: [
                  Icon(Icons.dns, color: _splashTealInk),
                  SizedBox(width: 8),
                  Text('Server Settings', style: TextStyle(fontSize: 18)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Configure backend API URL for CareBridge:',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: controller,
                      decoration: const InputDecoration(
                        labelText: 'API Base URL',
                        hintText: 'http://172.20.241.82:8080/api/v1',
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Quick Presets:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        ActionChip(
                          label: const Text('Wi-Fi IP (172.20.241.82)', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            setDialogState(() {
                              controller.text = 'http://172.20.241.82:8080/api/v1';
                              testStatus = '';
                            });
                          },
                        ),
                        ActionChip(
                          label: const Text('Emulator (10.0.2.2)', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            setDialogState(() {
                              controller.text = 'http://10.0.2.2:8080/api/v1';
                              testStatus = '';
                            });
                          },
                        ),
                        ActionChip(
                          label: const Text('Localhost (127.0.0.1)', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            setDialogState(() {
                              controller.text = 'http://127.0.0.1:8080/api/v1';
                              testStatus = '';
                            });
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    OutlinedButton.icon(
                      icon: testing
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.network_check, size: 16),
                      label: Text(testing ? 'Testing connection...' : 'Test Connection'),
                      onPressed: testing
                          ? null
                          : () async {
                              setDialogState(() {
                                testing = true;
                                testStatus = '';
                              });
                              final res = await AdmissionService.testConnection(controller.text);
                              if (dialogCtx.mounted) {
                                setDialogState(() {
                                  testing = false;
                                  testStatus = res.ok
                                      ? 'Connected successfully!'
                                      : 'Connection failed: ${res.message}';
                                });
                              }
                            },
                    ),
                    if (testStatus.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        testStatus,
                        style: TextStyle(
                          fontSize: 12,
                          color: testStatus.startsWith('Connected') ? Colors.green.shade700 : Colors.red,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _splashTeal,
                    foregroundColor: _splashTealInk,
                  ),
                  onPressed: () async {
                    final newUrl = controller.text.trim();
                    if (newUrl.isNotEmpty) {
                      await AppConstants.setAndSaveBaseUrl(newUrl);
                      if (mounted) setState(() {});
                    }
                    if (dialogCtx.mounted) Navigator.pop(dialogCtx);
                  },
                  child: const Text('Save & Apply'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _splashTeal,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: CustomCard(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: _splashTeal,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(Icons.phone_iphone,
                            size: 42, color: _splashTealInk),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Center(
                      child: Text(
                        AppConstants.appName,
                        style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: _splashTealInk),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Center(
                      child: Text(
                        'Sign in securely with your phone number',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: ActionChip(
                        avatar: const Icon(Icons.dns, size: 14, color: _splashTealInk),
                        label: Text(
                          'Server: ${AppConstants.apiBaseUrl}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: _splashTealInk,
                            fontWeight: FontWeight.w600,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        backgroundColor: Colors.teal.shade50,
                        side: BorderSide(
                          color: _splashTealInk.withValues(alpha: 0.25),
                        ),
                        onPressed: _showServerConfigDialog,
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextField(
                      controller: _phoneController,
                      enabled: !_otpSent && !_isLoading,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone number',
                        hintText: '+919876543210',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                    ),
                    if (_otpSent) ...[
                      const SizedBox(height: 14),
                      TextField(
                        controller: _otpController,
                        enabled: !_isLoading,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        decoration: const InputDecoration(
                          labelText: '6-digit OTP',
                          prefixIcon: Icon(Icons.lock_clock_outlined),
                          counterText: '',
                        ),
                      ),
                      if (kDebugMode && _developmentOtp != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Development OTP: $_developmentOtp',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Center(
                        child: _canResend
                            ? TextButton(
                                onPressed: _isLoading ? null : _sendOtp,
                                child: const Text('Resend code',
                                    style: TextStyle(color: _splashTealInk)),
                              )
                            : Text(
                                'Resend code in $_secondsRemaining s',
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.textSecondary),
                              ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _splashTeal,
                          foregroundColor: _splashTealInk,
                        ),
                        onPressed: _isLoading
                            ? null
                            : (_otpSent ? _verifyOtp : _sendOtp),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2),
                              )
                            : Text(_otpSent ? 'Verify OTP' : 'Send OTP'),
                      ),
                    ),
                    if (_otpSent) ...[
                      const SizedBox(height: 8),
                      Center(
                        child: TextButton(
                          style: TextButton.styleFrom(
                              foregroundColor: _splashTealInk),
                          onPressed: _isLoading
                              ? null
                              : () => setState(() {
                                    _otpSent = false;
                                    _developmentOtp = null;
                                    _otpController.clear();
                                    _timer?.cancel();
                                  }),
                          child: const Text('Use a different phone number'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
