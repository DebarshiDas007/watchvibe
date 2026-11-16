import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

enum VibeType {
  mustWatch,
  funTime,
  timePass,
  mindBlown,
  emotionalDamage,
  hiddenGem,
  skipIt,
}

extension VibeTypeExtension on VibeType {
  String get id {
    switch (this) {
      case VibeType.mustWatch:
        return 'must_watch';
      case VibeType.funTime:
        return 'fun_time';
      case VibeType.timePass:
        return 'time_pass';
      case VibeType.mindBlown:
        return 'mind_blown';
      case VibeType.emotionalDamage:
        return 'emotional_damage';
      case VibeType.hiddenGem:
        return 'hidden_gem';
      case VibeType.skipIt:
        return 'skip_it';
    }
  }

  String get label {
    switch (this) {
      case VibeType.mustWatch:
        return 'Must Watch';
      case VibeType.funTime:
        return 'Fun Time';
      case VibeType.timePass:
        return 'Time Pass';
      case VibeType.mindBlown:
        return 'Mind Blown';
      case VibeType.emotionalDamage:
        return 'Emotional Damage';
      case VibeType.hiddenGem:
        return 'Hidden Gem';
      case VibeType.skipIt:
        return 'Skip It';
    }
  }

  String get tagline {
    switch (this) {
      case VibeType.mustWatch:
        return 'Top pick • Exceptional storytelling and impact';
      case VibeType.funTime:
        return 'Entertaining, funny, exciting. Perfect for a good time.';
      case VibeType.timePass:
        return 'Nothing extraordinary, but good enough when bored.';
      case VibeType.mindBlown:
        return 'Unexpected twists, brilliant concepts & unforgettable endings.';
      case VibeType.emotionalDamage:
        return 'Stories that make you cry, think or feel deeply.';
      case VibeType.hiddenGem:
        return 'Underrated titles that deserve way more attention.';
      case VibeType.skipIt:
        return 'Not worth your time. Better things to watch.';
    }
  }

  Color get color {
    switch (this) {
      case VibeType.mustWatch:
        return AppColors.mustWatch;
      case VibeType.funTime:
        return AppColors.funTime;
      case VibeType.timePass:
        return AppColors.timePass;
      case VibeType.mindBlown:
        return AppColors.mindBlown;
      case VibeType.emotionalDamage:
        return AppColors.emotionalDamage;
      case VibeType.hiddenGem:
        return AppColors.hiddenGem;
      case VibeType.skipIt:
        return AppColors.skipIt;
    }
  }

  IconData get icon {
    switch (this) {
      case VibeType.mustWatch:
        return Icons.verified;
      case VibeType.funTime:
        return Icons.sentiment_very_satisfied;
      case VibeType.timePass:
        return Icons.hourglass_top_rounded;
      case VibeType.mindBlown:
        return Icons.auto_awesome;
      case VibeType.emotionalDamage:
        return Icons.favorite;
      case VibeType.hiddenGem:
        return Icons.diamond_outlined;
      case VibeType.skipIt:
        return Icons.block_rounded;
    }
  }

  static VibeType fromString(String val) {
    return VibeType.values.firstWhere(
      (v) => v.id == val || v.label.toLowerCase() == val.toLowerCase(),
      orElse: () => VibeType.mustWatch,
    );
  }
}
