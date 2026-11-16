import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/vibe_type.dart';
import '../models/media_item.dart';
import '../models/actor_profile.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import '../widgets/vibe_badge.dart';
import 'media_details_sheet.dart';
import 'actor_profile_sheet.dart';

class ExploreScreen extends StatelessWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  void _openDetails(BuildContext context, MediaItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MediaDetailsSheet(media: item),
      ),
    );
  }

  void _openActorProfile(BuildContext context, ActorProfile actor) {
    ActorProfileSheet.show(context, actor);
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context);
    final results = state.filteredExploreMedia;
    final matchedActors = state.filteredActors;

    final List<String> genres = [
      'Sci-Fi',
      'Drama',
      'Mystery',
      'Comedy',
      'Romance',
      'Animation',
      'Psychological Thriller',
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'Universal Search & Explore',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
      ),
      body: Column(
        children: [
          // Universal Search Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            child: TextField(
              onChanged: state.setSearchQuery,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search actors (e.g. Johnny Depp), titles, vibes...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary, size: 20),
                suffixIcon: state.searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 18, color: AppColors.textMuted),
                        onPressed: () => state.setSearchQuery(''),
                      )
                    : null,
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

          // HYPED ACTORS STRIP WHEN SEARCH IS EMPTY
          if (state.searchQuery.isEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Row(
                children: const [
                  Icon(Icons.trending_up, size: 16, color: AppColors.primary),
                  SizedBox(width: 6),
                  Text(
                    'Trending & Hyped Actors',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 48,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: state.hypedActors.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final actor = state.hypedActors[i];
                  return InkWell(
                    onTap: () => _openActorProfile(context, actor),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 14,
                            backgroundImage: NetworkImage(actor.profileUrl),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            actor.name,
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '#${actor.weeklyTrendRank ?? (i + 1)}',
                              style: const TextStyle(color: AppColors.primary, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 6),
          ],

          // MATCHED ACTORS CAROUSEL (IF ANY MATCH SEARCH OR BROWSING)
          if (matchedActors.isNotEmpty && state.searchQuery.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Row(
                children: const [
                  Icon(Icons.person_search, size: 16, color: AppColors.primary),
                  SizedBox(width: 6),
                  Text(
                    'Actors & Creators Found',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 70,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: matchedActors.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, i) {
                  final actor = matchedActors[i];
                  return InkWell(
                    onTap: () => _openActorProfile(context, actor),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundImage: NetworkImage(actor.profileUrl),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                actor.name,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              Text(
                                '${actor.filmography.length} titles • ${actor.totalBoxOfficeFormatted}',
                                style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
                              ),
                            ],
                          ),
                          const SizedBox(width: 6),
                          const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.primary),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 6),
          ],

          // Media Type Segmented Pills
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Row(
              children: [
                _buildTypePill(
                  label: 'All Titles',
                  isSelected: state.selectedExploreType == null,
                  onTap: () => state.setExploreType(null),
                ),
                const SizedBox(width: 8),
                _buildTypePill(
                  label: 'Movies',
                  isSelected: state.selectedExploreType == MediaType.movie,
                  onTap: () => state.setExploreType(MediaType.movie),
                ),
                const SizedBox(width: 8),
                _buildTypePill(
                  label: 'TV Series',
                  isSelected: state.selectedExploreType == MediaType.series,
                  onTap: () => state.setExploreType(MediaType.series),
                ),
              ],
            ),
          ),

          // Vibe Filter Chips
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: const Text('All Vibes', style: TextStyle(fontSize: 12)),
                    selected: state.selectedExploreVibe == null,
                    onSelected: (_) => state.setExploreVibe(null),
                    backgroundColor: AppColors.card,
                    selectedColor: AppColors.primary.withOpacity(0.3),
                    labelStyle: TextStyle(
                      color: state.selectedExploreVibe == null ? Colors.white : AppColors.textSecondary,
                    ),
                    side: BorderSide(
                      color: state.selectedExploreVibe == null ? AppColors.primary : AppColors.border,
                    ),
                  ),
                ),
                ...VibeType.values.map((v) {
                  final isSelected = state.selectedExploreVibe == v;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: VibeBadge(
                      vibe: v,
                      isSelected: isSelected,
                      onTap: () => state.setExploreVibe(isSelected ? null : v),
                    ),
                  );
                }).toList(),
              ],
            ),
          ),

          const SizedBox(height: 6),

          // Results Counter
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${results.length} titles match',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                ),
                if (state.selectedExploreVibe != null ||
                    state.selectedExploreGenre != null ||
                    state.selectedExploreType != null ||
                    state.searchQuery.isNotEmpty)
                  InkWell(
                    onTap: () {
                      state.setSearchQuery('');
                      state.setExploreVibe(null);
                      state.setExploreGenre(null);
                      state.setExploreType(null);
                    },
                    child: const Text(
                      'Reset Filters',
                      style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 6),

          // Results Grid
          Expanded(
            child: results.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.movie_filter_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text(
                          'No titles match the search query',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 15),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Try searching an actor name (e.g. Johnny Depp) or clearing filters',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  )
                : GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.62,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                    ),
                    itemCount: results.length,
                    itemBuilder: (context, i) {
                      final item = results[i];
                      return _buildGridCard(context, item);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypePill({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.card,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.textSecondary,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGridCard(BuildContext context, MediaItem item) {
    final dominant = item.dominantVibe;
    final pct = item.vibePercentages[dominant] ?? 0;

    return InkWell(
      onTap: () => _openDetails(context, item),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                    child: Image.network(
                      item.posterUrl,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.75),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        item.type == MediaType.movie ? 'Movie' : 'Series',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.75),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.star, color: Colors.amber, size: 10),
                          const SizedBox(width: 3),
                          Text(
                            '${item.averageRating}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${item.releaseYear} • ${item.genres.first}',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: dominant.color.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: dominant.color.withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(dominant.icon, size: 10, color: dominant.color),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            '${dominant.label} ($pct%)',
                            style: TextStyle(
                              color: dominant.color,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
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
    );
  }
}
