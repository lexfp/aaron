import 'package:get_it/get_it.dart';
import 'domain/repositories/game_repository.dart';
import 'data/repositories/game_repository_impl.dart';
import 'domain/usecases/get_dog_state.dart';
import 'domain/usecases/increment_clicks.dart';
import 'domain/usecases/buy_item.dart';
import 'domain/usecases/get_shop_items.dart';
import 'domain/usecases/get_milestones.dart';
import 'domain/usecases/check_milestones.dart';
import 'presentation/bloc/dog_clicker_bloc.dart';

final sl = GetIt.instance;

Future<void> init() async {
  // BLoC
  sl.registerFactory(
    () => DogClickerBloc(
      getDogState: sl(),
      incrementClicks: sl(),
      buyItem: sl(),
      getShopItems: sl(),
      getMilestones: sl(),
      checkMilestones: sl(),
    ),
  );

  // Use cases
  sl.registerLazySingleton(() => GetDogState(sl()));
  sl.registerLazySingleton(() => IncrementClicks(sl()));
  sl.registerLazySingleton(() => BuyItem(sl()));
  sl.registerLazySingleton(() => GetShopItems(sl()));
  sl.registerLazySingleton(() => GetMilestones(sl()));
  sl.registerLazySingleton(() => CheckMilestones(sl()));

  // Repository
  sl.registerLazySingleton<GameRepository>(() => GameRepositoryImpl());
}
