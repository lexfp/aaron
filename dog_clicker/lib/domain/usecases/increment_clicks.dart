import 'package:dartz/dartz.dart';
import '../../core/failures.dart';
import '../../core/usecase.dart';
import '../entities/dog_state.dart';
import '../repositories/game_repository.dart';
import 'package:equatable/equatable.dart';

class IncrementClicks implements UseCase<DogState, IncrementParams> {
  final GameRepository repository;

  IncrementClicks(this.repository);

  @override
  Future<Either<Failure, DogState>> call(IncrementParams params) async {
    final stateEither = await repository.getDogState();
    return stateEither.bind((state) {
      final newState = state.copyWith(score: state.score + params.amount);
      repository.saveDogState(newState);
      return Right(newState);
    });
  }
}

class IncrementParams extends Equatable {
  final int amount;

  const IncrementParams({required this.amount});

  @override
  List<Object?> get props => [amount];
}
