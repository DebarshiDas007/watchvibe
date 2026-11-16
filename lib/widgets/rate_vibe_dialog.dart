import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/media_item.dart';
import '../models/vibe_type.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import 'vibe_badge.dart';

class RateVibeDialog extends StatefulWidget {
  final MediaItem media;

  const RateVibeDialog({Key? key, required this.media}) : super(key: key);

  static Future<void> show(BuildContext context, MediaItem media) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => RateVibeDialog(media: media),
    );
  }

  @override
  State<RateVibeDialog> createState() => _RateVibeDialogState();
}

class _RateVibeDialogState extends State<RateVibeDialog> {
  double _score = 9.0;
  final Set<VibeType> _selectedVibes = {};
  final TextEditingController _reviewController = TextEditingController();
  bool _isSpoiler = false;

  @override
  void initState() {
    super.initState();
    final state = Provider.of<WatchVibeState>(context, listen: false);
    final existingRating = state.currentUser.userGivenRatings[widget.media.id];
    if (existingRating != null) {
      _score = existingRating;
    }
    final existingVibes = state.currentUser.userGivenVibes[widget.media.id];
    if (existingVibes != null) {
      _selectedVibes.addAll(existingVibes);
    } else {
      _selectedVibes.add(widget.media.dominantVibe);
    }
  }

  @override
  void dispose() {
    _reviewController.dispose();
    super.dispose();
  }

  void _toggleVibe(VibeType vibe) {
    setState(() {
      if (_selectedVibes.contains(vibe)) {
        _selectedVibes.remove(vibe);
      } else {
        _selectedVibes.add(vibe);
      }
    });
  }

  void _submit() {
    if (_selectedVibes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one vibe category!'),
          backgroundColor: AppColors.primary,
        ),
      );
      return;
    }

    final state = Provider.of<WatchVibeState>(context, listen: false);
    state.submitRatingAndVibes(
      mediaId: widget.media.id,
      score: _score,
      vibes: _selectedVibes.toList(),
      reviewText: _reviewController.text.trim(),
      isSpoiler: _isSpoiler,
    );

    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Vibe logged for "${widget.media.title}"! Community vibes updated.'),
        backgroundColor: AppColors.mustWatch,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
      ),
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: AppColors.border, width: 1.5),
        ),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Header
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    widget.media.posterUrl,
                    width: 48,
                    height: 64,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Rate the Vibe',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.1,
                        ),
                      ),
                      Text(
                        widget.media.title,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '${widget.media.releaseYear} • ${widget.media.type == MediaType.movie ? 'Movie' : 'Series'}',
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
            const SizedBox(height: 20),

            // Score Section (1-10)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Numerical Score',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary),
                  ),
                  child: Text(
                    '★ ${_score.toStringAsFixed(1)} / 10',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
            Slider(
              value: _score,
              min: 1.0,
              max: 10.0,
              divisions: 90,
              activeColor: AppColors.primary,
              inactiveColor: AppColors.border,
              onChanged: (val) {
                setState(() => _score = double.parse(val.toStringAsFixed(1)));
              },
            ),

            const SizedBox(height: 12),

            // Vibe selection title
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Select Watch Vibes (Pick 1 or more)',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${_selectedVibes.length} selected',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Vibe Chips
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: VibeType.values.map((vibe) {
                final isSelected = _selectedVibes.contains(vibe);
                return VibeBadge(
                  vibe: vibe,
                  isSelected: isSelected,
                  onTap: () => _toggleVibe(vibe),
                );
              }).toList(),
            ),

            const SizedBox(height: 16),

            // Review Comment
            const Text(
              'Your Review (Optional)',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _reviewController,
              maxLines: 3,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'What kind of experience should others expect from watching this?',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
              ),
            ),

            const SizedBox(height: 10),

            // Spoiler Toggle
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(Icons.visibility_off, size: 16, color: AppColors.textSecondary),
                    SizedBox(width: 8),
                    Text(
                      'Contains spoilers',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
                Switch(
                  value: _isSpoiler,
                  activeColor: AppColors.primary,
                  onChanged: (val) => setState(() => _isSpoiler = val),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Post My Vibe & Rating',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
