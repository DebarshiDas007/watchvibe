import 'vibe_type.dart';
import 'review.dart';

enum MediaType { movie, series }

class CastMember {
  final String name;
  final String character;
  final String profileUrl;
  final VibeType signatureVibe;

  const CastMember({
    required this.name,
    required this.character,
    required this.profileUrl,
    required this.signatureVibe,
  });
}

class CrewMember {
  final String name;
  final String role; // Director, Composer, Cinematographer
  final String profileUrl;

  const CrewMember({
    required this.name,
    required this.role,
    required this.profileUrl,
  });
}

class StreamingProvider {
  final String name;
  final String logoUrl;
  final String type; // 'stream' (subscription), 'rent', 'buy', 'free'
  final String? price;

  const StreamingProvider({
    required this.name,
    required this.logoUrl,
    required this.type,
    this.price,
  });
}

class SoundtrackInfo {
  final String themeTitle;
  final String composer;
  final String duration;
  final String previewAudioUrl;
  final String spotifyUrl;

  const SoundtrackInfo({
    required this.themeTitle,
    required this.composer,
    required this.duration,
    required this.previewAudioUrl,
    required this.spotifyUrl,
  });
}

class ViewingGuide {
  final String idealEnvironment; // e.g. "Late night solo • Pitch black • High volume"
  final String pacing; // e.g. "Slow Burn (first 45m) ➔ Intense Climax"
  final int cryGauge; // 1 to 10
  final String attentionLevel; // e.g. "Full focus (no second-screening)"

  const ViewingGuide({
    required this.idealEnvironment,
    required this.pacing,
    required this.cryGauge,
    required this.attentionLevel,
  });
}

class DoubleFeaturePairing {
  final String pairedTitle;
  final int pairedYear;
  final String pairedPosterUrl;
  final String curationReason;
  final VibeType synergyVibe;

  const DoubleFeaturePairing({
    required this.pairedTitle,
    required this.pairedYear,
    required this.pairedPosterUrl,
    required this.curationReason,
    required this.synergyVibe,
  });
}

class MediaItem {
  final String id;
  final String title;
  final MediaType type;
  final int releaseYear;
  final List<String> genres;
  final String language;
  final String duration;
  final String directorOrCreator;
  final String posterUrl;
  final String backdropUrl;
  final String synopsis;

  // Enhancements
  final List<CastMember> cast;
  final List<CrewMember> keyCrew;
  final Map<String, List<StreamingProvider>> streamingByCountry; // 'US', 'IN', 'GB', 'CA'
  final SoundtrackInfo? soundtrack;
  final ViewingGuide? viewingGuide;
  final DoubleFeaturePairing? doubleFeature;

  // Recent OTT & TV Series Enhancements
  final bool isFreshOttRelease;
  final int? ottReleaseDaysAgo;
  final String? ottPlatform; // e.g. 'Netflix', 'Prime Video', 'Apple TV+', 'Disney+'
  final bool isTrendingNow;
  final int? seasonsCount;
  final int? episodesCount;
  final int? bingeHoursTotal;
  final String? airStatus; // e.g. 'Season 2 Dropping Friday', 'Completed Miniseries', 'Renewed for S3'
  final int? episode1HookRating; // e.g. 96 (%)

  double averageRating;
  int totalRatingsCount;
  int totalVoters;
  Map<VibeType, int> vibeVotes;
  List<Review> communityReviews;

  MediaItem({
    required this.id,
    required this.title,
    required this.type,
    required this.releaseYear,
    required this.genres,
    required this.language,
    required this.duration,
    required this.directorOrCreator,
    required this.posterUrl,
    required this.backdropUrl,
    required this.synopsis,
    required this.averageRating,
    required this.totalRatingsCount,
    required this.totalVoters,
    required this.vibeVotes,
    this.cast = const [],
    this.keyCrew = const [],
    this.streamingByCountry = const {},
    this.soundtrack,
    this.viewingGuide,
    this.doubleFeature,
    this.isFreshOttRelease = false,
    this.ottReleaseDaysAgo,
    this.ottPlatform,
    this.isTrendingNow = false,
    this.seasonsCount,
    this.episodesCount,
    this.bingeHoursTotal,
    this.airStatus,
    this.episode1HookRating,
    List<Review>? communityReviews,
  }) : communityReviews = communityReviews ?? [];

  Map<VibeType, int> get vibePercentages {
    if (totalVoters == 0) return {};
    final Map<VibeType, int> percentages = {};
    for (var vibe in VibeType.values) {
      final votes = vibeVotes[vibe] ?? 0;
      final pct = ((votes / totalVoters) * 100).round();
      if (pct > 0) {
        percentages[vibe] = pct.clamp(0, 100);
      }
    }
    return percentages;
  }

  List<VibeType> get topVibes {
    final entries = vibeVotes.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return entries.where((e) => e.value > 0).take(2).map((e) => e.key).toList();
  }

  VibeType get dominantVibe {
    if (vibeVotes.isEmpty) return VibeType.mustWatch;
    var top = vibeVotes.entries.first;
    for (var entry in vibeVotes.entries) {
      if (entry.value > top.value) top = entry;
    }
    return top.key;
  }

  void submitUserVibes({
    required double userScore,
    required List<VibeType> userSelectedVibes,
    Review? review,
  }) {
    final double totalScore = (averageRating * totalRatingsCount) + userScore;
    totalRatingsCount += 1;
    averageRating = double.parse((totalScore / totalRatingsCount).toStringAsFixed(1));
    totalVoters += 1;

    for (var vibe in userSelectedVibes) {
      vibeVotes[vibe] = (vibeVotes[vibe] ?? 0) + 1;
    }

    if (review != null) {
      communityReviews.insert(0, review);
    }
  }
}
