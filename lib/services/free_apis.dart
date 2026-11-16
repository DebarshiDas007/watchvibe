/// Free APIs Integration Guide & Helper for WATCHVIBE
/// All APIs used here are 100% free with no credit card required.
///
/// 1. TMDB (The Movie Database) API:
///    - Free signup at: https://www.themoviedb.org/signup
///    - Provides:
///      * Movie details, synopsis, ratings, release dates
///      * Full Cast & Crew (Actors, Directors, Composers, Cinematographers)
///      * Where to watch streaming providers per country powered by JustWatch
///      * High-resolution backdrops and posters
///    - Endpoints:
///      * Movie Details: https://api.themoviedb.org/3/movie/{movie_id}?api_key={KEY}
///      * Cast & Crew: https://api.themoviedb.org/3/movie/{movie_id}/credits?api_key={KEY}
///      * Streaming Providers: https://api.themoviedb.org/3/movie/{movie_id}/watch/providers?api_key={KEY}
///
/// 2. Apple / iTunes Search API:
///    - 100% Free, NO API key or authentication needed!
///    - Returns 30-second high quality audio preview clips (.m4a) for any movie score or soundtrack.
///    - Endpoint:
///      * https://itunes.apple.com/search?term={MOVIE_TITLE}+soundtrack&media=music&limit=1

class FreeApis {
  static const String tmdbBaseUrl = 'https://api.themoviedb.org/3';
  static const String itunesSearchUrl = 'https://itunes.apple.com/search';

  /// Generates the free TMDB streaming provider URL
  static String getWatchProvidersUrl(int movieId, String apiKey) {
    return '$tmdbBaseUrl/movie/$movieId/watch/providers?api_key=$apiKey';
  }

  /// Generates the free iTunes 30-second soundtrack preview lookup URL
  static String getSoundtrackPreviewLookupUrl(String movieTitle) {
    final query = Uri.encodeComponent('$movieTitle soundtrack hans zimmer score');
    return '$itunesSearchUrl?term=$query&media=music&entity=song&limit=1';
  }

  /// Common streaming provider logos (hosted free on TMDB CDN / Wikimedia)
  static const Map<String, String> providerLogos = {
    'Netflix': 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=100',
    'Apple TV+': 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=100',
    'Prime Video': 'https://images.unsplash.com/photo-1523474253246-63e8a4a79669?w=100',
    'Disney+': 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100',
    'Paramount+': 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=100',
    'JioCinema': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=100',
  };
}
