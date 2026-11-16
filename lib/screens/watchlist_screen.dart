import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_profile.dart';
import '../models/media_item.dart';
import '../models/vibe_type.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import 'media_details_sheet.dart';

class WatchlistScreen extends StatefulWidget {
  const WatchlistScreen({Key? key}) : super(key: key);

  @override
  State<WatchlistScreen> createState() => _WatchlistScreenState();
}

class _WatchlistScreenState extends State<WatchlistScreen> {
  WatchlistStatus _selectedStatus = WatchlistStatus.currentlyWatching;

  void _openDetails(BuildContext context, MediaItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MediaDetailsSheet(media: item),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context);
    final items = state.getWatchlistItems(_selectedStatus);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'My Watchlist',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
      ),
      body: Column(
        children: [
          // Segmented Tabs
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemCount: WatchlistStatus.values.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final status = WatchlistStatus.values[i];
                final isSelected = _selectedStatus == status;
                final count = state.getWatchlistItems(status).length;

                return ChoiceChip(
                  label: Text('${status.label} ($count)'),
                  selected: isSelected,
                  onSelected: (val) {
                    if (val) setState(() => _selectedStatus = status);
                  },
                  backgroundColor: AppColors.card,
                  selectedColor: AppColors.primary,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : AppColors.textSecondary,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    fontSize: 12,
                  ),
                  side: BorderSide(
                    color: isSelected ? AppColors.primary : AppColors.border,
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 12),

          // Items List
          Expanded(
            child: items.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.bookmark_border_rounded, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        Text(
                          'No titles in "${_selectedStatus.label}"',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 15),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Explore titles and tap the bookmark to add',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final item = items[i];
                      final dominant = item.dominantVibe;
                      final userGivenRating = state.currentUser.userGivenRatings[item.id];

                      return InkWell(
                        onTap: () => _openDetails(context, item),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.card,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: Image.network(
                                  item.posterUrl,
                                  width: 60,
                                  height: 85,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.title,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${item.releaseYear} • ${item.duration} • ${item.genres.first}',
                                      style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: dominant.color.withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: dominant.color.withOpacity(0.4)),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(dominant.icon, size: 11, color: dominant.color),
                                              const SizedBox(width: 4),
                                              Text(
                                                dominant.label,
                                                style: TextStyle(
                                                  color: dominant.color,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if (userGivenRating != null) ...[
                                          const SizedBox(width: 8),
                                          Text(
                                            '★ $userGivenRating',
                                            style: const TextStyle(
                                              color: Colors.amber,
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.more_vert, color: AppColors.textMuted),
                                onPressed: () {
                                  // Quick status switcher
                                  showModalBottomSheet(
                                    context: context,
                                    backgroundColor: AppColors.card,
                                    shape: const RoundedRectangleBorder(
                                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                                    ),
                                    builder: (ctx) => Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 20),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: WatchlistStatus.values.map((s) {
                                          return ListTile(
                                            title: Text(s.label, style: const TextStyle(color: Colors.white)),
                                            trailing: s == _selectedStatus
                                                ? const Icon(Icons.check, color: AppColors.primary)
                                                : null,
                                            onTap: () {
                                              state.toggleWatchlist(item.id, s);
                                              Navigator.pop(ctx);
                                            },
                                          );
                                        }).toList(),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
