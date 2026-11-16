import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../models/media_item.dart';
import '../data/mock_data.dart';
import 'free_apis.dart';

typedef HttpGetHandler = Future<String> Function(Uri uri);

/// Client for Apple / iTunes Search API.
///
/// 100% Free with zero API keys or authentication needed.
/// Used to retrieve 30-second high-quality audio previews (.m4a) and metadata
/// for movie scores, themes, and soundtrack albums.
///
/// Features graceful offline/failure fallback to curated mock data.
class ITunesClient {
  static const String itunesSearchBaseUrl = FreeApis.itunesSearchUrl;

  final HttpGetHandler _httpGet;

  ITunesClient({HttpGetHandler? httpGetHandler})
      : _httpGet = httpGetHandler ?? _defaultHttpGet;

  /// Default HTTP GET implementation using Dart's built-in HttpClient.
  /// Zero third-party dependencies required.
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

  /// Searches for a 30-second soundtrack preview for a given movie or TV show.
  ///
  /// Automatically appends relevant keywords ('soundtrack', 'score', or composer name)
  /// to ensure the top result is the signature instrumental theme.
  ///
  /// Returns a [SoundtrackInfo] instance with direct .m4a audio stream URL.
  /// If offline, on network timeout, or if no matches are found, seamlessly returns
  /// curated fallback mock soundtrack data.
  Future<SoundtrackInfo?> searchSoundtrack(
    String movieTitle, {
    String? composer,
    String? trackHint,
  }) async {
    if (movieTitle.trim().isEmpty) {
      return null;
    }

    try {
      // Build optimized search query
      final queryBuffer = StringBuffer(movieTitle.trim());
      if (composer != null && composer.trim().isNotEmpty) {
        queryBuffer.write(' ${composer.trim()}');
      } else if (trackHint != null && trackHint.trim().isNotEmpty) {
        queryBuffer.write(' ${trackHint.trim()}');
      } else {
        queryBuffer.write(' soundtrack score');
      }

      final uri = Uri.parse(
        '$itunesSearchBaseUrl?term=${Uri.encodeComponent(queryBuffer.toString())}&media=music&entity=song&limit=5',
      );

      final responseBody = await _httpGet(uri);
      final data = jsonDecode(responseBody) as Map<String, dynamic>;

      final results = data['results'] as List<dynamic>?;
      if (results != null && results.isNotEmpty) {
        // Pick the best match that has a valid previewUrl
        for (final item in results) {
          final itemMap = item as Map<String, dynamic>;
          final previewUrl = itemMap['previewUrl'] as String?;
          if (previewUrl != null && previewUrl.isNotEmpty) {
            return SoundtrackInfo(
              themeTitle: itemMap['trackName'] as String? ?? '$movieTitle Theme',
              composer: itemMap['artistName'] as String? ?? composer ?? 'Original Score',
              duration: formatDurationMs(itemMap['trackTimeMillis'] as int?),
              previewAudioUrl: previewUrl,
              spotifyUrl: itemMap['trackViewUrl'] as String? ??
                  itemMap['collectionViewUrl'] as String? ??
                  'https://music.apple.com',
            );
          }
        }
      }
    } catch (_) {
      // Graceful degradation on network timeout, offline, or parsing error
    }

    // Fallback to rich mock soundtrack data
    return getFallbackSoundtrack(movieTitle, composer: composer);
  }

  /// Searches and returns multiple soundtrack tracks from the album.
  /// Useful for soundtrack tracklists and score playlists.
  Future<List<SoundtrackInfo>> searchMultipleTracks(
    String movieTitle, {
    String? composer,
    int limit = 5,
  }) async {
    if (movieTitle.trim().isEmpty) return const [];

    try {
      final query = '$movieTitle ${composer ?? ''} soundtrack score'.trim();
      final uri = Uri.parse(
        '$itunesSearchBaseUrl?term=${Uri.encodeComponent(query)}&media=music&entity=song&limit=$limit',
      );

      final responseBody = await _httpGet(uri);
      final data = jsonDecode(responseBody) as Map<String, dynamic>;
      final results = data['results'] as List<dynamic>?;

      if (results != null && results.isNotEmpty) {
        final list = <SoundtrackInfo>[];
        for (final item in results) {
          final itemMap = item as Map<String, dynamic>;
          final previewUrl = itemMap['previewUrl'] as String?;
          if (previewUrl != null && previewUrl.isNotEmpty) {
            list.add(
              SoundtrackInfo(
                themeTitle: itemMap['trackName'] as String? ?? '$movieTitle Theme',
                composer: itemMap['artistName'] as String? ?? composer ?? 'Original Score',
                duration: formatDurationMs(itemMap['trackTimeMillis'] as int?),
                previewAudioUrl: previewUrl,
                spotifyUrl: itemMap['trackViewUrl'] as String? ?? 'https://music.apple.com',
              ),
            );
          }
        }
        if (list.isNotEmpty) return list;
      }
    } catch (_) {
      // Fall through to fallback
    }

    final fallback = getFallbackSoundtrack(movieTitle, composer: composer);
    return [fallback];
  }

  /// Formats millisecond duration (e.g., 126960) into standard "M:SS" string (e.g. "2:06").
  static String formatDurationMs(int? millis) {
    if (millis == null || millis <= 0) return '0:30';
    final totalSeconds = (millis / 1000).round();
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  /// Fallback generator matching titles against existing curated [MockData] samples.
  static SoundtrackInfo getFallbackSoundtrack(String movieTitle, {String? composer}) {
    final lower = movieTitle.toLowerCase();

    // Check against mock media catalog
    final mockSamples = MockData.getSampleMedia();
    for (final sample in mockSamples) {
      if (sample.soundtrack != null) {
        if (sample.title.toLowerCase().contains(lower) ||
            lower.contains(sample.title.toLowerCase()) ||
            sample.id.toLowerCase() == lower) {
          return sample.soundtrack!;
        }
      }
    }

    // Specific well-known defaults
    if (lower.contains('interstellar')) {
      return const SoundtrackInfo(
        themeTitle: 'Cornfield Chase / Stay',
        composer: 'Hans Zimmer',
        duration: '3:56',
        previewAudioUrl:
            'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3a/ee/23/3aee2300-f6f7-a006-e20f-28092e814cbe/mzaf_1624587954644600228.plus.aac.p.m4a',
        spotifyUrl: 'https://open.spotify.com/album/4eIik8v9T7bK9uF0v3jZ12',
      );
    }

    if (lower.contains('severance')) {
      return const SoundtrackInfo(
        themeTitle: 'Severance (Main Titles)',
        composer: 'Theodore Shapiro',
        duration: '1:44',
        previewAudioUrl:
            'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/44/73/a2/4473a216-6608-7374-3f47-de685c2b9900/mzaf_15260397258405429994.plus.aac.p.m4a',
        spotifyUrl: 'https://music.apple.com',
      );
    }

    // Generic graceful audio fallback with live audio preview sample
    return SoundtrackInfo(
      themeTitle: '$movieTitle Main Theme',
      composer: composer ?? 'Original Motion Picture Score',
      duration: '2:30',
      previewAudioUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3a/ee/23/3aee2300-f6f7-a006-e20f-28092e814cbe/mzaf_1624587954644600228.plus.aac.p.m4a',
      spotifyUrl: 'https://music.apple.com/us/search?term=${Uri.encodeComponent('$movieTitle soundtrack')}',
    );
  }
}

/// Alias for flexible casing
typedef ItunesClient = ITunesClient;
