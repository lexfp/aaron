import 'package:equatable/equatable.dart';
import '../../domain/entities/dog_state.dart';
import '../../domain/entities/shop_item.dart';
import '../../domain/entities/milestone.dart';

abstract class DogClickerEvent extends Equatable {
  const DogClickerEvent();

  @override
  List<Object> get props => [];
}

class LoadGame extends DogClickerEvent {}

class DogClicked extends DogClickerEvent {}

class ShopItemBought extends DogClickerEvent {
  final ShopItem item;

  const ShopItemBought(this.item);

  @override
  List<Object> get props => [item];
}

class AutoClickTick extends DogClickerEvent {}

class MilestonesChecked extends DogClickerEvent {}
