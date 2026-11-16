import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../constants/app_colors.dart';
import '../models/media_item.dart';
import '../models/user_profile.dart';
import '../models/vibe_type.dart';
import '../state/watchvibe_state.dart';
import '../screens/media_details_sheet.dart';
import 'vibe_badge.dart';

/// The 4 swipe actions for rapid taste calibration:
/// - Swipe RIGHT: Must Watch (Emerald Green)
/// - Swipe LEFT: Skip It (Crimson Red)
/// - Swipe UP: Mind Blown (Vivid Purple)
/// - Swipe DOWN: Want to Watch (Cyan Blue)
enum SwipeVibeAction {
  mustWatch,
  skipIt,
  mindBlown,
  wantToWatch,
}

extension SwipeVibeActionExtension on SwipeVibeAction {
  String get label {
    switch (this) {
      case SwipeVibeAction.mustWatch:
        return 'Must Watch';
      case SwipeVibeAction.skipIt:
        return 'Skip It';
      case SwipeVibeAction.mindBlown:
        return 'Mind Blown';
      case SwipeVibeAction.wantToWatch:
        return 'Want to Watch';
    }
  }

  String get stampText {
    switch (this) {
      case SwipeVibeAction.mustWatch:
        return 'MUST WATCH';
      case SwipeVibeAction.skipIt:
        return 'SKIP IT';
      case SwipeVibeAction.mindBlown:
        return 'MIND BLOWN';
      case SwipeVibeAction.wantToWatch:
        return 'WANT TO WATCH';
    }
  }

  String get gestureHint {
    switch (this) {
      case SwipeVibeAction.mustWatch:
        return 'Swipe Right 👉';
      case SwipeVibeAction.skipIt:
        return '👈 Swipe Left';
      case SwipeVibeAction.mindBlown:
        return 'Swipe Up 👆';
      case SwipeVibeAction.wantToWatch:
        return 'Swipe Down 👇';
    }
  }

  Color get color {
    switch (this) {
      case SwipeVibeAction.mustWatch:
        return AppColors.mustWatch; // 0xFF22C55E
      case SwipeVibeAction.skipIt:
        return AppColors.skipIt; // 0xFFEF4444
      case SwipeVibeAction.mindBlown:
        return AppColors.mindBlown; // 0xFFA855F7
      case SwipeVibeAction.wantToWatch:
        return AppColors.funTime; // 0xFF06B6D4
    }
  }

  IconData get icon {
    switch (this) {
      case SwipeVibeAction.mustWatch:
        return Icons.verified_rounded;
      case SwipeVibeAction.skipIt:
        return Icons.block_rounded;
      case SwipeVibeAction.mindBlown:
        return Icons.auto_awesome;
      case SwipeVibeAction.wantToWatch:
        return Icons.bookmark_add_rounded;
    }
  }

  VibeType? get correspondingVibe {
    switch (this) {
      case SwipeVibeAction.mustWatch:
        return VibeType.mustWatch;
      case SwipeVibeAction.skipIt:
        return VibeType.skipIt;
      case SwipeVibeAction.mindBlown:
        return VibeType.mindBlown;
      case SwipeVibeAction.wantToWatch:
        return null;
    }
  }
}

/// Record of a completed card swipe calibration
class SwipedCardRecord {
  final MediaItem item;
  final SwipeVibeAction action;
  final DateTime timestamp;

  const SwipedCardRecord({
    required this.item,
    required this.action,
    required this.timestamp,
  });
}

/// Interactive 'Swipe to Vibe' Rapid Taste Calibration Card Deck
class SwipeDeck extends StatefulWidget {
  final List<MediaItem>? items;
  final void Function(MediaItem item, SwipeVibeAction action)? onSwipe;
  final void Function(MediaItem item)? onCardTap;
  final void Function(List<SwipedCardRecord> results)? onFinished;
  final VoidCallback? onReset;
  final VoidCallback? onClose;
  final bool autoSyncWithState;
  final bool showHeader;
  final bool showBottomControls;
  final bool showGestureLegend;
  final String title;

  const SwipeDeck({
    Key? key,
    this.items,
    this.onSwipe,
    this.onCardTap,
    this.onFinished,
    this.onReset,
    this.onClose,
    this.autoSyncWithState = true,
    this.showHeader = true,
    this.showBottomControls = true,
    this.showGestureLegend = true,
    this.title = 'Swipe to Vibe',
  }) : super(key: key);

