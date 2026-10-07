import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_card.dart';
import '../admissions/admission_model.dart';

class HospitalNavigationScreen extends StatelessWidget {
  final Admission admission;

  const HospitalNavigationScreen({super.key, required this.admission});

  @override
  Widget build(BuildContext context) {
    final facilities = [
      if (admission.roomWard.isNotEmpty)
        {
          'name': admission.roomWard,
          'floor': admission.hospitalName,
          'dist': 'Admission location',
          'icon': Icons.airline_seat_flat
        },
      {
        'name': 'Diagnostic Lab',
        'floor': '2nd Floor',
        'dist': '200m',
        'icon': Icons.science
      },
      {
        'name': 'Main Pharmacy',
        'floor': 'Ground Floor',
        'dist': '450m',
        'icon': Icons.local_pharmacy
      },
      {
        'name': 'Billing & Reception',
        'floor': 'Ground Floor',
        'dist': '420m',
        'icon': Icons.receipt_long
      },
      {
        'name': 'Cafeteria',
        'floor': '1st Floor',
        'dist': '150m',
        'icon': Icons.restaurant
      },
      {
        'name': 'Emergency Entry',
        'floor': 'Ground Floor',
        'dist': '500m',
        'icon': Icons.emergency
      },
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hospital Premises Navigator'),
      ),
      body: Column(
        children: [
          // Map Placeholder
          Container(
            height: 200,
            width: double.infinity,
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Stack(
              children: [
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.map_outlined,
                          size: 48, color: AppColors.textMuted),
                      SizedBox(height: 8),
                      Text('Hospital Indoor Map',
                          style: TextStyle(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.bold)),
                      Text(
                        admission.hospitalName.isEmpty
                            ? 'Hospital details unavailable'
                            : admission.hospitalName,
                        style:
                            TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  top: 40,
                  left: 100,
                  child: Icon(Icons.location_on,
                      color: AppColors.danger, size: 30),
                ),
                Positioned(
                  bottom: 20,
                  right: 20,
                  child: FloatingActionButton.small(
                    onPressed: () {},
                    backgroundColor: Colors.white,
                    child:
                        const Icon(Icons.my_location, color: AppColors.primary),
                  ),
                )
              ],
            ),
          ),

          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              children: [
                Text('Quick Floor Access',
                    style:
                        TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Floor Selector
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: ['G', '1', '2', '3', '4', '5'].map((floor) {
                bool isSelected = floor == '3';
                return Container(
                  margin: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text('Floor $floor'),
                    selected: isSelected,
                    onSelected: (val) {},
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 20),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: facilities.length,
              itemBuilder: (context, index) {
                final f = facilities[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: CustomCard(
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                            content: Text(
                                'Calculating indoor route to ${f['name']}')),
                      );
                    },
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(f['icon'] as IconData,
                              color: AppColors.primary, size: 22),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(f['name'] as String,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold)),
                              Text(f['floor'] as String,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(f['dist'] as String,
                                style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary)),
                            const Icon(Icons.directions_outlined,
                                size: 18, color: AppColors.primary),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
