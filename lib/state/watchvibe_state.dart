import 'package:flutter/material.dart';
import '../models/vibe_type.dart';
import '../models/media_item.dart';
import '../models/review.dart';
import '../models/user_profile.dart';
import '../models/actor_profile.dart';
import '../data/mock_data.dart';
import '../services/local_storage_service.dart';
import '../services/tmdb_client.dart';
import '../services/itunes_client.dart';
import '../widgets/swipe_deck.dart';

class WatchBattle {
  final String id;
  final String title;
  final MediaItem itemA;
  final MediaItem itemB;
  int votesA;
  int votesB;
  String? userVotedId;

  WatchBattle({
    required this.id,
    required this.title,
    required this.itemA,
    required this.itemB,
    required this.votesA,
    required this.votesB,
    this.userVotedId,
  });

  int get totalVotes => votesA + votesB;
  int get pctA => totalVotes == 0 ? 50 : ((votesA / totalVotes) * 100).round();
  int get pctB => totalVotes == 0 ? 50 : 100 - pctA;
}

class WatchVibeState extends ChangeNotifier {
  late List<MediaItem> _allMedia;
  late List<ActorProfile> _allActors;
  late List<UserFriend> _friends;
  late UserProfile _currentUser;
  late List<WatchBattle> _battles;

  final TmdbClient tmdbClient = TmdbClient();
  final ITunesClient itunesClient = ITunesClient();

  int _selectedNavIndex = 0;
  String _searchQuery = '';
  VibeType? _selectedExploreVibe;
  String? _selectedExploreGenre;
  MediaType? _selectedExploreType;
  VibeType? _activeMoodFilter;
  MediaItem? _activeDetailsItem;

  String _selectedCountry = 'US';
  bool _isSoundtrackPlaying = false;
  String? _currentlyPlayingMediaId;
  bool _isSearchingOnline = false;
  bool _isStorageReady = false;

  WatchVibeState() {
    _allMedia = MockData.getSampleMedia();
    _allActors = MockData.getSampleActors();
    _friends = MockData.getSampleFriends();
    _currentUser = MockData.getInitialProfile();
    _battles = [
      WatchBattle(
        id: 'battle-1',
        title: 'Mind-Bending Showdown',
        itemA: _allMedia.firstWhere((m) => m.id == 'interstellar'),
        itemB: _allMedia.firstWhere((m) => m.id == 'severance'),
        votesA: 642,
        votesB: 588,
      ),
    ];

    _initStorage();
  }

  Future<void> _initStorage() async {
    try {
      await LocalStorageService.instance.init();
      _currentUser = LocalStorageService.instance.applyToUserProfile(_currentUser);

      // Hydrate battle votes from storage
      for (final battle in _battles) {
        final savedVote = LocalStorageService.instance.getBattleVote(battle.id);
        if (savedVote != null) {
          battle.userVotedId = savedVote;
        }
      }

      // Hydrate media with user's saved vibe ratings
      for (final media in _allMedia) {
        final savedRating = LocalStorageService.instance.getRating(media.id);
        final savedVibes = LocalStorageService.instance.getVibesForMedia(media.id);
        if (savedRating != null && savedVibes.isNotEmpty) {
          media.submitUserVibes(
            userScore: savedRating,
            userSelectedVibes: savedVibes,
          );
        }
      }

      _isStorageReady = true;
      notifyListeners();
    } catch (e) {
      debugPrint('[WatchVibeState] Storage init error: $e');
    }
  }

