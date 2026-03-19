import 'package:dartz/dartz.dart';
import '../../core/failures.dart';
import '../../core/usecase.dart';
import '../entities/dog_state.dart';
import '../entities/shop_item.dart';
import '../repositories/game_repository.dart';
import 'package:equatable/equatable.dart';

class BuyItem implements UseCase<DogState, BuyItemParams> {
  final GameRepository repository;

  BuyItem(this.repository);

  @override
  Future<Either<Failure, DogState>> call(BuyItemParams params) async {
    final stateEither = await repository.getDogState();
    return stateEither.bind((state) {
      if (state.score >= params.item.cost) {
        final newState = state.copyWith(
          score: state.score - params.item.cost,
          clickPower: state.clickPower + params.item.clickPowerIncrease,
          autoClickers: state.autoClickers + params.item.autoClickPowerIncrease,
        );
        repository.saveDogState(newState);
        return Right(newState);
      } else {
        return const Left(CacheFailure("Not enough score"));
      }
    });
  }
}

class BuyItemParams extends Equatable {
  final ShopItem item;

  const BuyItemParams({required this.item});

  @override
  List<Object?> get props => [item];
}
