import 'package:flutter/material.dart';
import '../models/vibe_type.dart';

class VibeProgressBar extends StatelessWidget {
  final VibeType vibe;
  final int percentage;
  final int? voterCount;

  const VibeProgressBar({
    Key? key,
    required this.vibe,
    required this.percentage,
    this.voterCount,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final color = vibe.color;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(vibe.icon, size: 14, color: color),
                  const SizedBox(width: 6),
                  Text(
                    vibe.label,
                    style: const TextStyle(
                      color: Color(0xFFF1F5F9),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  if (voterCount != null) ...[
                    Text(
                      '$voterCount votes • ',
                      style: const TextStyle(
                        color: Color(0xFF64748B),
                        fontSize: 11,
                      ),
                    ),
                  ],
                  Text(
                    '$percentage%',
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 5),
          Stack(
            children: [
              // Background track
              Container(
                height: 7,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF262633),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              // Filled track with percentage
              FractionallySizedBox(
                widthFactor: (percentage / 100).clamp(0.0, 1.0),
                child: Container(
                  height: 7,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        color.withOpacity(0.7),
                        color,
                      ],
                    ),
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: [
                      BoxShadow(
                        color: color.withOpacity(0.4),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
