import 'vibe_type.dart';

enum WatchlistStatus {
  wantToWatch,
  currentlyWatching,
  watched,
  dropped,
  favouriteMovie,
  favouriteSeries,
}

extension WatchlistStatusExtension on WatchlistStatus {
  String get label {
    switch (this) {
      case WatchlistStatus.wantToWatch:
        return 'Want to Watch';
      case WatchlistStatus.currentlyWatching:
        return 'Watching';
      case WatchlistStatus.watched:
        return 'Watched';
      case WatchlistStatus.dropped:
        return 'Dropped';
      case WatchlistStatus.favouriteMovie:
        return 'Fav Movies';
      case WatchlistStatus.favouriteSeries:
        return 'Fav Series';
    }
  }
}

class UserFriend {
  final String id;
  final String name;
  final String username;
  final String avatar;
  final int tasteMatchPercentage; // e.g. 89%
  final String commonFavorites; // e.g. "Both love Thrillers & Sci-Fi"
  final String lastVibeWatched;

  UserFriend({
    required this.id,
    required this.name,
    required this.username,
    required this.avatar,
    required this.tasteMatchPercentage,
    required this.commonFavorites,
    required this.lastVibeWatched,
  });
}

class UserProfile {
  final String id;
  final String name;
  final String username;
  final String avatarUrl;
  final String bio;
  int moviesWatched;
  int seriesWatched;
  int watchStreakWeeks;
  int followersCount;
  int followingCount;
  final List<String> favoriteGenres;
  final Map<VibeType, int> personalVibeUsage;
  final Map<String, WatchlistStatus> watchlist; // mediaId -> status
  final Map<String, List<VibeType>> userGivenVibes; // mediaId -> vibes
  final Map<String, double> userGivenRatings; // mediaId -> rating

  UserProfile({
    required this.id,
    required this.name,
    required this.username,
    required this.avatarUrl,
    required this.bio,
    this.moviesWatched = 142,
    this.seriesWatched = 28,
    this.watchStreakWeeks = 14,
    this.followersCount = 384,
    this.followingCount = 192,
    required this.favoriteGenres,
    required this.personalVibeUsage,
    required this.watchlist,
    required this.userGivenVibes,
    required this.userGivenRatings,
  });
}
