import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';

import '../models/vibe_type.dart';
import '../models/user_profile.dart';
import '../models/review.dart';

/// Clean, 100% Free Local JSON Persistence Service for WATCHVIBE.
///
/// Implements local serialization for user watchlists, ratings, custom vibe votes,
/// reviews, and profile metrics so state persists seamlessly across app reboots.
/// Strictly follows $0 cost free-tier architecture with zero external paid SDKs.
class LocalStorageService {
  static final LocalStorageService instance = LocalStorageService._internal();
  factory LocalStorageService() => instance;
  LocalStorageService._internal();

  static const String _defaultFileName = 'watchvibe_cache.json';
  static const int _currentSchemaVersion = 1;

  bool _isInitialized = false;
  String? _customStoragePath;

  // In-memory data caches for fast, synchronous access
  final Map<String, WatchlistStatus> _watchlistCache = {};
  final Map<String, double> _ratingsCache = {};
  final Map<String, List<VibeType>> _vibeVotesCache = {};
  final Map<VibeType, int> _personalVibeUsageCache = {};
  final Map<String, String> _battleVotesCache = {};
  final List<Review> _userReviewsCache = [];

  // Profile metadata caches
  int _moviesWatched = 0;
  int _seriesWatched = 0;
  int _watchStreakWeeks = 0;
  int _followersCount = 0;
  int _followingCount = 0;
  List<String> _favoriteGenres = [];
  DateTime? _lastSyncTime;

  // Getters
  bool get isInitialized => _isInitialized;
  DateTime? get lastSyncTime => _lastSyncTime;
  int get moviesWatched => _moviesWatched;
  int get seriesWatched => _seriesWatched;
  int get watchStreakWeeks => _watchStreakWeeks;
  List<String> get favoriteGenres => List.unmodifiable(_favoriteGenres);

  Map<String, WatchlistStatus> get watchlist => Map.unmodifiable(_watchlistCache);
  Map<String, double> get ratings => Map.unmodifiable(_ratingsCache);
  Map<String, List<VibeType>> get vibeVotes => Map.unmodifiable(_vibeVotesCache);
  Map<VibeType, int> get personalVibeUsage => Map.unmodifiable(_personalVibeUsageCache);
  Map<String, String> get battleVotes => Map.unmodifiable(_battleVotesCache);
  List<Review> get userReviews => List.unmodifiable(_userReviewsCache);

  /// Initializes the storage engine, resolving file paths and loading persisted JSON.
  Future<void> init({String? storagePath}) async {
    if (_isInitialized && storagePath == null) return;
    if (storagePath != null) {
      _customStoragePath = storagePath;
    }

    try {
      final file = _getStorageFile();
      if (await file.exists()) {
        final content = await file.readAsString();
        if (content.trim().isNotEmpty) {
          _deserializeJson(content);
        }
      }
    } catch (e) {
      debugPrint('[LocalStorageService] Error initializing local storage: $e');
    } finally {
      _isInitialized = true;
    }
  }

  // ==========================================
  // Watchlist Operations
  // ==========================================

  /// Sets or updates the watchlist status for a media item.
  Future<void> setWatchlistStatus(String mediaId, WatchlistStatus status) async {
    _watchlistCache[mediaId] = status;
    await _persist();
  }

  /// Toggles watchlist status. If already set to [status], removes it; otherwise sets it.
  Future<void> toggleWatchlistStatus(String mediaId, WatchlistStatus status) async {
    if (_watchlistCache[mediaId] == status) {
      _watchlistCache.remove(mediaId);
    } else {
      _watchlistCache[mediaId] = status;
    }
    await _persist();
  }

  /// Removes a media item from the watchlist.
  Future<void> removeWatchlistStatus(String mediaId) async {
    if (_watchlistCache.containsKey(mediaId)) {
      _watchlistCache.remove(mediaId);
      await _persist();
    }
  }

  /// Returns the current watchlist status for a media item, or null if not in watchlist.
  WatchlistStatus? getWatchlistStatus(String mediaId) => _watchlistCache[mediaId];

  /// Checks if a media item is in any watchlist category.
  bool isInWatchlist(String mediaId) => _watchlistCache.containsKey(mediaId);

  /// Saves the complete watchlist map at once.
  Future<void> saveWatchlist(Map<String, WatchlistStatus> watchlist) async {
    _watchlistCache
      ..clear()
      ..addAll(watchlist);
    await _persist();
  }

  // ==========================================
  // Ratings Operations
  // ==========================================

  /// Saves or updates a user rating (1.0 to 10.0) for a media item.
  Future<void> setRating(String mediaId, double score) async {
    _ratingsCache[mediaId] = score;
    await _persist();
  }