  // Getters
  List<MediaItem> get allMedia => _allMedia;
  List<ActorProfile> get allActors => _allActors;
  List<UserFriend> get friends => _friends;
  UserProfile get currentUser => _currentUser;
  List<WatchBattle> get battles => _battles;
  int get selectedNavIndex => _selectedNavIndex;
  String get searchQuery => _searchQuery;
  VibeType? get selectedExploreVibe => _selectedExploreVibe;
  String? get selectedExploreGenre => _selectedExploreGenre;
  MediaType? get selectedExploreType => _selectedExploreType;
  VibeType? get activeMoodFilter => _activeMoodFilter;
  MediaItem? get activeDetailsItem => _activeDetailsItem;
  String get selectedCountry => _selectedCountry;
  bool get isSoundtrackPlaying => _isSoundtrackPlaying;
  String? get currentlyPlayingMediaId => _currentlyPlayingMediaId;
  bool get isSearchingOnline => _isSearchingOnline;
  bool get isStorageReady => _isStorageReady;

  List<MediaItem> get trendingMedia => _allMedia.take(5).toList();
  List<MediaItem> get mustWatchList => _allMedia.where((m) => (m.vibePercentages[VibeType.mustWatch] ?? 0) >= 70).toList();
  List<MediaItem> get hiddenGems => _allMedia.where((m) => (m.vibePercentages[VibeType.hiddenGem] ?? 0) >= 30).toList();

  String? _selectedOttPlatform;
  String? get selectedOttPlatform => _selectedOttPlatform;

  void setOttPlatform(String? platform) {
    if (_selectedOttPlatform == platform) {
      _selectedOttPlatform = null;
    } else {
      _selectedOttPlatform = platform;
    }
    notifyListeners();
  }

  List<MediaItem> get freshOttReleases {
    final ottList = _allMedia.where((m) => m.isFreshOttRelease).toList();
    if (_selectedOttPlatform == null) return ottList;
    return ottList.where((m) => (m.ottPlatform ?? '').toLowerCase().contains(_selectedOttPlatform!.toLowerCase())).toList();
  }

  List<ActorProfile> get hypedActors {
    final list = _allActors.where((a) => a.isHypedNow).toList();
    list.sort((a, b) => (a.weeklyTrendRank ?? 99).compareTo(b.weeklyTrendRank ?? 99));
    return list;
  }

  List<MediaItem> get tvSeriesList => _allMedia.where((m) => m.type == MediaType.series).toList();

  List<MediaItem> get moodRecommendations {
    if (_activeMoodFilter == null) return _allMedia;
    return _allMedia.where((m) => (m.vibePercentages[_activeMoodFilter!] ?? 0) >= 40).toList();
  }

