import 'package:equatable/equatable.dart';

class DogState extends Equatable {
  final int score;
  final int clickPower;
  final int autoClickers;

  const DogState({
    required this.score,
    required this.clickPower,
    required this.autoClickers,
  });

  DogState copyWith({
    int? score,
    int? clickPower,
    int? autoClickers,
  }) {
    return DogState(
      score: score ?? this.score,
      clickPower: clickPower ?? this.clickPower,
      autoClickers: autoClickers ?? this.autoClickers,
    );
  }

  @override
  List<Object?> get props => [score, clickPower, autoClickers];
}
