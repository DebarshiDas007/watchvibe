import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../models/vibe_type.dart';
import '../models/media_item.dart';
import '../models/actor_profile.dart';
import '../data/mock_data.dart';
import 'free_apis.dart';

typedef HttpGetHandler = Future<String> Function(Uri uri);

/// Client for The Movie Database (TMDB) Free API.
///
/// TMDB provides 100% free non-commercial access to movies, TV series,
/// cast & crew credits, and JustWatch-powered streaming availability.
///
/// Features seamless offline/free-tier graceful fallback to [MockData]
/// if no API key is set, if offline, or if rate limits/network errors occur.
class TmdbClient {
  static const String baseUrl = FreeApis.tmdbBaseUrl;
  static const String imageBaseW500 = 'https://image.tmdb.org/t/p/w500';
  static const String imageBaseOriginal = 'https://image.tmdb.org/t/p/original';
  static const String imageBaseW185 = 'https://image.tmdb.org/t/p/w185';
  static const String imageBaseW92 = 'https://image.tmdb.org/t/p/w92';

  /// Standard TMDB Genre ID mapping
  static const Map<int, String> genreMap = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western',
    // TV Specific
    10759: 'Action & Adventure',
    10762: 'Kids',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics',
  };

  static const String defaultPublicApiKey = '3fd2be6f0c70a2a598f084ddfb75487c';

  String? apiKey;
  final HttpGetHandler _httpGet;

  TmdbClient({
    String? apiKey,
    HttpGetHandler? httpGetHandler,
  })  : apiKey = apiKey ?? defaultPublicApiKey,
        _httpGet = httpGetHandler ?? _defaultHttpGet;

  /// Whether an API key is configured
  bool get hasApiKey => apiKey != null && apiKey!.trim().isNotEmpty;

  /// Updates or sets the active TMDB API key
  void setApiKey(String key) {
    apiKey = key.trim();
  }

  /// Default HTTP GET implementation using Dart's built-in HttpClient.
  static Future<String> _defaultHttpGet(Uri uri) async {
    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 5);
    try {
      final request = await client.getUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.userAgentHeader, 'WatchVibe/1.0 (FreeTier)');
      final response = await request.close().timeout(const Duration(seconds: 6));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return await response.transform(utf8.decoder).join();
      } else {
        throw HttpException(
          'HTTP ${response.statusCode}: ${response.reasonPhrase}',
          uri: uri,
        );
      }
    } finally {
      client.close();
    }
  }

  // ===========================================================================
  // 1. MULTI-SEARCH (Movies, TV Shows, Actors)
  // ===========================================================================

  /// Executes TMDB multi-search indexing Movies, TV Shows, and People.
  ///
  /// Falls back gracefully to filtering [MockData.getSampleMedia] and
  /// [MockData.getSampleActors] if offline or if no API key is configured.
  Future<List<MediaItem>> multiSearch(String query, {int page = 1}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return MockData.getSampleMedia();

    if (hasApiKey) {
      try {
        final uri = Uri.parse(
          '$baseUrl/search/multi?api_key=$apiKey&query=${Uri.encodeComponent(trimmed)}&page=$page&include_adult=false',
        );

        final body = await _httpGet(uri);
        final data = jsonDecode(body) as Map<String, dynamic>;
        final results = data['results'] as List<dynamic>?;

        if (results != null && results.isNotEmpty) {
          final items = <MediaItem>[];
          for (final raw in results) {
            final map = raw as Map<String, dynamic>;
            final mediaTypeStr = map['media_type'] as String?;

            if (mediaTypeStr == 'movie') {
              items.add(_parseMovieSearchItem(map));
            } else if (mediaTypeStr == 'tv') {
              items.add(_parseTvSearchItem(map));
            } else if (mediaTypeStr == 'person') {
              // Convert actor's known_for works into media items if applicable
              final knownFor = map['known_for'] as List<dynamic>?;
              if (knownFor != null) {
                for (final kf in knownFor) {
                  final kfMap = kf as Map<String, dynamic>;
                  final kfType = kfMap['media_type'] as String? ?? 'movie';
                  if (kfType == 'movie') {
                    items.add(_parseMovieSearchItem(kfMap));
                  } else if (kfType == 'tv') {
                    items.add(_parseTvSearchItem(kfMap));
                  }
                }
              }
            }
          }

          if (items.isNotEmpty) {
            return items;
          }
        }
      } catch (_) {
        // Fall back gracefully on network or JSON parsing failure
      }
    }

    // Graceful Fallback: filter local mock data
    return _getFallbackSearch(trimmed);
  }

  // ===========================================================================
  // 2. MOVIE DETAILS (Full Metadata, Synopsis, Runtime, Cast, Streaming)
  // ===========================================================================

  /// Fetches comprehensive movie details by TMDB movie ID.
  /// Automatically appends credits and JustWatch streaming watch providers.
  ///
  /// Falls back gracefully to curated [MockData] if offline or without key.
  Future<MediaItem?> getMovieDetails(dynamic movieId) async {
    final idStr = movieId.toString();

    if (hasApiKey) {
      try {
        final uri = Uri.parse(
          '$baseUrl/movie/$idStr?api_key=$apiKey&append_to_response=credits,watch/providers',
        );

        final body = await _httpGet(uri);
        final data = jsonDecode(body) as Map<String, dynamic>;

        return _parseFullMovieDetails(data);
      } catch (_) {
        // Fall through to fallback
      }
    }

    // Fallback: Check mock media by ID or title
    return _getFallbackMovieDetails(idStr);
  }

  // ===========================================================================
  // 3. WATCH PROVIDERS ("Where to Watch" Streaming Engine)
  // ===========================================================================

  /// Fetches streaming availability (Subscription, Rent, Buy) by country code
  /// ('US', 'IN', 'GB', 'CA') powered by JustWatch data on TMDB.
  ///
  /// Falls back gracefully to curated mock streaming availability.
  Future<Map<String, List<StreamingProvider>>> getWatchProviders(dynamic movieId) async {
    final idStr = movieId.toString();

    if (hasApiKey) {
      try {
        final uri = Uri.parse('$baseUrl/movie/$idStr/watch/providers?api_key=$apiKey');
        final body = await _httpGet(uri);
        final data = jsonDecode(body) as Map<String, dynamic>;
        final results = data['results'] as Map<String, dynamic>?;

        if (results != null) {
          final Map<String, List<StreamingProvider>> providersByCountry = {};
          const targetCountries = ['US', 'IN', 'GB', 'CA'];

          for (final country in targetCountries) {
            final countryData = results[country] as Map<String, dynamic>?;
            if (countryData != null) {
              providersByCountry[country] = _parseCountryProviders(country, countryData);
            }
          }

          if (providersByCountry.isNotEmpty) {
            return providersByCountry;
          }
        }
      } catch (_) {
        // Fall through to fallback
      }
    }

    // Fallback to sample streaming data
    return _getFallbackWatchProviders(idStr);
  }

  // ===========================================================================
  // 4. CREDITS (Cast & Key Crew)
  // ===========================================================================

  /// Fetches cast members with profile pictures and assigns signature vibes.
  Future<List<CastMember>> getCredits(dynamic movieId) async {
    final idStr = movieId.toString();

    if (hasApiKey) {
      try {
        final uri = Uri.parse('$baseUrl/movie/$idStr/credits?api_key=$apiKey');
        final body = await _httpGet(uri);
        final data = jsonDecode(body) as Map<String, dynamic>;
        final castList = data['cast'] as List<dynamic>?;

        if (castList != null && castList.isNotEmpty) {
          return castList.take(6).map((c) {
            final map = c as Map<String, dynamic>;
            final profilePath = map['profile_path'] as String?;
            return CastMember(
              name: map['name'] as String? ?? 'Actor',
              character: map['character'] as String? ?? '',
              profileUrl: profilePath != null
                  ? '$imageBaseW185$profilePath'
                  : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
              signatureVibe: _assignVibeForCast(map['order'] as int? ?? 0),
            );
          }).toList();
        }
      } catch (_) {
        // Fall through
      }
    }

    final fallbackItem = _getFallbackMovieDetails(idStr);
    return fallbackItem?.cast ?? const [];
  }

  // ===========================================================================
  // 5. ACTOR / PERSON PROFILE (Biography, Filmography, Box Office)
  // ===========================================================================

  /// Fetches actor profile with cumulative filmography credits.
  Future<ActorProfile?> getPersonProfile(dynamic personId) async {
    final idStr = personId.toString();

    if (hasApiKey) {
      try {
        final uri = Uri.parse(
          '$baseUrl/person/$idStr?api_key=$apiKey&append_to_response=movie_credits',
        );

        final body = await _httpGet(uri);
        final data = jsonDecode(body) as Map<String, dynamic>;

        final name = data['name'] as String? ?? 'Actor';
        final biography = data['biography'] as String? ?? 'No biography available.';
        final birthDate = data['birthday'] as String? ?? 'Unknown';
        final birthplace = data['place_of_birth'] as String? ?? 'Unknown';
        final profilePath = data['profile_path'] as String?;
        final profileUrl = profilePath != null
            ? '$imageBaseW185$profilePath'
            : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300';

        // Parse filmography credits
        final creditsMap = data['movie_credits'] as Map<String, dynamic>?;
        final rawCast = creditsMap?['cast'] as List<dynamic>? ?? [];

        final filmography = <ActorMovieCredit>[];
        double cumulativeBoxOffice = 0;

        for (final item in rawCast.take(15)) {
          final m = item as Map<String, dynamic>;
          final title = m['title'] as String? ?? 'Untitled';
          final posterPath = m['poster_path'] as String?;
          final rating = (m['vote_average'] as num?)?.toDouble() ?? 7.0;
          final releaseDate = m['release_date'] as String?;
          final releaseYear = _extractYear(releaseDate);
          final pop = (m['popularity'] as num?)?.toInt() ?? 5000;

          // Box office calculation estimate
          final grossMillions = 50.0 + (rating * 35.0);
          cumulativeBoxOffice += grossMillions;

          filmography.add(
            ActorMovieCredit(
              mediaId: m['id'].toString(),
              title: title,
              character: m['character'] as String? ?? 'Cast',
              releaseYear: releaseYear,
              rating: double.parse(rating.toStringAsFixed(1)),
              boxOfficeGrossMillions: double.parse(grossMillions.toStringAsFixed(1)),
              boxOfficeFormatted: '\$${grossMillions.toStringAsFixed(1)}M',
              popularityScore: pop,
              dominantVibe: _vibeFromRating(rating),
              vibes: [_vibeFromRating(rating), VibeType.mustWatch],
              posterUrl: posterPath != null
                  ? '$imageBaseW500$posterPath'
                  : 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400',
            ),
          );
        }

        final totalGrossFormatted = cumulativeBoxOffice > 1000
            ? '\$${(cumulativeBoxOffice / 1000).toStringAsFixed(1)} Billion Worldwide'
            : '\$${cumulativeBoxOffice.toStringAsFixed(0)} Million Worldwide';

        return ActorProfile(
          id: idStr,
          name: name,
          knownForRole: data['known_for_department'] as String? ?? 'Actor & Producer',
          birthDate: birthDate,
          birthplace: birthplace,
          profileUrl: profileUrl,
          biography: biography,
          totalBoxOfficeFormatted: totalGrossFormatted,
          averageRating: 7.8,
          filmography: filmography,
          vibeBreakdownPercentages: const {
            VibeType.mustWatch: 35,
            VibeType.mindBlown: 25,
            VibeType.funTime: 20,
            VibeType.emotionalDamage: 15,
            VibeType.hiddenGem: 5,
          },
        );
      } catch (_) {
        // Fall through to fallback
      }
    }

    // Fallback to sample actors
    final actors = MockData.getSampleActors();
    return actors.firstWhere(
      (a) => a.id == idStr || a.name.toLowerCase().contains(idStr.toLowerCase()),
      orElse: () => actors.first,
    );
  }

  // ===========================================================================
  // INTERNAL PARSING HELPERS
  // ===========================================================================

  MediaItem _parseMovieSearchItem(Map<String, dynamic> map) {
    final id = map['id'].toString();
    final title = map['title'] as String? ?? 'Untitled';
    final releaseDate = map['release_date'] as String?;
    final releaseYear = _extractYear(releaseDate);
    final genreIds = (map['genre_ids'] as List<dynamic>?)?.cast<int>() ?? [];
    final genres = genreIds.map((id) => genreMap[id] ?? 'Cinema').toList();
    if (genres.isEmpty) genres.add('Cinema');

    final posterPath = map['poster_path'] as String?;
    final backdropPath = map['backdrop_path'] as String?;
    final rating = (map['vote_average'] as num?)?.toDouble() ?? 7.5;
    final voteCount = (map['vote_count'] as num?)?.toInt() ?? 500;

    return MediaItem(
      id: id,
      title: title,
      type: MediaType.movie,
      releaseYear: releaseYear,
      genres: genres,
      language: (map['original_language'] as String? ?? 'en').toUpperCase(),
      duration: '2h 10m',
      directorOrCreator: 'Director',
      posterUrl: posterPath != null
          ? '$imageBaseW500$posterPath'
          : 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
      backdropUrl: backdropPath != null
          ? '$imageBaseOriginal$backdropPath'
          : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
      synopsis: map['overview'] as String? ?? 'No synopsis available.',
      averageRating: double.parse(rating.toStringAsFixed(1)),
      totalRatingsCount: voteCount,
      totalVoters: 1000,
      vibeVotes: estimateVibeVotes(rating: rating, genres: genres),
    );
  }

  MediaItem _parseTvSearchItem(Map<String, dynamic> map) {
    final id = map['id'].toString();
    final title = map['name'] as String? ?? 'Untitled Series';
    final airDate = map['first_air_date'] as String?;
    final releaseYear = _extractYear(airDate);
    final genreIds = (map['genre_ids'] as List<dynamic>?)?.cast<int>() ?? [];
    final genres = genreIds.map((id) => genreMap[id] ?? 'TV Series').toList();
    if (genres.isEmpty) genres.add('Drama');

    final posterPath = map['poster_path'] as String?;
    final backdropPath = map['backdrop_path'] as String?;
    final rating = (map['vote_average'] as num?)?.toDouble() ?? 7.8;
    final voteCount = (map['vote_count'] as num?)?.toInt() ?? 600;

    return MediaItem(
      id: id,
      title: title,
      type: MediaType.series,
      releaseYear: releaseYear,
      genres: genres,
      language: (map['original_language'] as String? ?? 'en').toUpperCase(),
      duration: '1 Season',
      directorOrCreator: 'Showrunner',
      posterUrl: posterPath != null
          ? '$imageBaseW500$posterPath'
          : 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
      backdropUrl: backdropPath != null
          ? '$imageBaseOriginal$backdropPath'
          : 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
      synopsis: map['overview'] as String? ?? 'No synopsis available.',
      averageRating: double.parse(rating.toStringAsFixed(1)),
      totalRatingsCount: voteCount,
      totalVoters: 1000,
      vibeVotes: estimateVibeVotes(rating: rating, genres: genres),
    );
  }

  MediaItem _parseFullMovieDetails(Map<String, dynamic> data) {
    final id = data['id'].toString();
    final title = data['title'] as String? ?? 'Untitled';
    final releaseDate = data['release_date'] as String?;
    final releaseYear = _extractYear(releaseDate);
    final runtimeMinutes = data['runtime'] as int? ?? 120;
    final durationFormatted = formatRuntime(runtimeMinutes);

    final rawGenres = data['genres'] as List<dynamic>? ?? [];
    final genres = rawGenres.map((g) => (g as Map<String, dynamic>)['name'] as String).toList();
    if (genres.isEmpty) genres.add('Cinema');

    final posterPath = data['poster_path'] as String?;
    final backdropPath = data['backdrop_path'] as String?;
    final rating = (data['vote_average'] as num?)?.toDouble() ?? 7.5;
    final voteCount = (data['vote_count'] as num?)?.toInt() ?? 1000;

    // Parse Credits
    final credits = data['credits'] as Map<String, dynamic>?;
    final rawCast = credits?['cast'] as List<dynamic>? ?? [];
    final rawCrew = credits?['crew'] as List<dynamic>? ?? [];

    final cast = rawCast.take(5).map((c) {
      final map = c as Map<String, dynamic>;
      final profilePath = map['profile_path'] as String?;
      return CastMember(
        name: map['name'] as String? ?? 'Actor',
        character: map['character'] as String? ?? '',
        profileUrl: profilePath != null
            ? '$imageBaseW185$profilePath'
            : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        signatureVibe: _assignVibeForCast(map['order'] as int? ?? 0),
      );
    }).toList();

    String director = 'Director';
    final keyCrew = <CrewMember>[];
    for (final cr in rawCrew) {
      final map = cr as Map<String, dynamic>;
      final job = map['job'] as String? ?? '';
      if (job == 'Director') {
        director = map['name'] as String? ?? director;
        keyCrew.add(
          CrewMember(
            name: director,
            role: 'Director',
            profileUrl: map['profile_path'] != null
                ? '$imageBaseW185${map['profile_path']}'
                : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          ),
        );
      } else if (job == 'Original Music Composer' || job == 'Composer') {
        keyCrew.add(
          CrewMember(
            name: map['name'] as String? ?? 'Composer',
            role: 'Composer',
            profileUrl: map['profile_path'] != null
                ? '$imageBaseW185${map['profile_path']}'
                : 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
          ),
        );
      }
    }

    // Parse Watch Providers
    final watchProvidersData = data['watch/providers'] as Map<String, dynamic>?;
    final watchResults = watchProvidersData?['results'] as Map<String, dynamic>?;
    final Map<String, List<StreamingProvider>> streamingByCountry = {};

    if (watchResults != null) {
      for (final country in ['US', 'IN', 'GB', 'CA']) {
        final cData = watchResults[country] as Map<String, dynamic>?;
        if (cData != null) {
          streamingByCountry[country] = _parseCountryProviders(country, cData);
        }
      }
    }

    return MediaItem(
      id: id,
      title: title,
      type: MediaType.movie,
      releaseYear: releaseYear,
      genres: genres,
      language: (data['original_language'] as String? ?? 'en').toUpperCase(),
      duration: durationFormatted,
      directorOrCreator: director,
      posterUrl: posterPath != null
          ? '$imageBaseW500$posterPath'
          : 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
      backdropUrl: backdropPath != null
          ? '$imageBaseOriginal$backdropPath'
          : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
      synopsis: data['overview'] as String? ?? 'No overview available.',
      averageRating: double.parse(rating.toStringAsFixed(1)),
      totalRatingsCount: voteCount,
      totalVoters: 1000,
      vibeVotes: estimateVibeVotes(rating: rating, genres: genres),
      cast: cast,
      keyCrew: keyCrew,
      streamingByCountry: streamingByCountry.isNotEmpty
          ? streamingByCountry
          : _getFallbackWatchProviders(id),
      viewingGuide: _synthesizeViewingGuide(title, genres, rating),
    );
  }

  List<StreamingProvider> _parseCountryProviders(
    String countryCode,
    Map<String, dynamic> data,
  ) {
    final list = <StreamingProvider>[];

    // 1. Subscription streaming (flatrate)
    final flatrate = data['flatrate'] as List<dynamic>? ?? [];
    for (final p in flatrate) {
      final map = p as Map<String, dynamic>;
      final name = map['provider_name'] as String? ?? 'Stream';
      final logo = map['logo_path'] as String?;
      list.add(
        StreamingProvider(
          name: name,
          logoUrl: logo != null
              ? '$imageBaseW92$logo'
              : FreeApis.providerLogos[name] ?? 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=100',
          type: 'stream',
        ),
      );
    }

    // 2. Rent
    final rent = data['rent'] as List<dynamic>? ?? [];
    for (final p in rent.take(2)) {
      final map = p as Map<String, dynamic>;
      final name = map['provider_name'] as String? ?? 'Rent';
      final logo = map['logo_path'] as String?;
      list.add(
        StreamingProvider(
          name: name,
          logoUrl: logo != null
              ? '$imageBaseW92$logo'
              : FreeApis.providerLogos[name] ?? 'https://images.unsplash.com/photo-1523474253246-63e8a4a79669?w=100',
          type: 'rent',
          price: countryCode == 'IN' ? '₹120' : '\$3.99',
        ),
      );
    }

    // 3. Buy
    final buy = data['buy'] as List<dynamic>? ?? [];
    for (final p in buy.take(1)) {
      final map = p as Map<String, dynamic>;
      final name = map['provider_name'] as String? ?? 'Buy';
      final logo = map['logo_path'] as String?;
      list.add(
        StreamingProvider(
          name: name,
          logoUrl: logo != null
              ? '$imageBaseW92$logo'
              : FreeApis.providerLogos[name] ?? 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=100',
          type: 'buy',
          price: countryCode == 'IN' ? '₹490' : '\$14.99',
        ),
      );
    }

    return list;
  }

  // ===========================================================================
  // VIBE & SENSORY SYNTHESIS ENGINES
  // ===========================================================================

  /// Generates realistic audience vibe distributions matching the 7 signature vibes.
  static Map<VibeType, int> estimateVibeVotes({
    required double rating,
    required List<String> genres,
    int totalVotes = 1000,
  }) {
    final lowerGenres = genres.map((g) => g.toLowerCase()).toSet();
    final bool isSciFiOrMystery = lowerGenres.any(
      (g) => g.contains('sci-fi') || g.contains('mystery') || g.contains('thriller'),
    );
    final bool isDramaOrRomance = lowerGenres.any(
      (g) => g.contains('drama') || g.contains('romance'),
    );
    final bool isComedyOrAction = lowerGenres.any(
      (g) => g.contains('comedy') || g.contains('action') || g.contains('animation'),
    );

    int mustWatch = rating >= 8.0 ? 780 : (rating >= 7.0 ? 450 : 150);
    int mindBlown = isSciFiOrMystery ? 820 : (rating >= 8.2 ? 600 : 250);
    int emotionalDamage = isDramaOrRomance ? 790 : (rating >= 8.0 ? 420 : 180);
    int funTime = isComedyOrAction ? 840 : 220;
    int hiddenGem = rating >= 7.8 ? 320 : 110;
    int timePass = rating < 7.2 ? 550 : 80;
    int skipIt = rating < 6.0 ? 620 : 20;

    return {
      VibeType.mustWatch: mustWatch,
      VibeType.mindBlown: mindBlown,
      VibeType.emotionalDamage: emotionalDamage,
      VibeType.hiddenGem: hiddenGem,
      VibeType.funTime: funTime,
      VibeType.timePass: timePass,
      VibeType.skipIt: skipIt,
    };
  }

  ViewingGuide _synthesizeViewingGuide(String title, List<String> genres, double rating) {
    final lower = genres.map((g) => g.toLowerCase()).toList();
    final isMindBending = lower.any((g) => g.contains('sci') || g.contains('thrill') || g.contains('myst'));
    final isEmotional = lower.any((g) => g.contains('drama') || g.contains('romance'));

    return ViewingGuide(
      idealEnvironment: isMindBending
          ? 'Late night solo • Pitch black room • High volume / Headphones'
          : 'Weekend prime time • Big screen • Great snacks',
      pacing: isMindBending
          ? 'Slow Burn (first 30m) ➔ Heart-stopping Climax'
          : 'High Momentum • Balanced pacing throughout',
      cryGauge: isEmotional ? 8 : (rating >= 8.0 ? 6 : 2),
      attentionLevel: isMindBending
          ? '100% Full Focus (Put phones away)'
          : 'Relaxed focus • Great with friends',
    );
  }

  static VibeType _vibeFromRating(double rating) {
    if (rating >= 8.5) return VibeType.mustWatch;
    if (rating >= 7.8) return VibeType.mindBlown;
    if (rating >= 7.0) return VibeType.funTime;
    return VibeType.timePass;
  }

  static VibeType _assignVibeForCast(int order) {
    switch (order) {
      case 0:
        return VibeType.mustWatch;
      case 1:
        return VibeType.emotionalDamage;
      case 2:
        return VibeType.mindBlown;
      case 3:
        return VibeType.hiddenGem;
      default:
        return VibeType.funTime;
    }
  }

  static String formatRuntime(int minutes) {
    if (minutes <= 0) return '2h';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h == 0) return '${m}m';
    if (m == 0) return '${h}h';
    return '${h}h ${m}m';
  }

  static int _extractYear(String? dateStr) {
    if (dateStr == null || dateStr.length < 4) return DateTime.now().year;
    return int.tryParse(dateStr.substring(0, 4)) ?? DateTime.now().year;
  }

  // ===========================================================================
  // FALLBACK DISPATCHERS
  // ===========================================================================

  List<MediaItem> _getFallbackSearch(String query) {
    final lower = query.toLowerCase();
    final sampleMedia = MockData.getSampleMedia();
    final filtered = sampleMedia.where((m) {
      return m.title.toLowerCase().contains(lower) ||
          m.directorOrCreator.toLowerCase().contains(lower) ||
          m.genres.any((g) => g.toLowerCase().contains(lower)) ||
          m.cast.any((c) => c.name.toLowerCase().contains(lower));
    }).toList();

    return filtered.isNotEmpty ? filtered : sampleMedia;
  }

  MediaItem? _getFallbackMovieDetails(String idOrTitle) {
    final sampleMedia = MockData.getSampleMedia();
    final lower = idOrTitle.toLowerCase();
    for (final item in sampleMedia) {
      if (item.id.toLowerCase() == lower || item.title.toLowerCase().contains(lower)) {
        return item;
      }
    }
    return sampleMedia.first;
  }

  Map<String, List<StreamingProvider>> _getFallbackWatchProviders(String id) {
    final item = _getFallbackMovieDetails(id);
    if (item != null && item.streamingByCountry.isNotEmpty) {
      return item.streamingByCountry;
    }

    return const {
      'US': [
        StreamingProvider(
          name: 'Paramount+',
          logoUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=100',
          type: 'stream',
        ),
        StreamingProvider(
          name: 'Prime Video',
          logoUrl: 'https://images.unsplash.com/photo-1523474253246-63e8a4a79669?w=100',
          type: 'rent',
          price: '\$3.99',
        ),
      ],
      'IN': [
        StreamingProvider(
          name: 'JioCinema',
          logoUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=100',
          type: 'stream',
        ),
        StreamingProvider(
          name: 'Prime Video',
          logoUrl: 'https://images.unsplash.com/photo-1523474253246-63e8a4a79669?w=100',
          type: 'rent',
          price: '₹120',
        ),
      ],
      'GB': [
        StreamingProvider(
          name: 'Netflix',
          logoUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=100',
          type: 'stream',
        ),
      ],
      'CA': [
        StreamingProvider(
          name: 'Crave',
          logoUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100',
          type: 'stream',
        ),
      ],
    };
  }

  /// Fetches weekly trending actors from TMDB `/trending/person/{timeWindow}`
  /// Gracefully falls back to MockData if offline or no key is present.
  Future<List<ActorProfile>> getTrendingActors({String timeWindow = 'week'}) async {
    if (!hasApiKey) {
      return MockData.getSampleActors().where((a) => a.isHypedNow).toList();
    }
    final uri = Uri.parse('$baseUrl/trending/person/$timeWindow?api_key=$apiKey');
    try {
      final jsonStr = await _httpGet(uri);
      final data = jsonDecode(jsonStr);
      final results = data['results'] as List<dynamic>? ?? [];
      final List<ActorProfile> list = [];
      int rank = 1;
      for (final person in results.take(6)) {
        final id = person['id'].toString();
        final name = person['name'] ?? 'Unknown Actor';
        final profilePath = person['profile_path'];
        final knownFor = person['known_for_department'] ?? 'Acting';
        final profileUrl = profilePath != null
            ? '$imageBaseW500$profilePath'
            : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300';

        final knownForList = (person['known_for'] as List<dynamic>? ?? [])
            .map((k) => k['title'] ?? k['name'] ?? '')
            .where((t) => (t as String).isNotEmpty)
            .take(2)
            .join(' + ');

        list.add(
          ActorProfile(
            id: 'tmdb-person-$id',
            name: name,
            knownForRole: knownFor,
            birthDate: 'Actor Spotlight',
            birthplace: 'International',
            profileUrl: profileUrl,
            biography: 'Trending actor featured in $knownForList.',
            totalBoxOfficeFormatted: '\$2.5B Worldwide',
            averageRating: 8.5,
            isHypedNow: true,
            hypeContext: '🔥 Hyped for: $knownForList',
            weeklyTrendRank: rank++,
            searchSurgePercentage: 50 + (10 - rank).clamp(5, 40),
            filmography: [],
            vibeBreakdownPercentages: {
              VibeType.mustWatch: 50,
              VibeType.mindBlown: 30,
              VibeType.funTime: 20,
            },
          ),
        );
      }
      return list.isNotEmpty ? list : MockData.getSampleActors().where((a) => a.isHypedNow).toList();
    } catch (e) {
      return MockData.getSampleActors().where((a) => a.isHypedNow).toList();
    }
  }

  /// Fetches fresh streaming releases from TMDB `/discover/movie` with digital release flags
  Future<List<MediaItem>> getFreshOttReleases({String country = 'US'}) async {
    if (!hasApiKey) {
      return MockData.getSampleMedia().where((m) => m.isFreshOttRelease).toList();
    }
    final uri = Uri.parse(
      '$baseUrl/discover/movie?api_key=$apiKey&watch_region=$country&with_watch_monetization_types=flatrate&sort_by=primary_release_date.desc',
    );
    try {
      final jsonStr = await _httpGet(uri);
      final data = jsonDecode(jsonStr);
      final results = data['results'] as List<dynamic>? ?? [];
      final List<MediaItem> list = [];
      int days = 1;
      for (final m in results.take(8)) {
        final item = _parseMovieFromJson(m);
        list.add(
          MediaItem(
            id: item.id,
            title: item.title,
            type: item.type,
            releaseYear: item.releaseYear,
            genres: item.genres,
            language: item.language,
            duration: item.duration,
            directorOrCreator: item.directorOrCreator,
            posterUrl: item.posterUrl,
            backdropUrl: item.backdropUrl,
            synopsis: item.synopsis,
            averageRating: item.averageRating,
            totalRatingsCount: item.totalRatingsCount,
            totalVoters: item.totalVoters,
            vibeVotes: item.vibeVotes,
            isFreshOttRelease: true,
            ottReleaseDaysAgo: days++,
            ottPlatform: 'Streaming',
          ),
        );
      }
      return list.isNotEmpty ? list : MockData.getSampleMedia().where((m) => m.isFreshOttRelease).toList();
    } catch (e) {
      return MockData.getSampleMedia().where((m) => m.isFreshOttRelease).toList();
    }
  }
}
