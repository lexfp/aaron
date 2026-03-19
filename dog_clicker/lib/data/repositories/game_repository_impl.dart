import 'package:dartz/dartz.dart';
import '../../core/failures.dart';
import '../../domain/entities/dog_state.dart';
import '../../domain/entities/shop_item.dart';
import '../../domain/entities/milestone.dart';
import '../../domain/repositories/game_repository.dart';
import '../models/dog_state_model.dart';
import 'dart:async';

class GameRepositoryImpl implements GameRepository {
  DogStateModel _currentState = const DogStateModel(score: 0, clickPower: 1, autoClickers: 0);

  // Initial shop items
  final List<ShopItem> _shopItems = [
    const ShopItem(id: '1', name: 'Premium Kibble', cost: 50, clickPowerIncrease: 1),
    const ShopItem(id: '2', name: 'Squeaky Toy', cost: 150, autoClickPowerIncrease: 1),
    const ShopItem(id: '3', name: 'Dog House', cost: 500, autoClickPowerIncrease: 5),
  ];

  // Initial milestones
  List<Milestone> _milestones = [
    const Milestone(id: 'm1', title: 'Good Boy!', requiredScore: 100),
    const Milestone(id: 'm2', title: 'Top Dog', requiredScore: 1000),
    const Milestone(id: 'm3', title: 'Dogfather', requiredScore: 10000),
  ];

  @override
  Future<Either<Failure, DogState>> getDogState() async {
    return Right(_currentState);
  }

  @override
  Future<Either<Failure, DogState>> saveDogState(DogState state) async {
    _currentState = DogStateModel(
      score: state.score,
      clickPower: state.clickPower,
      autoClickers: state.autoClickers,
    );
    return Right(_currentState);
  }

  @override
  Future<Either<Failure, List<ShopItem>>> getShopItems() async {
    return Right(_shopItems);
  }

  @override
  Future<Either<Failure, List<Milestone>>> getMilestones() async {
    return Right(_milestones);
  }

  @override
  Future<Either<Failure, Unit>> saveMilestones(List<Milestone> milestones) async {
    _milestones = List.from(milestones);
    return const Right(unit);
  }
}
