import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/dog_clicker_bloc.dart';
import '../bloc/dog_clicker_state.dart';

class TopDogMilestonePage extends StatelessWidget {
  const TopDogMilestonePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: const Text('Top Dog Milestones',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: BlocBuilder<DogClickerBloc, DogClickerState>(
        builder: (context, state) {
          if (state is DogClickerLoaded) {
            final reachedCount =
                state.milestones.where((m) => m.isReached).length;
            final totalCount = state.milestones.length;

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      const Icon(Icons.military_tech,
                          size: 80, color: Colors.amber),
                      const SizedBox(height: 16),
                      Text(
                        'Milestones: $reachedCount / $totalCount',
                        style: const TextStyle(
                            fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(
                        value: reachedCount / totalCount,
                        backgroundColor: Theme.of(context).colorScheme.surface,
                        color: Colors.amber,
                        minHeight: 12,
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: state.milestones.length,
                    itemBuilder: (context, index) {
                      final milestone = state.milestones[index];
                      return Container(
                        margin: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: milestone.isReached
                                ? Colors.amber
                                : Colors.transparent,
                            width: 2,
                          ),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(16),
                          leading: CircleAvatar(
                            backgroundColor: milestone.isReached
                                ? Colors.amber.withOpacity(0.2)
                                : Colors.white10,
                            child: Icon(
                              milestone.isReached ? Icons.check : Icons.lock,
                              color: milestone.isReached
                                  ? Colors.amber
                                  : Colors.white54,
                            ),
                          ),
                          title: Text(
                            milestone.title,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              color: milestone.isReached
                                  ? Colors.white
                                  : Colors.white54,
                            ),
                          ),
                          subtitle: Text(
                            'Reach ${milestone.requiredScore} Bones',
                            style: TextStyle(
                              color: milestone.isReached
                                  ? Colors.white70
                                  : Colors.white38,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            );
          }
          return const Center(child: CircularProgressIndicator());
        },
      ),
    );
  }
}
