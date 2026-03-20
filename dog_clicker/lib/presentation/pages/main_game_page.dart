import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/dog_clicker_bloc.dart';
import '../bloc/dog_clicker_event.dart';
import '../bloc/dog_clicker_state.dart';
import 'puppy_pro_shop_page.dart';
import 'doggy_settings_page.dart';
import 'top_dog_milestone_page.dart';
import '../widgets/custom_button.dart';

class MainGamePage extends StatefulWidget {
  const MainGamePage({super.key});

  @override
  State<MainGamePage> createState() => _MainGamePageState();
}

class _MainGamePageState extends State<MainGamePage>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.9).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _handleTap(BuildContext context) {
    _animationController.forward().then((_) => _animationController.reverse());
    context.read<DogClickerBloc>().add(DogClicked());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: BlocConsumer<DogClickerBloc, DogClickerState>(
        listener: (context, state) {
          if (state is DogClickerLoaded && state.newMilestoneReached != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                    'Milestone Reached: ${state.newMilestoneReached!.title}!'),
                backgroundColor: Theme.of(context).colorScheme.secondary,
                duration: const Duration(seconds: 3),
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is DogClickerLoading || state is DogClickerInitial) {
            return const Center(child: CircularProgressIndicator());
          } else if (state is DogClickerLoaded) {
            return SafeArea(
              child: Column(
                children: [
                  _buildHeader(context, state),
                  Expanded(
                    child: Center(
                      child: GestureDetector(
                        onTap: () => _handleTap(context),
                        child: ScaleTransition(
                          scale: _scaleAnimation,
                          child: Container(
                            width: 250,
                            height: 250,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  Theme.of(context)
                                      .colorScheme
                                      .primary
                                      .withOpacity(0.5),
                                  Colors.transparent,
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .primary
                                      .withOpacity(0.3),
                                  blurRadius: 40,
                                  spreadRadius: 10,
                                ),
                              ],
                            ),
                            child: const Center(
                              child: Text(
                                '🐶',
                                style: TextStyle(fontSize: 120),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  _buildFooter(context),
                ],
              ),
            );
          } else if (state is DogClickerError) {
            return Center(child: Text('Error: ${state.message}'));
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildHeader(BuildContext context, DogClickerLoaded state) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          Text(
            '${state.dogState.score}',
            style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  fontSize: 64,
                  color: Theme.of(context).colorScheme.secondary,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Bones',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontSize: 24,
                  letterSpacing: 2,
                ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildStatBadge(context, Icons.touch_app,
                  '${state.dogState.clickPower}/click'),
              const SizedBox(width: 16),
              _buildStatBadge(
                  context, Icons.timer, '${state.dogState.autoClickers}/sec'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatBadge(BuildContext context, IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: Theme.of(context).colorScheme.primary.withOpacity(0.5)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 6),
          Text(text, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          IconButton(
            icon: const Icon(Icons.settings, size: 32),
            color: Colors.white54,
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const DoggySettingsPage())),
          ),
          CustomButton(
            text: 'SHOP',
            icon: Icons.store,
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const PuppyProShopPage())),
          ),
          IconButton(
            icon: const Icon(Icons.military_tech, size: 32),
            color: Colors.white54,
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const TopDogMilestonePage())),
          ),
        ],
      ),
    );
  }
}