  // Universal Search for Media
  List<MediaItem> get filteredExploreMedia {
    return _allMedia.where((item) {
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchesTitle = item.title.toLowerCase().contains(q);
        final matchesDirector = item.directorOrCreator.toLowerCase().contains(q);
        final matchesGenre = item.genres.any((g) => g.toLowerCase().contains(q));
        final matchesCast = item.cast.any((c) => c.name.toLowerCase().contains(q));
        if (!matchesTitle && !matchesDirector && !matchesGenre && !matchesCast) return false;
      }
      if (_selectedExploreType != null && item.type != _selectedExploreType) {
        return false;
      }
      if (_selectedExploreGenre != null && !item.genres.contains(_selectedExploreGenre)) {
        return false;
      }
      if (_selectedExploreVibe != null) {
        final pct = item.vibePercentages[_selectedExploreVibe!] ?? 0;
        if (pct < 30) return false;
      }
      return true;
    }).toList();
  }

  // Universal Search for Actors
  List<ActorProfile> get filteredActors {
    if (_searchQuery.isEmpty) return _allActors;
    final q = _searchQuery.toLowerCase();
    return _allActors.where((actor) {
      final matchesName = actor.name.toLowerCase().contains(q);
      final matchesBio = actor.biography.toLowerCase().contains(q);
      final matchesMovie = actor.filmography.any((c) => c.title.toLowerCase().contains(q));
      return matchesName || matchesBio || matchesMovie;
    }).toList();
  }

  List<MediaItem> getWatchlistItems(WatchlistStatus status) {
    final mediaIds = _currentUser.watchlist.entries
        .where((entry) => entry.value == status)
        .map((entry) => entry.key)
        .toSet();
    return _allMedia.where((m) => mediaIds.contains(m.id)).toList();
  }

  void setNavIndex(int index) {
    _selectedNavIndex = index;
    notifyListeners();
  }

  void setSelectedCountry(String country) {
    _selectedCountry = country;
    notifyListeners();
  }

  void toggleSoundtrackPreview(String mediaId) {
    if (_currentlyPlayingMediaId == mediaId && _isSoundtrackPlaying) {
      _isSoundtrackPlaying = false;
      _currentlyPlayingMediaId = null;
    } else {
      _currentlyPlayingMediaId = mediaId;
      _isSoundtrackPlaying = true;
    }
    notifyListeners();
  }

  void openMediaDetails(MediaItem item) {
    _activeDetailsItem = item;
    notifyListeners();
  }

  void closeMediaDetails() {
    _activeDetailsItem = null;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void setExploreVibe(VibeType? vibe) {
    _selectedExploreVibe = vibe;
    notifyListeners();
  }

  void setExploreGenre(String? genre) {
    _selectedExploreGenre = genre;
    notifyListeners();
  }

  void setExploreType(MediaType? type) {
    _selectedExploreType = type;
    notifyListeners();
  }

  void setMoodFilter(VibeType? vibe) {
    if (_activeMoodFilter == vibe) {
      _activeMoodFilter = null;
    } else {
      _activeMoodFilter = vibe;
    }
    notifyListeners();
  }

  void submitRatingAndVibes({
    required String mediaId,
    required double score,
    required List<VibeType> vibes,
    String? reviewText,
    bool isSpoiler = false,
  }) {
    final media = _allMedia.firstWhere((m) => m.id == mediaId);

    Review? newReview;
    if (reviewText != null && reviewText.trim().isNotEmpty) {
      newReview = Review(
        id: 'rev-${DateTime.now().millisecondsSinceEpoch}',
        userId: _currentUser.id,
        userName: _currentUser.name,
        userAvatar: _currentUser.avatarUrl,
        mediaId: mediaId,
        mediaTitle: media.title,
        rating: score,
        vibes: List.from(vibes),
        comment: reviewText.trim(),
        isSpoiler: isSpoiler,
        createdAt: DateTime.now(),
        likes: 0,
      );
    }

    media.submitUserVibes(
      userScore: score,
      userSelectedVibes: vibes,
      review: newReview,
    );

    _currentUser.userGivenRatings[mediaId] = score;
    _currentUser.userGivenVibes[mediaId] = vibes;

    for (var v in vibes) {
      _currentUser.personalVibeUsage[v] = (_currentUser.personalVibeUsage[v] ?? 0) + 1;
    }

    if (!_currentUser.watchlist.containsKey(mediaId)) {
      _currentUser.watchlist[mediaId] = WatchlistStatus.watched;
      if (media.type == MediaType.movie) {
        _currentUser.moviesWatched += 1;
      } else {
        _currentUser.seriesWatched += 1;
      }
    }

    // Persist to local JSON cache ($0 Free-Tier)
    LocalStorageService.instance.saveUserProfile(_currentUser);
    if (newReview != null) {
      LocalStorageService.instance.saveReview(newReview);
    }

    notifyListeners();
  }

  void toggleWatchlist(String mediaId, WatchlistStatus status) {
    if (_currentUser.watchlist[mediaId] == status) {
      _currentUser.watchlist.remove(mediaId);
      LocalStorageService.instance.removeWatchlistStatus(mediaId);
    } else {
      _currentUser.watchlist[mediaId] = status;
      LocalStorageService.instance.setWatchlistStatus(mediaId, status);
    }
    notifyListeners();
  }

  void toggleLikeReview(Review review) {
    review.isLiked = !review.isLiked;
    review.likes += review.isLiked ? 1 : -1;
    notifyListeners();
  }

  void voteBattle(String battleId, String mediaId) {
    final battle = _battles.firstWhere((b) => b.id == battleId);
    if (battle.userVotedId == mediaId) return;

    if (battle.userVotedId == battle.itemA.id) battle.votesA -= 1;
    if (battle.userVotedId == battle.itemB.id) battle.votesB -= 1;

    battle.userVotedId = mediaId;
    if (mediaId == battle.itemA.id) battle.votesA += 1;
    if (mediaId == battle.itemB.id) battle.votesB += 1;

    LocalStorageService.instance.saveBattleVote(battleId, mediaId);
    notifyListeners();
  }

  /// Handles 4-directional Swipe to Vibe action from [SwipeDeck]
  void handleSwipeAction(MediaItem item, SwipeVibeAction action) {
    switch (action) {
      case SwipeVibeAction.mustWatch:
        submitRatingAndVibes(
          mediaId: item.id,
          score: 9.5,
          vibes: [VibeType.mustWatch],
        );
        break;
      case SwipeVibeAction.skipIt:
        submitRatingAndVibes(
          mediaId: item.id,
          score: 3.0,
          vibes: [VibeType.skipIt],
        );
        break;
      case SwipeVibeAction.mindBlown:
        submitRatingAndVibes(
          mediaId: item.id,
          score: 9.0,
          vibes: [VibeType.mindBlown],
        );
        break;
      case SwipeVibeAction.wantToWatch:
        toggleWatchlist(item.id, WatchlistStatus.planToWatch);
        break;
    }
  }

  /// Live Online Search using Free TMDB Multi-Search API with fallback
  Future<void> searchOnline(String query) async {
    if (query.trim().isEmpty) return;
    _isSearchingOnline = true;
    notifyListeners();

    try {
      final results = await tmdbClient.multiSearch(query);
      if (results.isNotEmpty) {
        for (final item in results) {
          final exists = _allMedia.any((m) => m.id == item.id);
          if (!exists) {
            _allMedia.add(item);
          }
        }
      }
    } catch (e) {
      debugPrint('[WatchVibeState] Online TMDB search fallback: $e');
    } finally {
      _isSearchingOnline = false;
      notifyListeners();
    }
  }

  /// Fetches live 30-sec soundtrack preview from Apple iTunes Search API (100% Free, zero auth)
  Future<SoundtrackInfo?> fetchLiveSoundtrack(String movieTitle, {String? composer}) async {
    return await itunesClient.searchSoundtrack(movieTitle, composer: composer);
  }

  /// Triggers daily live refresh of trending movies, fresh OTT releases, and hyped actors from TMDB
  Future<void> triggerDailyLiveRefresh() async {
    _isSearchingOnline = true;
    notifyListeners();
    try {
      final trendingMovies = await tmdbClient.getTrendingMovies();
      if (trendingMovies.isNotEmpty) {
        for (final m in trendingMovies) {
          final exists = _allMedia.any((x) => x.id == m.id || x.title.toLowerCase() == m.title.toLowerCase());
          if (!exists) {
            _allMedia.add(m);
          }
        }
      }
      final ottReleases = await tmdbClient.getFreshOttReleases();
      if (ottReleases.isNotEmpty) {
        for (final m in ottReleases) {
          final exists = _allMedia.any((x) => x.id == m.id || x.title.toLowerCase() == m.title.toLowerCase());
          if (!exists) {
            _allMedia.add(m);
          }
        }
      }
      final actors = await tmdbClient.getTrendingActors();
      if (actors.isNotEmpty) {
        for (final a in actors) {
          final exists = _allActors.any((x) => x.id == a.id || x.name.toLowerCase() == a.name.toLowerCase());
          if (!exists) {
            _allActors.add(a);
          }
        }
      }
    } catch (e) {
      debugPrint('[WatchVibeState] Daily live refresh fallback: $e');
    } finally {
      _isSearchingOnline = false;
      notifyListeners();
    }
  }
}
