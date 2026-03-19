import '../../domain/entities/dog_state.dart';

class DogStateModel extends DogState {
  const DogStateModel({
    required super.score,
    required super.clickPower,
    required super.autoClickers,
  });

  factory DogStateModel.fromJson(Map<String, dynamic> json) {
    return DogStateModel(
      score: json['score'] as int,
      clickPower: json['clickPower'] as int,
      autoClickers: json['autoClickers'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'score': score,
      'clickPower': clickPower,
      'autoClickers': autoClickers,
    };
  }
}
