import 'vibe_type.dart';

class Review {
  final String id;
  final String userId;
  final String userName;
  final String userAvatar;
  final String mediaId;
  final String mediaTitle;
  final double rating; // 1.0 to 10.0
  final List<VibeType> vibes;
  final String comment;
  final bool isSpoiler;
  final DateTime createdAt;
  int likes;
  bool isLiked;

  Review({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userAvatar,
    required this.mediaId,
    required this.mediaTitle,
    required this.rating,
    required this.vibes,
    required this.comment,
    this.isSpoiler = false,
    required this.createdAt,
    this.likes = 0,
    this.isLiked = false,
  });
}
