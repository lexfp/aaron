import 'package:equatable/equatable.dart';

class Milestone extends Equatable {
  final String id;
  final String title;
  final int requiredScore;
  final bool isReached;

  const Milestone({
    required this.id,
    required this.title,
    required this.requiredScore,
    this.isReached = false,
  });

  Milestone copyWith({
    String? title,
    int? requiredScore,
    bool? isReached,
  }) {
    return Milestone(
      id: id,
      title: title ?? this.title,
      requiredScore: requiredScore ?? this.requiredScore,
      isReached: isReached ?? this.isReached,
    );
  }

  @override
  List<Object?> get props => [id, title, requiredScore, isReached];
}
