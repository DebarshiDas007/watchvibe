import 'package:flutter/material.dart';
import '../models/vibe_type.dart';

class VibeBadge extends StatelessWidget {
  final VibeType vibe;
  final int? percentage;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool compact;

  const VibeBadge({
    Key? key,
    required this.vibe,
    this.percentage,
    this.isSelected = false,
    this.onTap,
    this.compact = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final color = vibe.color;
    final bg = isSelected
        ? color.withOpacity(0.25)
        : (percentage != null ? color.withOpacity(0.12) : const Color(0xFF242432));
    final borderColor = isSelected
        ? color
        : (percentage != null ? color.withOpacity(0.4) : const Color(0xFF353545));

    final content = Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 12,
        vertical: compact ? 4 : 7,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor, width: isSelected ? 1.5 : 1.0),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: color.withOpacity(0.3),
                  blurRadius: 8,
                  spreadRadius: 1,
                )
              ]
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            vibe.icon,
            size: compact ? 12 : 15,
            color: color,
          ),
          const SizedBox(width: 5),
          Text(
            vibe.label,
            style: TextStyle(
              color: isSelected ? Colors.white : (percentage != null ? color : const Color(0xFFE2E8F0)),
              fontWeight: isSelected || percentage != null ? FontWeight.w600 : FontWeight.w500,
              fontSize: compact ? 11 : 13,
            ),
          ),
          if (percentage != null) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$percentage%',
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.bold,
                  fontSize: compact ? 10 : 11,
                ),
              ),
            ),
          ],
        ],
      ),
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: content,
      );
    }
    return content;
  }
}