  /// Removes a rating for a media item.
  Future<void> removeRating(String mediaId) async {
    if (_ratingsCache.containsKey(mediaId)) {
      _ratingsCache.remove(mediaId);
      await _persist();
    }
  }

  /// Returns the user's rating for a media item, or null if unrated.
  double? getRating(String mediaId) => _ratingsCache[mediaId];

  /// Saves the complete ratings map at once.
  Future<void> saveRatings(Map<String, double> ratings) async {
    _ratingsCache
      ..clear()
      ..addAll(ratings);
    await _persist();
  }

  // ==========================================
  // Custom Vibe Votes Operations
  // ==========================================

  /// Saves user selected vibes for a given media item and updates personal vibe usage.
  Future<void> setVibesForMedia(String mediaId, List<VibeType> vibes) async {
    _vibeVotesCache[mediaId] = List.from(vibes);
    for (var vibe in vibes) {
      _personalVibeUsageCache[vibe] = (_personalVibeUsageCache[vibe] ?? 0) + 1;
    }
    await _persist();
  }

  /// Returns user's selected vibes for a media item.
  List<VibeType> getVibesForMedia(String mediaId) => _vibeVotesCache[mediaId] ?? [];

  /// Removes user vibe votes for a media item.
  Future<void> removeVibesForMedia(String mediaId) async {
    if (_vibeVotesCache.containsKey(mediaId)) {
      _vibeVotesCache.remove(mediaId);
      await _persist();
    }
  }

  /// Saves all vibe votes at once.
  Future<void> saveVibeVotes(Map<String, List<VibeType>> votes) async {
    _vibeVotesCache
      ..clear()
      ..addAll(votes);
    await _persist();
  }

  /// Saves personal vibe distribution counts.
  Future<void> savePersonalVibeUsage(Map<VibeType, int> usage) async {
    _personalVibeUsageCache
      ..clear()
      ..addAll(usage);
    await _persist();
  }

  // ==========================================
  // User Reviews Operations
  // ==========================================

  /// Saves or prepends a new user review.
  Future<void> saveReview(Review review) async {
    _userReviewsCache.removeWhere((r) => r.id == review.id);
    _userReviewsCache.insert(0, review);
    await _persist();
  }

  /// Retrieves cached reviews, optionally filtered by mediaId.
  List<Review> getReviews({String? mediaId}) {
    if (mediaId == null) return List.unmodifiable(_userReviewsCache);
    return _userReviewsCache.where((r) => r.mediaId == mediaId).toList();
  }

  // ==========================================
  // Watch Battle Operations
  // ==========================================

  /// Saves user vote for a specific watch battle.
  Future<void> saveBattleVote(String battleId, String votedMediaId) async {
    _battleVotesCache[battleId] = votedMediaId;
    await _persist();
  }

  /// Returns the mediaId the user voted for in the battle.
  String? getBattleVote(String battleId) => _battleVotesCache[battleId];

  // ==========================================
  // User Profile Sync & Hydration
  // ==========================================

  /// Hydrates a [UserProfile] object with persisted local storage data.
  UserProfile applyToUserProfile(UserProfile profile) {
    if (_watchlistCache.isNotEmpty) {
      profile.watchlist
        ..clear()
        ..addAll(_watchlistCache);
    }
    if (_ratingsCache.isNotEmpty) {
      profile.userGivenRatings
        ..clear()
        ..addAll(_ratingsCache);
    }
    if (_vibeVotesCache.isNotEmpty) {
      profile.userGivenVibes
        ..clear()
        ..addAll(_vibeVotesCache);
    }
    if (_personalVibeUsageCache.isNotEmpty) {
      profile.personalVibeUsage
        ..clear()
        ..addAll(_personalVibeUsageCache);
    }
    if (_moviesWatched > 0) profile.moviesWatched = _moviesWatched;
    if (_seriesWatched > 0) profile.seriesWatched = _seriesWatched;
    if (_watchStreakWeeks > 0) profile.watchStreakWeeks = _watchStreakWeeks;

    return profile;
  }

  /// Serializes and saves an entire [UserProfile] snapshot to local storage.
  Future<void> saveUserProfile(UserProfile profile) async {
    _watchlistCache
      ..clear()
      ..addAll(profile.watchlist);

    _ratingsCache
      ..clear()
      ..addAll(profile.userGivenRatings);

    _vibeVotesCache
      ..clear()
      ..addAll(profile.userGivenVibes);

    _personalVibeUsageCache
      ..clear()
      ..addAll(profile.personalVibeUsage);

    _moviesWatched = profile.moviesWatched;
    _seriesWatched = profile.seriesWatched;
    _watchStreakWeeks = profile.watchStreakWeeks;
    _followersCount = profile.followersCount;
    _followingCount = profile.followingCount;
    _favoriteGenres = List.from(profile.favoriteGenres);

    await _persist();
  }

