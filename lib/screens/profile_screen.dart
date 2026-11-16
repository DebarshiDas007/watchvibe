import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/vibe_type.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import '../widgets/vibe_badge.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context);
    final user = state.currentUser;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'Profile & Vibe Taste',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: AppColors.textSecondary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Settings & Account Sync')),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User Header
            Row(
              children: [
                Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundImage: NetworkImage(user.avatarUrl),
                    ),
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.star, size: 12, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        user.username,
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            '${user.followersCount}',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          const Text(
                            ' followers • ',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                          ),
                          Text(
                            '${user.followingCount}',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          const Text(
                            ' following',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Bio
            Text(
              user.bio,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),

            const SizedBox(height: 18),

            // STATS TILES (Streak, Movies, Series)
            Row(
              children: [
                _buildStatCard(
                  icon: Icons.local_fire_department,
                  iconColor: Colors.amber,
                  value: '${user.watchStreakWeeks} Wks',
                  label: 'Watch Streak',
                ),
                const SizedBox(width: 10),
                _buildStatCard(
                  icon: Icons.movie_outlined,
                  iconColor: AppColors.secondary,
                  value: '${user.moviesWatched}',
                  label: 'Movies',
                ),
                const SizedBox(width: 10),
                _buildStatCard(
                  icon: Icons.tv_rounded,
                  iconColor: AppColors.primary,
                  value: '${user.seriesWatched}',
                  label: 'Series',
                ),
              ],
            ),

            const SizedBox(height: 24),

            // SIGNATURE FEATURE: Personal Vibe Distribution
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
                    children: const [
                      Text(
                        'Your Signature Vibe Taste',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        'Most used categories',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Horizontal distribution bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: SizedBox(
                      height: 14,
                      child: Row(
                        children: user.personalVibeUsage.entries.map((entry) {
                          final total = user.personalVibeUsage.values.fold<int>(0, (a, b) => a + b);
                          final flex = total == 0 ? 1 : entry.value;
                          return Flexible(
                            flex: flex,
                            child: Container(
                              color: entry.key.color,
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Grid of individual counts
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: user.personalVibeUsage.entries.map((e) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: e.key.color.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(e.key.icon, size: 12, color: e.key.color),
                            const SizedBox(width: 6),
                            Text(
                              e.key.label,
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${e.value}',
                              style: TextStyle(
                                color: e.key.color,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Favorite Genres
            const Text(
              'Favorite Genres',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: user.favoriteGenres.map((g) {
                return Chip(
                  label: Text(g),
                  backgroundColor: AppColors.card,
                  labelStyle: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                  side: const BorderSide(color: AppColors.border),
                );
              }).toList(),
            ),

            const SizedBox(height: 24),

            // My Rated Titles Summary
            const Text(
              'Your Recent Vibe Ratings',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 10),

            ...user.userGivenRatings.entries.map((entry) {
              final media = state.allMedia.firstWhere(
                (m) => m.id == entry.key,
                orElse: () => state.allMedia.first,
              );
              final vibes = user.userGivenVibes[entry.key] ?? [];

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        media.posterUrl,
                        width: 44,
                        height: 60,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            media.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 4,
                            children: vibes
                                .map((v) => VibeBadge(vibe: v, compact: true))
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '★ ${entry.value}',
                      style: const TextStyle(
                        color: Colors.amber,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required Color iconColor,
    required String value,
    required String label,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Icon(icon, color: iconColor, size: 20),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
