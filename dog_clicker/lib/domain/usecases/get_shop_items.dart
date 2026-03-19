import 'package:dartz/dartz.dart';
import '../../core/failures.dart';
import '../../core/usecase.dart';
import '../entities/shop_item.dart';
import '../repositories/game_repository.dart';

class GetShopItems implements UseCase<List<ShopItem>, NoParams> {
  final GameRepository repository;

  GetShopItems(this.repository);

  @override
  Future<Either<Failure, List<ShopItem>>> call(NoParams params) async {
    return await repository.getShopItems();
  }
}
