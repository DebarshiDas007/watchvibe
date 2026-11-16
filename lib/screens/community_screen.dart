import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import '../widgets/taste_match_card.dart';
import '../widgets/watch_battle_card.dart';
import '../widgets/vibe_badge.dart';

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({Key? key}) : super(key: key);

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  final Set<String> _revealedSpoilers = {};

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context);
    final friends = state.friends;
    final battles = state.battles;

    // Collect all reviews from all media sorted by date
    final allReviews = state.allMedia
        .expand((m) => m.communityReviews)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'Community Vibes',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined, color: AppColors.textSecondary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Friend Discovery & QR sync coming soon!')),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        children: [
          // TASTE MATCH HIGHLIGHT
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.favorite_rounded, color: AppColors.tasteMatch, size: 18),
                  SizedBox(width: 6),
                  Text(
                    'Taste Match Twins',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const Text(
                'Based on ratings',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 8),

          ...friends.map((f) => TasteMatchCard(friend: f)).toList(),

          const SizedBox(height: 20),

          // WATCH BATTLE INTERACTIVE CARD
          if (battles.isNotEmpty) ...[
            WatchBattleCard(battle: battles.first),
            const SizedBox(height: 20),
          ],

          // SOCIAL FEED: What friends are watching & reviewing
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text(
                'Friends Feed & Reviews',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                'Live vibes',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),

          ...allReviews.map((rev) {
            final isRevealed = _revealedSpoilers.contains(rev.id);
            return Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // User info + Media title
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
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
                              'vibe logged on ${rev.mediaTitle}',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '★ ${rev.rating}',
                          style: const TextStyle(
                            color: Colors.amber,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  // Vibes assigned
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: rev.vibes
                        .map((v) => VibeBadge(vibe: v, compact: true))
                        .toList(),
                  ),

                  const SizedBox(height: 10),

                  // Review body (spoiler protected)
                  if (rev.isSpoiler && !isRevealed)
                    InkWell(
                      onTap: () => setState(() => _revealedSpoilers.add(rev.id)),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.visibility_off, size: 14, color: Colors.redAccent),
                            SizedBox(width: 6),
                            Text(
                              'Contains spoilers. Tap to read review.',
                              style: TextStyle(color: Colors.redAccent, fontSize: 12),
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
                        height: 1.45,
                      ),
                    ),

                  const SizedBox(height: 12),

                  // Footer actions (Like, Comment, Share)
                  Row(
                    children: [
                      InkWell(
                        onTap: () => state.toggleLikeReview(rev),
                        child: Row(
                          children: [
                            Icon(
                              rev.isLiked ? Icons.favorite : Icons.favorite_border,
                              size: 16,
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
                      const SizedBox(width: 20),
                      Row(
                        children: const [
                          Icon(Icons.chat_bubble_outline, size: 14, color: AppColors.textMuted),
                          SizedBox(width: 4),
                          Text(
                            'Reply',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                      const Spacer(),
                      const Text(
                        '4h ago',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }).toList(),

          const SizedBox(height: 30),
        ],
      ),
    );
  }
}
