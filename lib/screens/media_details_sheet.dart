import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/media_item.dart';
import '../models/vibe_type.dart';
import '../models/user_profile.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import '../widgets/vibe_badge.dart';
import '../widgets/vibe_progress_bar.dart';
import '../widgets/rate_vibe_dialog.dart';
import '../widgets/share_card_dialog.dart';

class MediaDetailsSheet extends StatefulWidget {
  final MediaItem media;

  const MediaDetailsSheet({Key? key, required this.media}) : super(key: key);

  @override
  State<MediaDetailsSheet> createState() => _MediaDetailsSheetState();
}

class _MediaDetailsSheetState extends State<MediaDetailsSheet> {
  final Set<String> _revealedSpoilers = {};

  final Map<String, String> countryNames = {
    'US': '🇺🇸 United States',
    'IN': '🇮🇳 India',
    'GB': '🇬🇧 United Kingdom',
    'CA': '🇨🇦 Canada',
  };

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context);
    final media = widget.media;
    final currentStatus = state.currentUser.watchlist[media.id];
    final userRating = state.currentUser.userGivenRatings[media.id];
    final userVibes = state.currentUser.userGivenVibes[media.id];

    final currentCountry = state.selectedCountry;
    final providers = media.streamingByCountry[currentCountry] ?? 
                      media.streamingByCountry['US'] ?? [];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // Collapsible Backdrop App Bar
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: AppColors.surface,
            leading: IconButton(
              icon: const CircleAvatar(
                backgroundColor: Colors.black54,
                child: Icon(Icons.arrow_back, color: Colors.white, size: 20),
              ),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            actions: [
              IconButton(
                icon: const CircleAvatar(
                  backgroundColor: Colors.black54,
                  child: Icon(Icons.share_outlined, color: Colors.white, size: 20),
                ),
                onPressed: () => ShareCardDialog.show(context, media),
              ),
              const SizedBox(width: 8),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    media.backdropUrl,
                    fit: BoxFit.cover,
                  ),
                  Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          Color(0x99101014),
                          AppColors.background,
                        ],
                        stops: [0.3, 0.7, 1.0],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 16,
                    left: 20,
                    right: 20,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(
                            media.posterUrl,
                            width: 85,
                            height: 120,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              VibeBadge(
                                vibe: media.dominantVibe,
                                compact: true,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                media.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${media.releaseYear} • ${media.duration} • ${media.genres.take(2).join(", ")}',
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Body Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Dual Rating Summary Bar
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        Column(
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.star_rounded, color: Colors.amber, size: 24),
                                const SizedBox(width: 4),
                                Text(
                                  '${media.averageRating}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const Text(
                                  '/10',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${media.totalRatingsCount} ratings',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        Container(width: 1, height: 40, color: AppColors.border),
                        Column(
                          children: [
                            Row(
                              children: [
                                Icon(media.dominantVibe.icon, color: media.dominantVibe.color, size: 20),
                                const SizedBox(width: 6),
                                Text(
                                  media.dominantVibe.label,
                                  style: TextStyle(
                                    color: media.dominantVibe.color,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${media.vibePercentages[media.dominantVibe] ?? 0}% agreed',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        Container(width: 1, height: 40, color: AppColors.border),
                        Column(
                          children: const [
                            Text(
                              '89%',
                              style: TextStyle(
                                color: AppColors.tasteMatch,
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Taste Match',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Action Buttons (Rate Vibe, Watchlist)
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          onPressed: () => RateVibeDialog.show(context, media),
                          icon: const Icon(Icons.bolt_rounded, size: 18),
                          label: Text(userRating != null ? 'Edit My Vibe' : 'Rate the Vibe'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      PopupMenuButton<WatchlistStatus>(
                        onSelected: (status) => state.toggleWatchlist(media.id, status),
                        color: AppColors.card,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        itemBuilder: (ctx) => WatchlistStatus.values.map((status) {
                          final isCurrent = currentStatus == status;
                          return PopupMenuItem(
                            value: status,
                            child: Row(
                              children: [
                                Icon(
                                  isCurrent ? Icons.check_circle : Icons.circle_outlined,
                                  size: 16,
                                  color: isCurrent ? AppColors.primary : AppColors.textMuted,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  status.label,
                                  style: TextStyle(
                                    color: isCurrent ? AppColors.primary : AppColors.textPrimary,
                                    fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.card,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: currentStatus != null ? AppColors.primary : AppColors.border,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                currentStatus != null ? Icons.bookmark : Icons.bookmark_add_outlined,
                                size: 18,
                                color: currentStatus != null ? AppColors.primary : AppColors.textPrimary,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                currentStatus?.label ?? 'Watchlist',
                                style: TextStyle(
                                  color: currentStatus != null ? AppColors.primary : AppColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  // If user has already rated
                  if (userRating != null && userVibes != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle, color: AppColors.mustWatch, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'You rated: ★ $userRating • ${userVibes.map((v) => v.label).join(", ")}',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // FEATURE 1: "WHERE TO WATCH" (STREAMING AVAILABILITY PER COUNTRY)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: const [
                                Icon(Icons.tv_rounded, color: AppColors.secondary, size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'Where to Watch',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            // Country Selector dropdown
                            DropdownButton<String>(
                              value: currentCountry,
                              dropdownColor: AppColors.card,
                              underline: const SizedBox.shrink(),
                              icon: const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary, size: 18),
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                              onChanged: (val) {
                                if (val != null) state.setSelectedCountry(val);
                              },
                              items: countryNames.entries.map((e) {
                                return DropdownMenuItem(
                                  value: e.key,
                                  child: Text(e.value),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        if (providers.isEmpty)
                          const Text(
                            'No streaming data available for this country yet.',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                          )
                        else
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: providers.map((prov) {
                              final isSubscription = prov.type == 'stream';
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSubscription ? AppColors.secondary.withOpacity(0.5) : AppColors.border,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      isSubscription ? Icons.play_circle_fill : Icons.shopping_bag_outlined,
                                      color: isSubscription ? AppColors.secondary : AppColors.textSecondary,
                                      size: 14,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      prov.name,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                    if (prov.price != null) ...[
                                      const SizedBox(width: 6),
                                      Text(
                                        '(${prov.price})',
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                    if (isSubscription) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: AppColors.secondary.withOpacity(0.2),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Text(
                                          'STREAM',
                                          style: TextStyle(
                                            color: AppColors.secondary,
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              );
                            }).toList(),
                          ),

                        const SizedBox(height: 8),
                        const Text(
                          'Powered by free TMDB & JustWatch data',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 10),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // FEATURE 2: SOUNDTRACK & THEME INTEGRATION
                  if (media.soundtrack != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF201633), AppColors.card],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () => state.toggleSoundtrackPreview(media.id),
                            borderRadius: BorderRadius.circular(24),
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                (state.currentlyPlayingMediaId == media.id && state.isSoundtrackPlaying)
                                    ? Icons.pause
                                    : Icons.play_arrow,
                                color: Colors.white,
                                size: 24,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: const [
                                    Icon(Icons.music_note, color: AppColors.primary, size: 14),
                                    SizedBox(width: 4),
                                    Text(
                                      'ORIGINAL SOUNDTRACK THEME',
                                      style: TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1.1,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  media.soundtrack!.themeTitle,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  'Composer: ${media.soundtrack!.composer}',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1DB954).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFF1DB954).withOpacity(0.4)),
                            ),
                            child: const Text(
                              'Spotify',
                              style: TextStyle(
                                color: Color(0xFF1DB954),
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // SIGNATURE FEATURE: Community Vibes Breakdown
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: const [
                                Icon(Icons.auto_awesome, color: AppColors.primary, size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'Community Vibes',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${media.totalVoters} voters',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Percentage of audience that assigned each vibe category to this title:',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 14),

                        ...VibeType.values.map((vibe) {
                          final pct = media.vibePercentages[vibe] ?? 0;
                          final votes = media.vibeVotes[vibe] ?? 0;
                          if (pct == 0 && votes == 0) return const SizedBox.shrink();
                          return VibeProgressBar(
                            vibe: vibe,
                            percentage: pct,
                            voterCount: votes,
                          );
                        }).toList(),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // FEATURE 3: CAST & KEY CREW WITH VIBE DNA
                  if (media.cast.isNotEmpty) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text(
                          'Cast & Character Vibes',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Top cast',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 150,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: media.cast.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (context, i) {
                          final actor = media.cast[i];
                          return Container(
                            width: 105,
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.card,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                CircleAvatar(
                                  radius: 28,
                                  backgroundImage: NetworkImage(actor.profileUrl),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  actor.name,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                ),
                                Text(
                                  actor.character,
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 10,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: actor.signatureVibe.color.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    actor.signatureVibe.label,
                                    style: TextStyle(
                                      color: actor.signatureVibe.color,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // FEATURE 4: HOW TO WATCH (SENSORY & VIEWING GUIDE)
                  if (media.viewingGuide != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: const [
                              Icon(Icons.tune, color: AppColors.primary, size: 18),
                              SizedBox(width: 8),
                              Text(
                                'How to Watch (Sensory Guide)',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _buildGuideRow(
                            icon: Icons.nightlight_round,
                            title: 'Best Environment',
                            desc: media.viewingGuide!.idealEnvironment,
                          ),
                          const SizedBox(height: 8),
                          _buildGuideRow(
                            icon: Icons.speed,
                            title: 'Pacing Profile',
                            desc: media.viewingGuide!.pacing,
                          ),
                          const SizedBox(height: 8),
                          _buildGuideRow(
                            icon: Icons.favorite_border,
                            title: 'Cry Gauge (Emotional Impact)',
                            desc: '${media.viewingGuide!.cryGauge} / 10 • High Emotional Resonance',
                          ),
                          const SizedBox(height: 8),
                          _buildGuideRow(
                            icon: Icons.center_focus_strong,
                            title: 'Attention Required',
                            desc: media.viewingGuide!.attentionLevel,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // FEATURE 5: COMMUNITY DOUBLE FEATURE PAIRING
                  if (media.doubleFeature != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1B1B2A), AppColors.card],
                        ),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.secondary.withOpacity(0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: const [
                              Icon(Icons.layers_outlined, color: AppColors.secondary, size: 18),
                              SizedBox(width: 8),
                              Text(
                                'Vibe Double-Feature Pairing',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  media.doubleFeature!.pairedPosterUrl,
                                  width: 50,
                                  height: 70,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Pair with: ${media.doubleFeature!.pairedTitle}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      media.doubleFeature!.curationReason,
                                      style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 11,
                                        height: 1.35,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Synopsis & Info
                  const Text(
                    'Synopsis',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    media.synopsis,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Creator / Director: ${media.directorOrCreator} • Language: ${media.language}',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Community Reviews
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'What People Are Saying',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '${media.communityReviews.length} reviews',
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  if (media.communityReviews.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Center(
                        child: Text(
                          'Be the first to tell others the vibe for this title!',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                      ),
                    )
                  else
                    ...media.communityReviews.map((rev) {
                      final isRevealed = _revealedSpoilers.contains(rev.id);
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundImage: NetworkImage(rev.userAvatar),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        rev.userName,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      Text(
                                        '★ ${rev.rating} / 10',
                                        style: const TextStyle(
                                          color: Colors.amber,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (rev.isSpoiler)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.red.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text(
                                      'SPOILER',
                                      style: TextStyle(
                                        color: Colors.redAccent,
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 8),

                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: rev.vibes
                                  .map((v) => VibeBadge(vibe: v, compact: true))
                                  .toList(),
                            ),
                            const SizedBox(height: 10),

                            if (rev.isSpoiler && !isRevealed)
                              InkWell(
                                onTap: () => setState(() => _revealedSpoilers.add(rev.id)),
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(Icons.visibility, size: 14, color: AppColors.textSecondary),
                                      SizedBox(width: 6),
                                      Text(
                                        'Contains spoiler. Tap to reveal.',
                                        style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            else
                              Text(
                                rev.comment,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 13,
                                  height: 1.4,
                                ),
                              ),

                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                InkWell(
                                  onTap: () => state.toggleLikeReview(rev),
                                  child: Row(
                                    children: [
                                      Icon(
                                        rev.isLiked ? Icons.favorite : Icons.favorite_border,
                                        size: 14,
                                        color: rev.isLiked ? Colors.redAccent : AppColors.textMuted,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '${rev.likes}',
                                        style: TextStyle(
                                          color: rev.isLiked ? Colors.redAccent : AppColors.textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }).toList(),

                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGuideRow({
    required IconData icon,
    required String title,
    required String desc,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                desc,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
