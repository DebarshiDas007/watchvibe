import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/watchvibe_state.dart';
import '../constants/app_colors.dart';
import 'home_screen.dart';
import 'explore_screen.dart';
import 'community_screen.dart';
import 'watchlist_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatelessWidget {
  const MainShell({Key? key}) : super(key: key);

  static final List<Widget> _screens = [
    const HomeScreen(),
    const ExploreScreen(),
    const CommunityScreen(),
    const WatchlistScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<WatchVibeState>(context);
    final isDesktop = MediaQuery.of(context).size.width >= 800;

    if (isDesktop) {
      // Desktop / macOS / Windows Adaptive Shell with Sidebar
      return Scaffold(
        backgroundColor: AppColors.background,
        body: Row(
          children: [
            // Left Desktop Sidebar
            Container(
              width: 240,
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(
                  right: BorderSide(color: AppColors.border, width: 1),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // App Branding
                  Padding(
                    padding: const EdgeInsets.only(top: 28, left: 24, right: 24, bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ShaderMask(
                          shaderCallback: (bounds) => const LinearGradient(
                            colors: [Color(0xFFC084FC), Color(0xFF60A5FA)],
                          ).createShader(bounds),
                          child: const Text(
                            'WATCHVIBE',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2.0,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          "Don't just rate it. Tell us the vibe.",
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.textMuted,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Divider(color: AppColors.border, height: 1),
                  const SizedBox(height: 12),

                  // Navigation Items
                  _buildSidebarItem(
                    index: 0,
                    currentIndex: state.selectedNavIndex,
                    icon: Icons.movie_outlined,
                    activeIcon: Icons.movie,
                    label: 'Discover',
                    onTap: () => state.setNavIndex(0),
                  ),
                  _buildSidebarItem(
                    index: 1,
                    currentIndex: state.selectedNavIndex,
                    icon: Icons.search,
                    activeIcon: Icons.search,
                    label: 'Explore Vibes',
                    onTap: () => state.setNavIndex(1),
                  ),
                  _buildSidebarItem(
                    index: 2,
                    currentIndex: state.selectedNavIndex,
                    icon: Icons.people_outline,
                    activeIcon: Icons.people,
                    label: 'Community',
                    badge: 'Match',
                    onTap: () => state.setNavIndex(2),
                  ),
                  _buildSidebarItem(
                    index: 3,
                    currentIndex: state.selectedNavIndex,
                    icon: Icons.bookmark_outline,
                    activeIcon: Icons.bookmark,
                    label: 'My Watchlist',
                    onTap: () => state.setNavIndex(3),
                  ),
                  _buildSidebarItem(
                    index: 4,
                    currentIndex: state.selectedNavIndex,
                    icon: Icons.person_outline,
                    activeIcon: Icons.person,
                    label: 'Profile & Taste',
                    onTap: () => state.setNavIndex(4),
                  ),

                  const Spacer(),

                  // Bottom mini profile on desktop
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundImage: NetworkImage(state.currentUser.avatarUrl),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                state.currentUser.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                              Text(
                                '${state.currentUser.watchStreakWeeks}w streak 🔥',
                                style: const TextStyle(
                                  color: Colors.amber,
                                  fontSize: 10,
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

            // Main Content Area
            Expanded(
              child: _screens[state.selectedNavIndex],
            ),
          ],
        ),
      );
    }

    // Mobile / Tablet Shell (Android & iOS)
    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(
        index: state.selectedNavIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(
            top: BorderSide(color: AppColors.border, width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: state.selectedNavIndex,
          onTap: state.setNavIndex,
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.transparent,
          elevation: 0,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textMuted,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.explore_outlined),
              activeIcon: Icon(Icons.explore),
              label: 'Discover',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.search),
              activeIcon: Icon(Icons.saved_search),
              label: 'Explore',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people_outline),
              activeIcon: Icon(Icons.people),
              label: 'Community',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.bookmark_outline),
              activeIcon: Icon(Icons.bookmark),
              label: 'Watchlist',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSidebarItem({
    required int index,
    required int currentIndex,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    String? badge,
    required VoidCallback onTap,
  }) {
    final isSelected = index == currentIndex;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary.withOpacity(0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: isSelected ? Border.all(color: AppColors.primary.withOpacity(0.4)) : null,
          ),
          child: Row(
            children: [
              Icon(
                isSelected ? activeIcon : icon,
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppColors.textSecondary,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    fontSize: 13,
                  ),
                ),
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.tasteMatch.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    badge,
                    style: const TextStyle(
                      color: AppColors.tasteMatch,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
