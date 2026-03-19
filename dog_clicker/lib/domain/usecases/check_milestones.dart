import 'package:dartz/dartz.dart';
import '../../core/failures.dart';
import '../../core/usecase.dart';
import '../entities/milestone.dart';
import '../repositories/game_repository.dart';
import 'package:equatable/equatable.dart';

class CheckMilestones implements UseCase<List<Milestone>, CheckMilestonesParams> {
  final GameRepository repository;

  CheckMilestones(this.repository);

  @override
  Future<Either<Failure, List<Milestone>>> call(CheckMilestonesParams params) async {
    final milestonesEither = await repository.getMilestones();
    return milestonesEither.bind((milestones) {
      bool changed = false;
      final updatedMilestones = milestones.map((m) {
        if (!m.isReached && params.currentScore >= m.requiredScore) {
          changed = true;
          return m.copyWith(isReached: true);
        }
        return m;
      }).toList();

      if (changed) {
        repository.saveMilestones(updatedMilestones);
      }
      return Right(updatedMilestones);
    });
  }
}

class CheckMilestonesParams extends Equatable {
  final int currentScore;

  const CheckMilestonesParams({required this.currentScore});

  @override
  List<Object?> get props => [currentScore];
}
