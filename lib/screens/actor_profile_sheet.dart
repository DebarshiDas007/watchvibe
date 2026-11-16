import 'package:flutter/material.dart';
import '../models/actor_profile.dart';
import '../models/vibe_type.dart';
import '../constants/app_colors.dart';
import '../widgets/vibe_badge.dart';
import 'media_details_sheet.dart';
import '../data/mock_data.dart';

class ActorProfileSheet extends StatefulWidget {
  final ActorProfile actor;

  const ActorProfileSheet({Key? key, required this.actor}) : super(key: key);

  static void show(BuildContext context, ActorProfile actor) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ActorProfileSheet(actor: actor),
      ),
    );
  }

  @override
  State<ActorProfileSheet> createState() => _ActorProfileSheetState();
}

class _ActorProfileSheetState extends State<ActorProfileSheet> {
  FilmographySortBy _selectedSort = FilmographySortBy.boxOffice;
  VibeType? _selectedVibeFilter;

  @override
  Widget build(BuildContext context) {
    final actor = widget.actor;
    final sortedMovies = actor.getSortedFilmography(
      sortBy: _selectedSort,
      vibeFilter: _selectedVibeFilter,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          actor.name,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Actor Header Card
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    actor.profileUrl,
                    width: 90,
                    height: 125,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        actor.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        actor.knownForRole,
                        style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Born: ${actor.birthDate} • ${actor.birthplace}',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                      const SizedBox(height: 8),
                      // Box office total badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.amber.withOpacity(0.4)),
                        ),
                        child: Text(
                          'Box Office: ${actor.totalBoxOfficeFormatted}',
                          style: const TextStyle(
                            color: Colors.amber,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Bio
            Text(
              actor.biography,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                height: 1.45,
              ),
            ),

            const SizedBox(height: 20),

            // ACTOR VIBE DNA BREAKDOWN
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
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
                          Icon(Icons.auto_awesome, color: AppColors.primary, size: 16),
                          SizedBox(width: 6),
                          Text(
                            'Actor Vibe DNA',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                      const Text(
                        'Audience perception',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: SizedBox(
                      height: 10,
                      child: Row(
                        children: actor.vibeBreakdownPercentages.entries.map((e) {
                          return Flexible(
                            flex: e.value,
                            child: Container(color: e.key.color),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: actor.vibeBreakdownPercentages.entries.map((e) {
                      return Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 8, height: 8, decoration: BoxDecoration(color: e.key.color, shape: BoxShape.circle)),
                          const SizedBox(width: 4),
                          Text(
                            '${e.key.label} (${e.value}%)',
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 22),

            // FILMOGRAPHY HEADER & SEQUENCE SORT CONTROLLER
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Filmography (${sortedMovies.length})',
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                // Sort Dropdown
                DropdownButton<FilmographySortBy>(
                  value: _selectedSort,
                  dropdownColor: AppColors.card,
                  underline: const SizedBox.shrink(),
                  icon: const Icon(Icons.sort, color: AppColors.primary, size: 18),
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedSort = val);
                  },
                  items: FilmographySortBy.values.map((s) {
                    return DropdownMenuItem(
                      value: s,
                      child: Text(s.label),
                    );
                  }).toList(),
                ),
              ],
            ),

            const SizedBox(height: 8),

            // Vibe Filter Chips
            SizedBox(
              height: 34,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  ChoiceChip(
                    label: const Text('All Vibes', style: TextStyle(fontSize: 11)),
                    selected: _selectedVibeFilter == null,
                    onSelected: (val) => setState(() => _selectedVibeFilter = null),
                    backgroundColor: AppColors.card,
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(color: _selectedVibeFilter == null ? Colors.white : AppColors.textSecondary),
                    side: BorderSide(color: _selectedVibeFilter == null ? AppColors.primary : AppColors.border),
                  ),
                  const SizedBox(width: 6),
                  ...VibeType.values.map((v) {
                    final isSel = _selectedVibeFilter == v;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(v.label, style: const TextStyle(fontSize: 11)),
                        selected: isSel,
                        onSelected: (val) => setState(() => _selectedVibeFilter = val ? v : null),
                        backgroundColor: AppColors.card,
                        selectedColor: v.color.withOpacity(0.3),
                        labelStyle: TextStyle(color: isSel ? Colors.white : AppColors.textSecondary),
                        side: BorderSide(color: isSel ? v.color : AppColors.border),
                      ),
                    );
                  }).toList(),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // ALIGNED SEQUENCE LIST OF MOVIES
            ...sortedMovies.map((credit) {
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
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
                        credit.posterUrl,
                        width: 55,
                        height: 75,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            credit.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'as ${credit.character} • ${credit.releaseYear}',
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: credit.dominantVibe.color.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: credit.dominantVibe.color.withOpacity(0.4)),
                                ),
                                child: Text(
                                  credit.dominantVibe.label,
                                  style: TextStyle(
                                    color: credit.dominantVibe.color,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '💰 ${credit.boxOfficeFormatted}',
                                style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '★ ${credit.rating}',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ],
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
}
