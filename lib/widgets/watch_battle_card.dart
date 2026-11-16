import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';

class WatchBattleCard extends StatelessWidget {
  final WatchBattle battle;

  const WatchBattleCard({Key? key, required this.battle}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context, listen: false);

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF1F1A2F),
            AppColors.card,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.local_fire_department, color: Colors.amber, size: 18),
                  SizedBox(width: 6),
                  Text(
                    'WATCH BATTLE OF THE WEEK',
                    style: TextStyle(
                      color: Colors.amber,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.1,
                    ),
                  ),
                ],
              ),
              Text(
                '${battle.totalVotes} votes',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Two contenders
          Row(
            children: [
              // Contender A
              Expanded(
                child: InkWell(
                  onTap: () => state.voteBattle(battle.id, battle.itemA.id),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: battle.userVotedId == battle.itemA.id
                          ? AppColors.primary.withOpacity(0.2)
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: battle.userVotedId == battle.itemA.id
                            ? AppColors.primary
                            : AppColors.border,
                      ),
                    ),
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            battle.itemA.posterUrl,
                            height: 110,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          battle.itemA.title,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${battle.pctA}%',
                          style: TextStyle(
                            color: battle.userVotedId == battle.itemA.id
                                ? AppColors.primary
                                : AppColors.textSecondary,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // VS Badge
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFF262638),
                    shape: BoxShape.circle,
                  ),
                  child: const Text(
                    'VS',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),

              // Contender B
              Expanded(
                child: InkWell(
                  onTap: () => state.voteBattle(battle.id, battle.itemB.id),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: battle.userVotedId == battle.itemB.id
                          ? AppColors.secondary.withOpacity(0.2)
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: battle.userVotedId == battle.itemB.id
                            ? AppColors.secondary
                            : AppColors.border,
                      ),
                    ),
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            battle.itemB.posterUrl,
                            height: 110,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          battle.itemB.title,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${battle.pctB}%',
                          style: TextStyle(
                            color: battle.userVotedId == battle.itemB.id
                                ? AppColors.secondary
                                : AppColors.textSecondary,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),
          Center(
            child: Text(
              battle.userVotedId == null ? 'Tap poster to cast your vibe vote' : 'You voted! Tap opposite to switch',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}
