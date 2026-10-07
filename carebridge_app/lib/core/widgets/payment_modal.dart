import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../../features/admissions/admission_service.dart';
import '../../features/billing/billing_model.dart';

class PaymentModal extends StatefulWidget {
  final double amount;
  final String admissionId;
  final String caregiverMobile;
  final void Function(BillPayment confirmed) onPaymentSuccess;

  const PaymentModal({
    super.key,
    required this.amount,
    required this.admissionId,
    required this.caregiverMobile,
    required this.onPaymentSuccess,
  });

  @override
  State<PaymentModal> createState() => _PaymentModalState();
}

class _PaymentModalState extends State<PaymentModal> {
  String _selectedMethod = 'UPI';
  bool _isProcessing = false;
  String? _errorMessage;

  final TextEditingController _upiController =
      TextEditingController(text: 'caregiver@upi');

  @override
  void dispose() {
    _upiController.dispose();
    super.dispose();
  }

  Future<void> _processPayment() async {
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });

    try {
      final confirmed = await AdmissionService.postPayment(
        admissionId: widget.admissionId,
        caregiverMobile: widget.caregiverMobile,
        method: _selectedMethod,
        amount: widget.amount,
      );

      if (!mounted) return;
      Navigator.pop(context);
      widget.onPaymentSuccess(confirmed);
    } on AdmissionApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _errorMessage = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _errorMessage = 'Payment failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ─────────────────────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Complete Hospital Payment',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed:
                    _isProcessing ? null : () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Amount banner ───────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Payable Balance',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                Text(
                  '₹${widget.amount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Method selector ─────────────────────────────────────────────────
          const Text('Select Payment Method',
              style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          _buildMethodOption(
              'UPI', 'Google Pay, PhonePe, Paytm', Icons.qr_code_2),
          _buildMethodOption(
              'Debit Card', 'Visa, Mastercard, RuPay', Icons.credit_card),
          _buildMethodOption(
              'Credit Card', 'Visa, Mastercard, Amex', Icons.credit_score),
          _buildMethodOption(
              'Net Banking', 'All Major Indian Banks', Icons.account_balance),
          const SizedBox(height: 16),

          // ── UPI ID field ────────────────────────────────────────────────────
          if (_selectedMethod == 'UPI') ...[
            TextField(
              controller: _upiController,
              decoration: const InputDecoration(
                labelText: 'Enter VPA / UPI ID',
                prefixIcon: Icon(Icons.alternate_email),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── Error message ───────────────────────────────────────────────────
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.dangerLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      size: 16, color: AppColors.danger),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.danger),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // ── Pay button ──────────────────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isProcessing ? null : _processPayment,
              child: _isProcessing
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.5),
                    )
                  : Text('Pay ₹${widget.amount.toStringAsFixed(2)} Now'),
            ),
          ),
          const SizedBox(height: 8),

          // ── Demo mode notice ────────────────────────────────────────────────
          const Center(
            child: Text(
              '🔒  Demo payment — no real transaction is processed',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildMethodOption(String id, String subtitle, IconData icon) {
    final isSelected = _selectedMethod == id;
    return GestureDetector(
      onTap: _isProcessing ? null : () => setState(() => _selectedMethod = id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
          color: isSelected
              ? AppColors.primaryLight.withValues(alpha: 0.3)
              : Colors.transparent,
        ),
        child: Row(
          children: [
            Icon(icon,
                color: isSelected
                    ? AppColors.primary
                    : AppColors.textSecondary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(id,
                      style: TextStyle(
                          fontWeight: isSelected
                              ? FontWeight.bold
                              : FontWeight.normal)),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
            // Simple visual indicator instead of deprecated Radio widget
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.border,
                  width: isSelected ? 6 : 2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
