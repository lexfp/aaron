import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/dog_clicker_bloc.dart';
import '../bloc/dog_clicker_event.dart';
import '../bloc/dog_clicker_state.dart';
import '../widgets/custom_button.dart';

class PuppyProShopPage extends StatelessWidget {
  const PuppyProShopPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.background,
      appBar: AppBar(
        title: const Text('Puppy Pro Shop', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: BlocBuilder<DogClickerBloc, DogClickerState>(
        builder: (context, state) {
          if (state is DogClickerLoaded) {
            return Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Theme.of(context).colorScheme.secondary),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.pets, color: Colors.amber),
                      const SizedBox(width: 8),
                      Text(
                        '${state.dogState.score} Bones',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: state.shopItems.length,
                    itemBuilder: (context, index) {
                      final item = state.shopItems[index];
                      final canAfford = state.dogState.score >= item.cost;
                      
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        color: Theme.of(context).colorScheme.surface,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Row(
                            children: [
                              Container(
                                width: 50,
                                height: 50,
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  item.clickPowerIncrease > 0 ? Icons.touch_app : Icons.timer,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.clickPowerIncrease > 0 
                                        ? '+${item.clickPowerIncrease} per click' 
                                        : '+${item.autoClickPowerIncrease} per sec',
                                      style: TextStyle(color: Colors.white70),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                children: [
                                  Text('${item.cost} Bones', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.amber)),
                                  const SizedBox(height: 8),
                                  CustomButton(
                                    text: 'Buy',
                                    isPrimary: canAfford,
                                    isDisabled: !canAfford,
                                    onPressed: () {
                                      context.read<DogClickerBloc>().add(ShopItemBought(item));
                                    },
                                  ),
                                ],
                              ),
                            ],
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