  /// Shows the Swipe Deck in a beautiful modal dialog / bottom sheet
  static Future<void> showModal(
    BuildContext context, {
    List<MediaItem>? items,
    void Function(MediaItem item, SwipeVibeAction action)? onSwipe,
    VoidCallback? onFinished,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FractionallySizedBox(
        heightFactor: 0.94,
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: SwipeDeck(
            items: items,
            onSwipe: onSwipe,
            onClose: () => Navigator.of(ctx).pop(),
            onFinished: (_) => onFinished?.call(),
          ),
        ),
      ),
    );
  }

  @override
  State<SwipeDeck> createState() => _SwipeDeckState();
}

class _SwipeDeckState extends State<SwipeDeck> with SingleTickerProviderStateMixin {
  late List<MediaItem> _deckItems;
  int _currentIndex = 0;
  final List<SwipedCardRecord> _history = [];

  // Drag tracking
  Offset _dragOffset = Offset.zero;
  SwipeVibeAction? _candidateAction;
  double _dragProgress = 0.0;

  // Animation controller for snap-back and fly-out
  late AnimationController _animController;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _rotationAnimation;
  bool _isAnimating = false;

  // Legend visibility
  bool _showLegendDetails = false;

  @override
  void initState() {
    super.initState();
    _deckItems = widget.items != null ? List.from(widget.items!) : [];

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );

