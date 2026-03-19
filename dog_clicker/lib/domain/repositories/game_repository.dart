import 'package:dartz/dartz.dart';
import '../entities/dog_state.dart';
import '../entities/shop_item.dart';
import '../entities/milestone.dart';
import '../../core/failures.dart';

abstract class GameRepository {
  Future<Either<Failure, DogState>> getDogState();
  Future<Either<Failure, DogState>> saveDogState(DogState state);
  Future<Either<Failure, List<ShopItem>>> getShopItems();
  Future<Either<Failure, List<Milestone>>> getMilestones();
  Future<Either<Failure, Unit>> saveMilestones(List<Milestone> milestones);
}
