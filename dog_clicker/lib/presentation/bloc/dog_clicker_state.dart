import 'package:equatable/equatable.dart';
import '../../domain/entities/dog_state.dart';
import '../../domain/entities/shop_item.dart';
import '../../domain/entities/milestone.dart';

abstract class DogClickerState extends Equatable {
  const DogClickerState();
  
  @override
  List<Object?> get props => [];
}

class DogClickerInitial extends DogClickerState {}

class DogClickerLoading extends DogClickerState {}

class DogClickerLoaded extends DogClickerState {
  final DogState dogState;
  final List<ShopItem> shopItems;
  final List<Milestone> milestones;
  final Milestone? newMilestoneReached;

  const DogClickerLoaded({
    required this.dogState,
    required this.shopItems,
    required this.milestones,
    this.newMilestoneReached,
  });

  DogClickerLoaded copyWith({
    DogState? dogState,
    List<ShopItem>? shopItems,
    List<Milestone>? milestones,
    Milestone? newMilestoneReached,
    bool clearNewMilestone = false,
  }) {
    return DogClickerLoaded(
      dogState: dogState ?? this.dogState,
      shopItems: shopItems ?? this.shopItems,
      milestones: milestones ?? this.milestones,
      newMilestoneReached: clearNewMilestone ? null : (newMilestoneReached ?? this.newMilestoneReached),
    );
  }

  @override
  List<Object?> get props => [dogState, shopItems, milestones, newMilestoneReached];
}

class DogClickerError extends DogClickerState {
  final String message;

  const DogClickerError(this.message);

  @override
  List<Object?> get props => [message];
}
