import 'vibe_type.dart';

class ActorMovieCredit {
  final String mediaId;
  final String title;
  final String character;
  final int releaseYear;
  final double rating;
  final double boxOfficeGrossMillions; // e.g. 654.2 for $654.2M
  final String boxOfficeFormatted; // e.g. "$654.2M"
  final int popularityScore; // app vibe activity count
  final VibeType dominantVibe;
  final List<VibeType> vibes;
  final String posterUrl;

  const ActorMovieCredit({
    required this.mediaId,
    required this.title,
    required this.character,
    required this.releaseYear,
    required this.rating,
    required this.boxOfficeGrossMillions,
    required this.boxOfficeFormatted,
    required this.popularityScore,
    required this.dominantVibe,
    required this.vibes,
    required this.posterUrl,
  });
}

enum FilmographySortBy {
  boxOffice,
  rating,
  popularity,
  releaseDateNewest,
  releaseDateOldest,
}

extension FilmographySortByExtension on FilmographySortBy {
  String get label {
    switch (this) {
      case FilmographySortBy.boxOffice:
        return '💰 Highest Box Office';
      case FilmographySortBy.rating:
        return '⭐ Highest Rating';
      case FilmographySortBy.popularity:
        return '🔥 Popularity in App';
      case FilmographySortBy.releaseDateNewest:
        return '📅 Newest First';
      case FilmographySortBy.releaseDateOldest:
        return '⏳ Chronological';
    }
  }
}

class ActorProfile {
  final String id;
  final String name;
  final String knownForRole; // e.g. "Actor & Producer"
  final String birthDate;
  final String birthplace;
  final String profileUrl;
  final String biography;
  final String totalBoxOfficeFormatted; // e.g. "$10.4 Billion Worldwide"
  final double averageRating;
  final List<ActorMovieCredit> filmography;
  final Map<VibeType, int> vibeBreakdownPercentages;

  // Hyped / Trending Actor Fields
  final bool isHypedNow;
  final String? hypeContext; // e.g. "🔥 Hyped for: Dune: Part Two + Challengers"
  final int? weeklyTrendRank; // e.g. 1
  final int? searchSurgePercentage; // e.g. +64%

  const ActorProfile({
    required this.id,
    required this.name,
    required this.knownForRole,
    required this.birthDate,
    required this.birthplace,
    required this.profileUrl,
    required this.biography,
    required this.totalBoxOfficeFormatted,
    required this.averageRating,
    required this.filmography,
    required this.vibeBreakdownPercentages,
    this.isHypedNow = false,
    this.hypeContext,
    this.weeklyTrendRank,
    this.searchSurgePercentage,
  });

  List<ActorMovieCredit> getSortedFilmography({
    required FilmographySortBy sortBy,
    VibeType? vibeFilter,
  }) {
    var list = filmography.where((credit) {
      if (vibeFilter != null && !credit.vibes.contains(vibeFilter)) {
        return false;
      }
      return true;
    }).toList();

    switch (sortBy) {
      case FilmographySortBy.boxOffice:
        list.sort((a, b) => b.boxOfficeGrossMillions.compareTo(a.boxOfficeGrossMillions));
        break;
      case FilmographySortBy.rating:
        list.sort((a, b) => b.rating.compareTo(a.rating));
        break;
      case FilmographySortBy.popularity:
        list.sort((a, b) => b.popularityScore.compareTo(a.popularityScore));
        break;
      case FilmographySortBy.releaseDateNewest:
        list.sort((a, b) => b.releaseYear.compareTo(a.releaseYear));
        break;
      case FilmographySortBy.releaseDateOldest:
        list.sort((a, b) => a.releaseYear.compareTo(b.releaseYear));
        break;
    }
    return list;
  }
}
