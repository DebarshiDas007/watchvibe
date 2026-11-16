import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/vibe_type.dart';
import '../models/media_item.dart';
import '../models/actor_profile.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import '../widgets/vibe_badge.dart';
import '../widgets/rate_vibe_dialog.dart';
import '../widgets/watch_battle_card.dart';
import '../widgets/swipe_deck.dart';
import 'media_details_sheet.dart';
import 'actor_profile_sheet.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({Key? key}) : super(key: key);

  void _openDetails(BuildContext context, MediaItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MediaDetailsSheet(media: item),
      ),
    );
  }

  void _openActor(BuildContext context, ActorProfile actor) {
    ActorProfileSheet.show(context, actor);
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context);
    final heroItem = state.allMedia.first; // Interstellar
    final johnnyDepp = state.allActors.firstWhere(
      (a) => a.id == 'johnny-depp',
      orElse: () => state.allActors.first,
    );

    final countryProviders = heroItem.streamingByCountry[state.selectedCountry] ?? 
                             heroItem.streamingByCountry['US'] ?? [];
    final topStreamer = countryProviders.isNotEmpty ? countryProviders.first : null;

    final Map<String, String> countries = {
      'US': '🇺🇸 US',
      'IN': '🇮🇳 IN',
      'GB': '🇬🇧 UK',
      'CA': '🇨🇦 CA',
    };

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // App Bar with Streaming Region Selector & Profile
          SliverAppBar(
            floating: true,
            backgroundColor: AppColors.background,
            elevation: 0,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [Color(0xFFC084FC), Color(0xFF60A5FA)],
                      ).createShader(bounds),
                      child: const Text(
                        'WATCHVIBE',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.5,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'BETA',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const Text(
                  "Don't just rate it. Tell us the vibe.",
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
            actions: [
              // Country Selector in Header
              Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: DropdownButton<String>(
                  value: state.selectedCountry,
                  dropdownColor: AppColors.card,
                  underline: const SizedBox.shrink(),
                  icon: const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary, size: 16),
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                  onChanged: (val) {
                    if (val != null) state.setSelectedCountry(val);
                  },
                  items: countries.entries.map((e) {
                    return DropdownMenuItem(value: e.key, child: Text(e.value));
                  }).toList(),
                ),
              ),
              const SizedBox(width: 12),
            ],
          ),

          // Main Scrollable Body
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 6),

                // FEATURE 1: UNIVERSAL SEARCH BAR WITH QUICK SHORTCUTS
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: TextField(
                    onChanged: (val) {
                      state.setSearchQuery(val);
                      if (val.isNotEmpty) state.setNavIndex(1); // Jump to explore search
                    },
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Search actors (Johnny Depp), movies, vibes...',
                      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      prefixIcon: const Icon(Icons.search, color: AppColors.primary, size: 18),
                      filled: true,
                      fillColor: AppColors.card,
                      contentPadding: const EdgeInsets.symmetric(vertical: 0),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.primary),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // FEATURE 2: "WHAT SHOULD I WATCH?" MOOD ENGINE
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      const Icon(Icons.psychology, size: 18, color: AppColors.primary),
                      const SizedBox(width: 6),
                      const Text(
                        'What should I watch?',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      if (state.activeMoodFilter != null)
                        TextButton(
                          onPressed: () => state.setMoodFilter(null),
                          child: const Text('Clear', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),

                // Horizontal Mood Chips
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    scrollDirection: Axis.horizontal,
                    itemCount: VibeType.values.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      final vibe = VibeType.values[i];
                      final isSelected = state.activeMoodFilter == vibe;
                      return VibeBadge(
                        vibe: vibe,
                        isSelected: isSelected,
                        onTap: () => state.setMoodFilter(vibe),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 20),

                // SECTION 1: FRESH ON OTT (JUST DROPPED RELEASES)
                _buildFreshOttSection(context, state),

                const SizedBox(height: 24),

                // SECTION 2: HYPED & TRENDING ACTORS RADAR
                _buildHypedActorsSection(context, state),

                const SizedBox(height: 24),

                // SECTION 3: SWIPE TO VIBE DECK (QUICK CALIBRATION)
                _buildSwipeDeckBanner(context, state),

                const SizedBox(height: 24),

                // FEATURE 3: HERO TITLE SPOTLIGHT WITH WHERE TO WATCH & SOUNDTRACK PREVIEW
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: AppColors.border),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        // Backdrop Header with Where to Watch & Vibe %
                        Stack(
                          children: [
                            Image.network(
                              heroItem.backdropUrl,
                              height: 180,
                              width: double.infinity,
                              fit: BoxFit.cover,
                            ),
                            Container(
                              height: 180,
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Colors.transparent, Color(0x99101014), Color(0xF01D1D25)],
                                  stops: [0.2, 0.7, 1.0],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                            ),
                            // Dominant Vibe badge
                            Positioned(
                              top: 12,
                              left: 12,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.black87,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.mustWatch),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.verified, size: 13, color: AppColors.mustWatch),
                                    const SizedBox(width: 5),
                                    Text(
                                      'Must Watch • ${heroItem.vibePercentages[VibeType.mustWatch]}%',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            // Where to Watch in selected region
                            if (topStreamer != null)
                              Positioned(
                                top: 12,
                                right: 12,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.black87,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: AppColors.secondary.withOpacity(0.6)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.tv, size: 12, color: AppColors.secondary),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Stream on ${topStreamer.name}',
                                        style: const TextStyle(color: AppColors.secondary, fontWeight: FontWeight.bold, fontSize: 10),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            // Title & Genres
                            Positioned(
                              bottom: 12,
                              left: 14,
                              right: 14,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          heroItem.title,
                                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                                        ),
                                        Text(
                                          '${heroItem.releaseYear} • ${heroItem.genres.join(", ")} • ★ ${heroItem.averageRating}',
                                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: () => _openDetails(context, heroItem),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    child: const Text('View Vibe', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        // Mini Soundtrack Player Strip on Home Hero
                        if (heroItem.soundtrack != null)
                          Container(
                            color: const Color(0xFF161622),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            child: Row(
                              children: [
                                InkWell(
                                  onTap: () => state.toggleSoundtrackPreview(heroItem.id),
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                                    child: Icon(
                                      (state.currentlyPlayingMediaId == heroItem.id && state.isSoundtrackPlaying)
                                          ? Icons.pause
                                          : Icons.play_arrow,
                                      color: Colors.white,
                                      size: 14,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Theme: ${heroItem.soundtrack!.themeTitle} • ${heroItem.soundtrack!.composer}',
                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const Text('🎵 3:56', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // FEATURE 4: ACTOR SPOTLIGHT OF THE WEEK (JOHNNY DEPP)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: InkWell(
                    onTap: () => _openActor(context, johnnyDepp),
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF261D38), AppColors.card],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                      ),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              johnnyDepp.profileUrl,
                              width: 55,
                              height: 65,
                              fit: BoxFit.cover,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: const [
                                    Icon(Icons.star, color: Colors.amber, size: 13),
                                    SizedBox(width: 4),
                                    Text(
                                      'ACTOR SPOTLIGHT',
                                      style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.1),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  johnnyDepp.name,
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '💰 ${johnnyDepp.totalBoxOfficeFormatted} • ${johnnyDepp.filmography.length} Iconic Titles',
                                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              'Profile →',
                              style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // FEATURE 5: TRENDING WITH WHERE TO WATCH TAGS
                _buildSectionHeader('Trending Vibes This Week', 'High community debates & ratings'),
                const SizedBox(height: 10),
                SizedBox(
                  height: 220,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    scrollDirection: Axis.horizontal,
                    itemCount: state.trendingMedia.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, i) {
                      final item = state.trendingMedia[i];
                      return _buildMediaCard(context, item, state.selectedCountry);
                    },
                  ),
                ),

                const SizedBox(height: 24),

                // SECTION: WEB SERIES & TV SHOWS BINGE HUB
                _buildTvSeriesSection(context, state),

                const SizedBox(height: 24),

                // FEATURE 6: COMMUNITY DOUBLE-FEATURE CARD
                if (heroItem.doubleFeature != null) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.secondary.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              heroItem.doubleFeature!.pairedPosterUrl,
                              width: 50,
                              height: 65,
                              fit: BoxFit.cover,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: const [
                                    Icon(Icons.layers_outlined, size: 13, color: AppColors.secondary),
                                    SizedBox(width: 4),
                                    Text(
                                      'DOUBLE-FEATURE OF THE WEEK',
                                      style: TextStyle(color: AppColors.secondary, fontSize: 10, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${heroItem.title} + ${heroItem.doubleFeature!.pairedTitle}',
                                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  heroItem.doubleFeature!.curationReason,
                                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // FEATURE 7: WEEKLY WATCH BATTLE CARD
                if (state.battles.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: WatchBattleCard(battle: state.battles.first),
                  ),
                  const SizedBox(height: 30),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          Text(
            subtitle,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildFreshOttSection(BuildContext context, WatchVibeState state) {
    final ottItems = state.freshOttReleases;
    final platforms = ['All', 'Netflix', 'Prime Video', 'Apple TV+', 'Max', 'Disney+'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('⚡ Fresh on OTT', 'Just dropped on streaming in the last 7 days'),
        const SizedBox(height: 10),
        SizedBox(
          height: 32,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: platforms.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final p = platforms[i];
              final isSelected = (p == 'All' && state.selectedOttPlatform == null) ||
                  (state.selectedOttPlatform == p);
              return InkWell(
                onTap: () {
                  state.setOttPlatform(p == 'All' ? null : p);
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : AppColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isSelected ? AppColors.primary : AppColors.border),
                  ),
                  child: Text(
                    p,
                    style: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 230,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: ottItems.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) => _buildOttMediaCard(context, ottItems[i]),
          ),
        ),
      ],
    );
  }

  Widget _buildOttMediaCard(BuildContext context, MediaItem item) {
    final dominant = item.dominantVibe;
    final pct = item.vibePercentages[dominant] ?? 0;

    return InkWell(
      onTap: () => _openDetails(context, item),
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 140,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    item.posterUrl,
                    width: 140,
                    height: 170,
                    fit: BoxFit.cover,
                  ),
                ),
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF06B6D4), Color(0xFF3B82F6)],
                      ),
                      borderRadius: BorderRadius.circular(6),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 4),
                      ],
                    ),
                    child: Text(
                      item.ottReleaseDaysAgo != null
                          ? '⚡ ${item.ottReleaseDaysAgo}d ago'
                          : '⚡ Fresh Drop',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                if (item.ottPlatform != null)
                  Positioned(
                    bottom: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.secondary.withOpacity(0.5)),
                      ),
                      child: Text(
                        item.ottPlatform!,
                        style: const TextStyle(
                          color: AppColors.secondary,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.8),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '★ ${item.averageRating}',
                      style: const TextStyle(color: Colors.amber, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              item.title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              '${dominant.label} ($pct%)',
              style: TextStyle(color: dominant.color, fontSize: 11, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHypedActorsSection(BuildContext context, WatchVibeState state) {
    final actors = state.hypedActors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('🔥 Hyped & Trending Actors', 'Breakout stars and awards buzz this week'),
        const SizedBox(height: 12),
        SizedBox(
          height: 145,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: actors.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) => _buildActorHypedCard(context, actors[i]),
          ),
        ),
      ],
    );
  }

  Widget _buildActorHypedCard(BuildContext context, ActorProfile actor) {
    return InkWell(
      onTap: () => _openActor(context, actor),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 170,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.primary.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundImage: NetworkImage(actor.profileUrl),
                    ),
                    if (actor.weeklyTrendRank != null)
                      Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '#${actor.weeklyTrendRank}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        actor.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (actor.searchSurgePercentage != null)
                        Text(
                          '↗ +${actor.searchSurgePercentage}% searches',
                          style: const TextStyle(
                            color: AppColors.mustWatch,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                actor.hypeContext ?? '⭐ Iconic Filmography',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSwipeDeckBanner(BuildContext context, WatchVibeState state) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: InkWell(
        onTap: () {
          SwipeDeck.showModal(
            context,
            items: state.allMedia,
            onSwipe: (item, action) {
              state.handleSwipeAction(item, action);
            },
          );
        },
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF331248), Color(0xFF141F3D)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.primary.withOpacity(0.5)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFA855F7), Color(0xFF3B82F6)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.swipe_outlined, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Swipe to Vibe Deck',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Calibrate taste in 30s • 4-Way Swipes',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Start ⚡',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTvSeriesSection(BuildContext context, WatchVibeState state) {
    final series = state.tvSeriesList;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader('🍿 Binge Hub: Web Series & TV Shows', 'Air status, hook rates & total binge commitment'),
        const SizedBox(height: 10),
        SizedBox(
          height: 240,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: series.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) => _buildSeriesCard(context, series[i]),
          ),
        ),
      ],
    );
  }

  Widget _buildSeriesCard(BuildContext context, MediaItem item) {
    final dominant = item.dominantVibe;
    final pct = item.vibePercentages[dominant] ?? 0;

    return InkWell(
      onTap: () => _openDetails(context, item),
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 150,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    item.posterUrl,
                    width: 150,
                    height: 160,
                    fit: BoxFit.cover,
                  ),
                ),
                if (item.airStatus != null)
                  Positioned(
                    top: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.mustWatch),
                      ),
                      child: Text(
                        item.airStatus!,
                        style: const TextStyle(
                          color: AppColors.mustWatch,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                if (item.episode1HookRating != null)
                  Positioned(
                    bottom: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '🔥 ${item.episode1HookRating}% Hook',
                        style: const TextStyle(
                          color: Colors.orangeAccent,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              item.title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              '⏱️ ${item.bingeHoursTotal ?? 8}h total • ${item.duration}',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              '${dominant.label} ($pct%)',
              style: TextStyle(color: dominant.color, fontSize: 11, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaCard(BuildContext context, MediaItem item, String country) {
    final dominant = item.dominantVibe;
    final pct = item.vibePercentages[dominant] ?? 0;
    final provList = item.streamingByCountry[country] ?? item.streamingByCountry['US'] ?? [];
    final streamProvider = provList.firstWhere(
      (p) => p.type == 'stream',
      orElse: () => provList.isNotEmpty ? provList.first : const StreamingProvider(name: 'Netflix', logoUrl: '', type: 'stream'),
    );

    return InkWell(
      onTap: () => _openDetails(context, item),
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 130,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    item.posterUrl,
                    width: 130,
                    height: 160,
                    fit: BoxFit.cover,
                  ),
                ),
                // Streaming Badge
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.85),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.secondary.withOpacity(0.5)),
                    ),
                    child: Text(
                      streamProvider.name,
                      style: const TextStyle(color: AppColors.secondary, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                // Rating
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.8),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '★ ${item.averageRating}',
                      style: const TextStyle(color: Colors.amber, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              item.title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              '${dominant.label} ($pct%)',
              style: TextStyle(color: dominant.color, fontSize: 11, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
