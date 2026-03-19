import 'package:dartz/dartz.dart';
import '../../core/failures.dart';
import '../../core/usecase.dart';
import '../entities/dog_state.dart';
import '../repositories/game_repository.dart';

class GetDogState implements UseCase<DogState, NoParams> {
  final GameRepository repository;

  GetDogState(this.repository);

  @override
  Future<Either<Failure, DogState>> call(NoParams params) async {
    return await repository.getDogState();
  }
}
