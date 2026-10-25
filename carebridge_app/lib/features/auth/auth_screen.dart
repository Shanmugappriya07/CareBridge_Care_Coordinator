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
          _showMessage('Cannot connect to server. Ensure the backend server is running on port 8080.');
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
          _showMessage('Cannot connect to server. Ensure the backend server is running on port 8080.');
        } else {
          _showMessage('Could not verify OTP: $error');
        }
      }
    }
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
