import 'package:dartz/dartz.dart';
import '../../core/failures.dart';
import '../../core/usecase.dart';
import '../entities/milestone.dart';
import '../repositories/game_repository.dart';

class GetMilestones implements UseCase<List<Milestone>, NoParams> {
  final GameRepository repository;

  GetMilestones(this.repository);

  @override
  Future<Either<Failure, List<Milestone>>> call(NoParams params) async {
    return await repository.getMilestones();
  }
}