  /// Seeds initial sample data into cache if the local store is brand new/empty.
  Future<void> seedIfEmpty(UserProfile initialProfile) async {
    if (_watchlistCache.isEmpty && _ratingsCache.isEmpty && _vibeVotesCache.isEmpty) {
      await saveUserProfile(initialProfile);
    }
  }

  // ==========================================
  // Export, Import & Clear
  // ==========================================

  /// Exports current local storage as a formatted JSON string for backups or debugging.
  String exportJsonString({bool pretty = true}) {
    final map = _serializeToMap();
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(map);
    }
    return jsonEncode(map);
  }

  /// Imports and overwrites current local storage from a raw JSON string.
  Future<bool> importJsonString(String jsonContent) async {
    try {
      _deserializeJson(jsonContent);
      await _persist();
      return true;
    } catch (e) {
      debugPrint('[LocalStorageService] Import failed: $e');
      return false;
    }
  }

  /// Clears all stored data from memory and deletes the local storage file.
  Future<void> clearAll() async {
    _watchlistCache.clear();
    _ratingsCache.clear();
    _vibeVotesCache.clear();
    _personalVibeUsageCache.clear();
    _battleVotesCache.clear();
    _userReviewsCache.clear();
    _moviesWatched = 0;
    _seriesWatched = 0;
    _watchStreakWeeks = 0;
    _favoriteGenres.clear();
    _lastSyncTime = null;

    try {
      final file = _getStorageFile();
      if (await file.exists()) {
        await file.delete();
      }
    } catch (e) {
      debugPrint('[LocalStorageService] Error deleting storage file: $e');
    }
  }

  // ==========================================
  // Internal Serialization & Disk I/O
  // ==========================================

  Map<String, dynamic> _serializeToMap() {
    return {
      'version': _currentSchemaVersion,
      'last_synced': DateTime.now().toIso8601String(),
      'profile_meta': {
        'movies_watched': _moviesWatched,
        'series_watched': _seriesWatched,
        'watch_streak_weeks': _watchStreakWeeks,
        'followers_count': _followersCount,
        'following_count': _followingCount,
        'favorite_genres': _favoriteGenres,
      },
      'watchlist': _watchlistCache.map((k, v) => MapEntry(k, v.name)),
      'ratings': _ratingsCache,
      'vibe_votes': _vibeVotesCache.map(
        (k, vibes) => MapEntry(k, vibes.map((v) => v.id).toList()),
      ),
      'personal_vibe_usage': _personalVibeUsageCache.map(
        (k, count) => MapEntry(k.id, count),
      ),
      'battle_votes': _battleVotesCache,
      'user_reviews': _userReviewsCache.map((r) => _reviewToJson(r)).toList(),
    };
  }

  void _deserializeJson(String jsonString) {
    try {
      final decoded = jsonDecode(jsonString);
      if (decoded is! Map<String, dynamic>) return;

      if (decoded['last_synced'] != null) {
        _lastSyncTime = DateTime.tryParse(decoded['last_synced'] as String);
      }

      // Profile Meta
      final meta = decoded['profile_meta'];
      if (meta is Map<String, dynamic>) {
        _moviesWatched = meta['movies_watched'] as int? ?? _moviesWatched;
        _seriesWatched = meta['series_watched'] as int? ?? _seriesWatched;
        _watchStreakWeeks = meta['watch_streak_weeks'] as int? ?? _watchStreakWeeks;
        _followersCount = meta['followers_count'] as int? ?? _followersCount;
        _followingCount = meta['following_count'] as int? ?? _followingCount;
        if (meta['favorite_genres'] is List) {
          _favoriteGenres = (meta['favorite_genres'] as List).map((e) => e.toString()).toList();
        }
      }

      // Watchlist
      final wl = decoded['watchlist'];
      if (wl is Map<String, dynamic>) {
        _watchlistCache.clear();
        wl.forEach((mediaId, statusStr) {
          _watchlistCache[mediaId] = _parseWatchlistStatus(statusStr.toString());
        });
      }

      // Ratings
      final rt = decoded['ratings'];
      if (rt is Map<String, dynamic>) {
        _ratingsCache.clear();
        rt.forEach((mediaId, score) {
          if (score is num) {
            _ratingsCache[mediaId] = score.toDouble();
          }
        });
      }

      // Vibe Votes
      final vv = decoded['vibe_votes'];
      if (vv is Map<String, dynamic>) {
        _vibeVotesCache.clear();
        vv.forEach((mediaId, vibesList) {
          if (vibesList is List) {
            _vibeVotesCache[mediaId] = vibesList
                .map((v) => _parseVibeType(v.toString()))
                .toList();
          }
        });
      }

      // Personal Vibe Usage
      final pvu = decoded['personal_vibe_usage'];
      if (pvu is Map<String, dynamic>) {
        _personalVibeUsageCache.clear();
        pvu.forEach((vibeStr, count) {
          if (count is num) {
            _personalVibeUsageCache[_parseVibeType(vibeStr)] = count.toInt();
          }
        });
      }

      // Battle Votes
      final bv = decoded['battle_votes'];
      if (bv is Map<String, dynamic>) {
        _battleVotesCache.clear();
        bv.forEach((battleId, votedMediaId) {
          _battleVotesCache[battleId] = votedMediaId.toString();
        });
      }

      // Reviews
      final revs = decoded['user_reviews'];
      if (revs is List) {
        _userReviewsCache.clear();
        for (var item in revs) {
          if (item is Map<String, dynamic>) {
            _userReviewsCache.add(_reviewFromJson(item));
          }
        }
      }
    } catch (e) {
      debugPrint('[LocalStorageService] Deserialization error: $e');
    }
  }

  Future<void> _persist() async {
    _lastSyncTime = DateTime.now();
    try {
      final file = _getStorageFile();
      final map = _serializeToMap();
      final jsonStr = const JsonEncoder.withIndent('  ').convert(map);
      await file.writeAsString(jsonStr, flush: true);
    } catch (e) {
      debugPrint('[LocalStorageService] Write failed: $e');
    }
  }

  File _getStorageFile() {
    if (_customStoragePath != null && _customStoragePath!.isNotEmpty) {
      return File(_customStoragePath!);
    }

    final directoryPath = _resolveStorageDirectory();
    final sep = Platform.pathSeparator;
    return File('$directoryPath$sep$_defaultFileName');
  }

  String _resolveStorageDirectory() {
    try {
      if (Platform.isWindows) {
        final appData = Platform.environment['APPDATA'] ??
            Platform.environment['LOCALAPPDATA'];
        if (appData != null && appData.isNotEmpty) {
          final dir = Directory('$appData\\WatchVibe');
          if (!dir.existsSync()) {
            dir.createSync(recursive: true);
          }
          return dir.path;
        }
      } else if (Platform.isMacOS || Platform.isLinux) {
        final home = Platform.environment['HOME'];
        if (home != null && home.isNotEmpty) {
          final dir = Directory('$home/.watchvibe');
          if (!dir.existsSync()) {
            dir.createSync(recursive: true);
          }
          return dir.path;
        }
      } else if (Platform.isAndroid || Platform.isIOS) {
        return Directory.systemTemp.path;
      }
    } catch (_) {}

    return Directory.current.path;
  }

  static WatchlistStatus _parseWatchlistStatus(String value) {
    final lower = value.toLowerCase();
    for (var status in WatchlistStatus.values) {
      if (status.name.toLowerCase() == lower || status.label.toLowerCase() == lower) {
        return status;
      }
    }
    return WatchlistStatus.wantToWatch;
  }

  static VibeType _parseVibeType(String value) {
    final lower = value.toLowerCase().replaceAll(' ', '_');
    for (var vibe in VibeType.values) {
      if (vibe.id.toLowerCase() == lower ||
          vibe.name.toLowerCase() == lower ||
          vibe.label.toLowerCase().replaceAll(' ', '_') == lower) {
        return vibe;
      }
    }
    return VibeType.mustWatch;
  }

  static Map<String, dynamic> _reviewToJson(Review r) {
    return {
      'id': r.id,
      'userId': r.userId,
      'userName': r.userName,
      'userAvatar': r.userAvatar,
      'mediaId': r.mediaId,
      'mediaTitle': r.mediaTitle,
      'rating': r.rating,
      'vibes': r.vibes.map((v) => v.id).toList(),
      'comment': r.comment,
      'isSpoiler': r.isSpoiler,
      'createdAt': r.createdAt.toIso8601String(),
      'likes': r.likes,
      'isLiked': r.isLiked,
    };
  }

  static Review _reviewFromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'] as String? ?? 'rev-${DateTime.now().millisecondsSinceEpoch}',
      userId: json['userId'] as String? ?? 'current-user',
      userName: json['userName'] as String? ?? 'Alex Rivera',
      userAvatar: json['userAvatar'] as String? ?? '',
      mediaId: json['mediaId'] as String? ?? '',
      mediaTitle: json['mediaTitle'] as String? ?? '',
      rating: (json['rating'] as num?)?.toDouble() ?? 8.0,
      vibes: (json['vibes'] as List<dynamic>?)
              ?.map((e) => _parseVibeType(e.toString()))
              .toList() ??
          [],
      comment: json['comment'] as String? ?? '',
      isSpoiler: json['isSpoiler'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      likes: json['likes'] as int? ?? 0,
      isLiked: json['isLiked'] as bool? ?? false,
    );
  }
}