    _slideAnimation = Tween<Offset>(
      begin: Offset.zero,
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    ));

    _rotationAnimation = Tween<double>(
      begin: 0.0,
      end: 0.0,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    ));

    _animController.addListener(() {
      setState(() {});
    });

    _animController.addStatusListener((status) {
      if (status == AnimationStatus.completed && _isAnimating) {
        _finalizeSwipeAction();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_deckItems.isEmpty) {
      final state = Provider.of<WatchVibeState>(context, listen: false);
      _deckItems = List.from(state.allMedia);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  // Determine candidate action based on pan coordinates
  void _calculateCandidateAction(Offset offset, Size cardSize) {
    final double dx = offset.dx;
    final double dy = offset.dy;
    final double threshold = 35.0;

    if (dx.abs() > dy.abs()) {
      // Horizontal dominant
      if (dx > threshold) {
        _candidateAction = SwipeVibeAction.mustWatch;
        _dragProgress = (dx.abs() / 120.0).clamp(0.0, 1.0);
      } else if (dx < -threshold) {
        _candidateAction = SwipeVibeAction.skipIt;
        _dragProgress = (dx.abs() / 120.0).clamp(0.0, 1.0);
      } else {
        _candidateAction = null;
        _dragProgress = 0.0;
      }
    } else {
      // Vertical dominant
      if (dy < -threshold) {
        _candidateAction = SwipeVibeAction.mindBlown;
        _dragProgress = (dy.abs() / 100.0).clamp(0.0, 1.0);
      } else if (dy > threshold) {
        _candidateAction = SwipeVibeAction.wantToWatch;
        _dragProgress = (dy.abs() / 100.0).clamp(0.0, 1.0);
      } else {
        _candidateAction = null;
        _dragProgress = 0.0;
      }
    }
  }

  void _onPanStart(DragStartDetails details) {
    if (_isAnimating || _currentIndex >= _deckItems.length) return;
    _animController.stop();
  }

  void _onPanUpdate(DragUpdateDetails details, Size cardSize) {
    if (_isAnimating || _currentIndex >= _deckItems.length) return;
    setState(() {
      _dragOffset += details.delta;
      _calculateCandidateAction(_dragOffset, cardSize);
    });
  }

  void _onPanEnd(DragEndDetails details, Size cardSize) {
    if (_isAnimating || _currentIndex >= _deckItems.length) return;

    final double velocityX = details.velocity.pixelsPerSecond.dx;
    final double velocityY = details.velocity.pixelsPerSecond.dy;
    final double velocityTotal = details.velocity.pixelsPerSecond.distance;

    final double horizThreshold = cardSize.width * 0.28;
    final double vertThreshold = cardSize.height * 0.18;

    SwipeVibeAction? targetAction = _candidateAction;

    // Check if swipe distance or velocity exceeded threshold
    bool shouldSwipe = false;
    if (_dragOffset.dx.abs() > horizThreshold || (velocityX.abs() > 700 && _dragOffset.dx.abs() > 25)) {
      shouldSwipe = true;
      targetAction = _dragOffset.dx > 0 ? SwipeVibeAction.mustWatch : SwipeVibeAction.skipIt;
    } else if (_dragOffset.dy.abs() > vertThreshold || (velocityY.abs() > 700 && _dragOffset.dy.abs() > 25)) {
      shouldSwipe = true;
      targetAction = _dragOffset.dy < 0 ? SwipeVibeAction.mindBlown : SwipeVibeAction.wantToWatch;
    }

    if (shouldSwipe && targetAction != null) {
      _animateCardExit(targetAction, cardSize, details.velocity.pixelsPerSecond);
    } else {
      _animateCardReset();
    }
  }

  void _animateCardExit(SwipeVibeAction action, Size cardSize, [Offset? initialVelocity]) {
    _isAnimating = true;
    _candidateAction = action;

    Offset targetOffset;
    double targetRotation = 0.0;
    final double screenW = MediaQuery.of(context).size.width;
    final double screenH = MediaQuery.of(context).size.height;

    switch (action) {
      case SwipeVibeAction.mustWatch:
        targetOffset = Offset(screenW + 250, _dragOffset.dy);
        targetRotation = 0.35;
        break;
      case SwipeVibeAction.skipIt:
        targetOffset = Offset(-screenW - 250, _dragOffset.dy);
        targetRotation = -0.35;
        break;
      case SwipeVibeAction.mindBlown:
        targetOffset = Offset(_dragOffset.dx * 0.5, -screenH - 250);
        targetRotation = 0.05;
        break;
      case SwipeVibeAction.wantToWatch:
        targetOffset = Offset(_dragOffset.dx * 0.5, screenH + 250);
        targetRotation = -0.05;
        break;
    }

    final double startRotation = (_dragOffset.dx / (cardSize.width * 1.5)) * 0.35;

    _slideAnimation = Tween<Offset>(
      begin: _dragOffset,
      end: targetOffset,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    ));

    _rotationAnimation = Tween<double>(
      begin: startRotation,
      end: targetRotation,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    ));

    HapticFeedback.lightImpact();
    _animController.forward(from: 0.0);
  }

  void _animateCardReset() {
    final double startRotation = (_dragOffset.dx / 300.0) * 0.35;

    _slideAnimation = Tween<Offset>(
      begin: _dragOffset,
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutBack,
    ));

    _rotationAnimation = Tween<double>(
      begin: startRotation,
      end: 0.0,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutBack,
    ));

    _candidateAction = null;
    _dragProgress = 0.0;

    _animController.forward(from: 0.0).then((_) {
      setState(() {
        _dragOffset = Offset.zero;
      });
    });
  }

  void _finalizeSwipeAction() {
    if (_currentIndex >= _deckItems.length || _candidateAction == null) {
      _isAnimating = false;
      return;
    }

    final item = _deckItems[_currentIndex];
    final action = _candidateAction!;

    final record = SwipedCardRecord(
      item: item,
      action: action,
      timestamp: DateTime.now(),
    );
    _history.add(record);

    // Auto-sync with WatchVibe state
    if (widget.autoSyncWithState) {
      final state = Provider.of<WatchVibeState>(context, listen: false);
      switch (action) {
        case SwipeVibeAction.mustWatch:
          state.submitRatingAndVibes(
            mediaId: item.id,
            score: 9.5,
            vibes: [VibeType.mustWatch],
          );
          break;
        case SwipeVibeAction.skipIt:
          state.submitRatingAndVibes(
            mediaId: item.id,
            score: 3.0,
            vibes: [VibeType.skipIt],
          );
          break;
        case SwipeVibeAction.mindBlown:
          state.submitRatingAndVibes(
            mediaId: item.id,
            score: 9.8,
            vibes: [VibeType.mindBlown],
          );
          break;
        case SwipeVibeAction.wantToWatch:
          state.toggleWatchlist(item.id, WatchlistStatus.wantToWatch);
          break;
      }
    }

    widget.onSwipe?.call(item, action);

    setState(() {
      _currentIndex++;
      _dragOffset = Offset.zero;
      _candidateAction = null;
      _dragProgress = 0.0;
      _isAnimating = false;
      _animController.reset();
    });

    if (_currentIndex >= _deckItems.length) {
      widget.onFinished?.call(_history);
    }
  }

  /// Programmatic trigger via buttons
  void _triggerSwipeAction(SwipeVibeAction action) {
    if (_isAnimating || _currentIndex >= _deckItems.length) return;
    _animateCardExit(action, const Size(360, 520));
  }

  /// Undo the last swipe action
  void _undoLastAction() {
    if (_history.isEmpty || _currentIndex <= 0 || _isAnimating) return;

    HapticFeedback.selectionClick();
    final lastRecord = _history.removeLast();

    // Revert state if needed
    if (widget.autoSyncWithState && lastRecord.action == SwipeVibeAction.wantToWatch) {
      final state = Provider.of<WatchVibeState>(context, listen: false);
      state.toggleWatchlist(lastRecord.item.id, WatchlistStatus.wantToWatch);
    }

    setState(() {
      _currentIndex--;
      _dragOffset = Offset.zero;
      _candidateAction = null;
      _dragProgress = 0.0;
      _animController.reset();
    });
  }

  void _resetDeck() {
    setState(() {
      _currentIndex = 0;
      _history.clear();
      _dragOffset = Offset.zero;
      _candidateAction = null;
      _dragProgress = 0.0;
      _isAnimating = false;
      _animController.reset();
    });
    widget.onReset?.call();
  }

  void _openDetails(MediaItem item) {
    if (widget.onCardTap != null) {
      widget.onCardTap!(item);
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => MediaDetailsSheet(media: item),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isCompleted = _currentIndex >= _deckItems.length;

    return Column(
      children: [
        if (widget.showHeader) _buildHeader(context, isCompleted),
        if (widget.showGestureLegend && !isCompleted) _buildGestureLegend(context),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              if (isCompleted) {
                return _buildCompletedView(context);
              }
              return _buildCardDeck(context, constraints);
            },
          ),
        ),
        if (widget.showBottomControls && !isCompleted) _buildBottomControls(context),
      ],
    );
  }

  Widget _buildHeader(BuildContext context, bool isCompleted) {
    final int total = _deckItems.length;
    final int current = math.min(_currentIndex + 1, total);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: AppColors.border, width: 0.8),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primaryGradientStart, AppColors.primaryGradientEnd],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.style_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.title,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  isCompleted
                      ? 'Calibration finished'
                      : 'Card $current of $total • Rapid Taste Calibration',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          if (!isCompleted)
            IconButton(
              tooltip: 'Gesture Guide',
              icon: Icon(
                _showLegendDetails ? Icons.info : Icons.info_outline,
                color: _showLegendDetails ? AppColors.primary : AppColors.textMuted,
                size: 22,
              ),
              onPressed: () {
                setState(() {
                  _showLegendDetails = !_showLegendDetails;
                });
              },
            ),
          if (widget.onClose != null)
            IconButton(
              tooltip: 'Close',
              icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
              onPressed: widget.onClose,
            ),
        ],
      ),
    );
  }

  Widget _buildGestureLegend(BuildContext context) {
    if (_showLegendDetails) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Row(
              children: [
                const Icon(Icons.touch_app_rounded, color: AppColors.primary, size: 16),
                const SizedBox(width: 6),
                const Text(
                  'How to Swipe to Vibe',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => setState(() => _showLegendDetails = false),
                  child: const Icon(Icons.close, color: AppColors.textMuted, size: 16),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _buildLegendItem(SwipeVibeAction.mustWatch),
                _buildLegendItem(SwipeVibeAction.skipIt),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildLegendItem(SwipeVibeAction.mindBlown),
                _buildLegendItem(SwipeVibeAction.wantToWatch),
              ],
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildMiniHintChip('👉 Right', 'Must Watch', AppColors.mustWatch),
            const SizedBox(width: 8),
            _buildMiniHintChip('👈 Left', 'Skip It', AppColors.skipIt),
            const SizedBox(width: 8),
            _buildMiniHintChip('👆 Up', 'Mind Blown', AppColors.mindBlown),
            const SizedBox(width: 8),
            _buildMiniHintChip('👇 Down', 'Want to Watch', AppColors.funTime),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniHintChip(String gesture, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.35), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            gesture,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 11,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(SwipeVibeAction action) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: action.color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: action.color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Icon(action.icon, color: action.color, size: 16),
            const SizedBox(width: 6),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    action.label,
                    style: TextStyle(
                      color: action.color,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                  Text(
                    action.gestureHint,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
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

  Widget _buildCardDeck(BuildContext context, BoxConstraints constraints) {
    final double cardWidth = math.min(constraints.maxWidth - 32, 420.0);
    final double cardHeight = constraints.maxHeight - 20;

    return Center(
      child: SizedBox(
        width: cardWidth,
        height: cardHeight,
        child: Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            // Depth Layer 3 (Bottom)
            if (_currentIndex + 2 < _deckItems.length)
              _buildBackgroundCard(
                item: _deckItems[_currentIndex + 2],
                width: cardWidth,
                height: cardHeight,
                depth: 2,
              ),

            // Depth Layer 2 (Middle)
            if (_currentIndex + 1 < _deckItems.length)
              _buildBackgroundCard(
                item: _deckItems[_currentIndex + 1],
                width: cardWidth,
                height: cardHeight,
                depth: 1,
              ),

            // Top Interactive Card (Layer 1)
            if (_currentIndex < _deckItems.length)
              _buildInteractiveTopCard(
                item: _deckItems[_currentIndex],
                width: cardWidth,
                height: cardHeight,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBackgroundCard({
    required MediaItem item,
    required double width,
    required double height,
    required int depth,
  }) {
    // Interpolate scales based on drag progress of the active card
    final double progress = _dragProgress.clamp(0.0, 1.0);

    final double baseScale = depth == 1 ? 0.94 : 0.88;
    final double targetScale = depth == 1 ? 1.0 : 0.94;
    final double currentScale = baseScale + (targetScale - baseScale) * progress;

    final double baseOffsetY = depth == 1 ? 14.0 : 26.0;
    final double targetOffsetY = depth == 1 ? 0.0 : 14.0;
    final double currentOffsetY = baseOffsetY - (baseOffsetY - targetOffsetY) * progress;

    return Transform.translate(
      offset: Offset(0, currentOffsetY),
      child: Transform.scale(
        scale: currentScale,
        child: Opacity(
          opacity: depth == 1 ? 0.92 : 0.75,
          child: _buildCardContent(item, isInteractive: false),
        ),
      ),
    );
  }

  Widget _buildInteractiveTopCard({
    required MediaItem item,
    required double width,
    required double height,
  }) {
    final cardSize = Size(width, height);

    Offset translation = _dragOffset;
    double rotation = (_dragOffset.dx / (width * 1.5)) * 0.35;

    if (_isAnimating) {
      translation = _slideAnimation.value;
      rotation = _rotationAnimation.value;
    }

    return GestureDetector(
      onPanStart: _onPanStart,
      onPanUpdate: (details) => _onPanUpdate(details, cardSize),
      onPanEnd: (details) => _onPanEnd(details, cardSize),
      onTap: () => _openDetails(item),
      child: Transform.translate(
        offset: translation,
        child: Transform.rotate(
          angle: rotation,
          child: Stack(
            children: [
              _buildCardContent(
                item,
                isInteractive: true,
                candidateAction: _candidateAction,
                progress: _dragProgress,
              ),

              // Visual feedback stamp overlay
              if (_candidateAction != null && _dragProgress > 0.05)
                Positioned.fill(
                  child: _buildActionStampOverlay(_candidateAction!, _dragProgress),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCardContent(
    MediaItem item, {
    required bool isInteractive,
    SwipeVibeAction? candidateAction,
    double progress = 0.0,
  }) {
    final borderColor = candidateAction != null
        ? candidateAction.color.withOpacity((0.4 + progress * 0.6).clamp(0.0, 1.0))
        : AppColors.border;

    final glowShadow = candidateAction != null && progress > 0.1
        ? [
            BoxShadow(
              color: candidateAction.color.withOpacity((progress * 0.45).clamp(0.0, 0.45)),
              blurRadius: 24,
              spreadRadius: 2,
            )
          ]
        : [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 18,
              offset: const Offset(0, 8),
            )
          ];

    final topVibes = item.vibePercentages.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final displayVibes = topVibes.take(3).toList();

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderColor, width: candidateAction != null ? 2.0 : 1.2),
        boxShadow: glowShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Visual Poster / Backdrop Section (Expanded)
          Expanded(
            flex: 5,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Backdrop / Poster Image
                Image.network(
                  item.backdropUrl.isNotEmpty ? item.backdropUrl : item.posterUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (ctx, err, stack) => Container(
                    color: AppColors.surface,
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            item.type == MediaType.movie ? Icons.movie_outlined : Icons.tv_rounded,
                            size: 48,
                            color: AppColors.textMuted,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            item.title,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // Cinematic Dark Vignette & Bottom Gradient
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withOpacity(0.55),
                          Colors.transparent,
                          AppColors.card.withOpacity(0.7),
                          AppColors.card,
                        ],
                        stops: const [0.0, 0.35, 0.8, 1.0],
                      ),
                    ),
                  ),
                ),

                // Top Floating Badge Bar
                Positioned(
                  top: 14,
                  left: 14,
                  right: 14,
                  child: Row(
                    children: [
                      // Media Type Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.65),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.primary.withOpacity(0.6), width: 1),
                        ),
                        child: Text(
                          item.type == MediaType.movie ? 'MOVIE' : 'SERIES',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Release Year Pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.55),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${item.releaseYear}',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Spacer(),
                      // Rating Score Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B).withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.6)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                            const SizedBox(width: 4),
                            Text(
                              item.averageRating.toStringAsFixed(1),
                              style: const TextStyle(
                                color: Color(0xFFF59E0B),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
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

          // Information Details Section (Bottom)
          Expanded(
            flex: 4,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title & Director
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Directed by ${item.directorOrCreator} • ${item.duration}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Genres Chips
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: item.genres.take(3).map((genre) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.cardElevated,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppColors.border, width: 0.8),
                            ),
                            child: Text(
                              genre,
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),

                      // Synopsis Hook
                      Text(
                        item.synopsis,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),

                  // Community Vibe Breakdown Badges
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (displayVibes.isNotEmpty) ...[
                        const Text(
                          'COMMUNITY VIBE DNA',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: displayVibes.map((entry) {
                            return Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: VibeBadge(
                                vibe: entry.key,
                                percentage: entry.value,
                                compact: true,
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                      const SizedBox(height: 6),
                      // Tap hint
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: const [
                          Text(
                            'Tap card for details',
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(
                            Icons.arrow_forward_ios_rounded,
                            size: 10,
                            color: AppColors.textMuted,
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// High-contrast dynamic stamp overlays displayed during dragging
  Widget _buildActionStampOverlay(SwipeVibeAction action, double progress) {
    final double opacity = (progress * 1.2).clamp(0.0, 0.95);
    final color = action.color;

    switch (action) {
      case SwipeVibeAction.mustWatch:
        return Align(
          alignment: Alignment.topRight,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Transform.rotate(
              angle: 0.22,
              child: Opacity(
                opacity: opacity,
                child: _buildStampBadge(
                  label: action.stampText,
                  icon: action.icon,
                  color: color,
                ),
              ),
            ),
          ),
        );

      case SwipeVibeAction.skipIt:
        return Align(
          alignment: Alignment.topLeft,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Transform.rotate(
              angle: -0.22,
              child: Opacity(
                opacity: opacity,
                child: _buildStampBadge(
                  label: action.stampText,
                  icon: action.icon,
                  color: color,
                ),
              ),
            ),
          ),
        );

      case SwipeVibeAction.mindBlown:
        return Align(
          alignment: Alignment.topCenter,
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Opacity(
              opacity: opacity,
              child: _buildStampBadge(
                label: action.stampText,
                icon: action.icon,
                color: color,
              ),
            ),
          ),
        );

      case SwipeVibeAction.wantToWatch:
        return Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.all(36),
            child: Opacity(
              opacity: opacity,
              child: _buildStampBadge(
                label: action.stampText,
                icon: action.icon,
                color: color,
              ),
            ),
          ),
        );
    }
  }

  Widget _buildStampBadge({
    required String label,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.85),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.55),
            blurRadius: 16,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  /// Bottom quick-action buttons for tapping rather than swiping
  Widget _buildBottomControls(BuildContext context) {
    final bool canUndo = _history.isNotEmpty && !_isAnimating;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: AppColors.border, width: 0.8),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          // Undo Button
          _buildActionButton(
            tooltip: 'Undo (Rewind)',
            icon: Icons.undo_rounded,
            color: canUndo ? Colors.amber : AppColors.textMuted,
            size: 42,
            iconSize: 20,
            onPressed: canUndo ? _undoLastAction : null,
          ),

          // Skip It (Left)
          _buildActionButton(
            tooltip: 'Skip It (Swipe Left)',
            icon: Icons.close_rounded,
            color: AppColors.skipIt,
            size: 52,
            iconSize: 26,
            onPressed: () => _triggerSwipeAction(SwipeVibeAction.skipIt),
          ),

          // Want to Watch (Down)
          _buildActionButton(
            tooltip: 'Want to Watch (Swipe Down)',
            icon: Icons.bookmark_add_rounded,
            color: AppColors.funTime,
            size: 46,
            iconSize: 22,
            onPressed: () => _triggerSwipeAction(SwipeVibeAction.wantToWatch),
          ),

          // Mind Blown (Up)
          _buildActionButton(
            tooltip: 'Mind Blown (Swipe Up)',
            icon: Icons.auto_awesome,
            color: AppColors.mindBlown,
            size: 48,
            iconSize: 23,
            onPressed: () => _triggerSwipeAction(SwipeVibeAction.mindBlown),
          ),

          // Must Watch (Right)
          _buildActionButton(
            tooltip: 'Must Watch (Swipe Right)',
            icon: Icons.verified_rounded,
            color: AppColors.mustWatch,
            size: 54,
            iconSize: 28,
            onPressed: () => _triggerSwipeAction(SwipeVibeAction.mustWatch),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required String tooltip,
    required IconData icon,
    required Color color,
    required double size,
    required double iconSize,
    required VoidCallback? onPressed,
  }) {
    final bool isEnabled = onPressed != null;

    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(size / 2),
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isEnabled ? color.withOpacity(0.15) : AppColors.cardElevated.withOpacity(0.5),
              border: Border.all(
                color: isEnabled ? color.withOpacity(0.5) : AppColors.border,
                width: 1.5,
              ),
              boxShadow: isEnabled
                  ? [
                      BoxShadow(
                        color: color.withOpacity(0.25),
                        blurRadius: 10,
                        spreadRadius: 1,
                      )
                    ]
                  : null,
            ),
            child: Icon(
              icon,
              color: isEnabled ? color : AppColors.textMuted.withOpacity(0.4),
              size: iconSize,
            ),
          ),
        ),
      ),
    );
  }

  /// Completion summary view shown when the deck runs out of cards
  Widget _buildCompletedView(BuildContext context) {
    final mustWatchCount = _history.where((r) => r.action == SwipeVibeAction.mustWatch).length;
    final mindBlownCount = _history.where((r) => r.action == SwipeVibeAction.mindBlown).length;
    final wantToWatchCount = _history.where((r) => r.action == SwipeVibeAction.wantToWatch).length;
    final skipCount = _history.where((r) => r.action == SwipeVibeAction.skipIt).length;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Celebration Icon
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [AppColors.primaryGradientStart, AppColors.primaryGradientEnd],
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.4),
                    blurRadius: 24,
                    spreadRadius: 4,
                  ),
                ],
              ),
              child: const Icon(Icons.celebration_rounded, color: Colors.white, size: 48),
            ),
            const SizedBox(height: 20),

            const Text(
              'Taste Calibration Complete!',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            const Text(
              'Your WatchVibe entertainment DNA has been calibrated.',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),

            // Metrics Breakdown Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  const Text(
                    'CALIBRATION BREAKDOWN',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _buildMetricTile('Must Watch', '$mustWatchCount', AppColors.mustWatch, Icons.verified_rounded),
                      _buildMetricTile('Mind Blown', '$mindBlownCount', AppColors.mindBlown, Icons.auto_awesome),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _buildMetricTile('Want to Watch', '$wantToWatchCount', AppColors.funTime, Icons.bookmark_add_rounded),
                      _buildMetricTile('Skipped', '$skipCount', AppColors.skipIt, Icons.block_rounded),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Calibrate Again'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _resetDeck,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Done'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: widget.onClose ?? () => Navigator.of(context).maybePop(),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, Color color, IconData icon) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    color: color,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

