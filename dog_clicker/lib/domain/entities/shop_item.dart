import 'package:equatable/equatable.dart';

class ShopItem extends Equatable {
  final String id;
  final String name;
  final int cost;
  final int clickPowerIncrease;
  final int autoClickPowerIncrease;

  const ShopItem({
    required this.id,
    required this.name,
    required this.cost,
    this.clickPowerIncrease = 0,
    this.autoClickPowerIncrease = 0,
  });

  @override
  List<Object?> get props => [id, name, cost, clickPowerIncrease, autoClickPowerIncrease];
}
