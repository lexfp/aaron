import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/usecase.dart';
import '../../domain/usecases/get_dog_state.dart';
import '../../domain/usecases/increment_clicks.dart';
import '../../domain/usecases/buy_item.dart';
import '../../domain/usecases/get_shop_items.dart';
import '../../domain/usecases/get_milestones.dart';
import '../../domain/usecases/check_milestones.dart';
import 'dog_clicker_event.dart';
import 'dog_clicker_state.dart';

class DogClickerBloc extends Bloc<DogClickerEvent, DogClickerState> {
  final GetDogState getDogState;
  final IncrementClicks incrementClicks;
  final BuyItem buyItem;
  final GetShopItems getShopItems;
  final GetMilestones getMilestones;
  final CheckMilestones checkMilestones;

  Timer? _autoClickTimer;

  DogClickerBloc({
    required this.getDogState,
    required this.incrementClicks,
    required this.buyItem,
    required this.getShopItems,
    required this.getMilestones,
    required this.checkMilestones,
  }) : super(DogClickerInitial()) {
    on<LoadGame>(_onLoadGame);
    on<DogClicked>(_onDogClicked);
    on<ShopItemBought>(_onShopItemBought);
    on<AutoClickTick>(_onAutoClickTick);
    on<MilestonesChecked>(_onMilestonesChecked);
  }

  Future<void> _onLoadGame(LoadGame event, Emitter<DogClickerState> emit) async {
    emit(DogClickerLoading());
    final stateEither = await getDogState(NoParams());
    final shopEither = await getShopItems(NoParams());
    final milestonesEither = await getMilestones(NoParams());

    stateEither.fold(
      (failure) => emit(DogClickerError(failure.message)),
      (dogState) {
        shopEither.fold(
          (failure) => emit(DogClickerError(failure.message)),
          (shopItems) {
            milestonesEither.fold(
              (failure) => emit(DogClickerError(failure.message)),
              (milestones) {
                emit(DogClickerLoaded(
                  dogState: dogState,
                  shopItems: shopItems,
                  milestones: milestones,
                ));
                _startAutoClickTimer(dogState.autoClickers);
              },
            );
          },
        );
      },
    );
  }

  Future<void> _onDogClicked(DogClicked event, Emitter<DogClickerState> emit) async {
    final currentState = state;
    if (currentState is DogClickerLoaded) {
      final incrementEither = await incrementClicks(IncrementParams(amount: currentState.dogState.clickPower));
      incrementEither.fold(
        (failure) => emit(DogClickerError(failure.message)),
        (newState) {
          emit(currentState.copyWith(dogState: newState));
          add(MilestonesChecked());
        },
      );
    }
  }

  Future<void> _onShopItemBought(ShopItemBought event, Emitter<DogClickerState> emit) async {
    final currentState = state;
    if (currentState is DogClickerLoaded) {
      final buyEither = await buyItem(BuyItemParams(item: event.item));
      buyEither.fold(
        (failure) {
          // If not enough score, ignore or could trigger error state temporarily
          emit(currentState);
        },
        (newState) {
          emit(currentState.copyWith(dogState: newState));
          _startAutoClickTimer(newState.autoClickers);
        },
      );
    }
  }

  void _onAutoClickTick(AutoClickTick event, Emitter<DogClickerState> emit) async {
    final currentState = state;
    if (currentState is DogClickerLoaded && currentState.dogState.autoClickers > 0) {
      final incrementEither = await incrementClicks(IncrementParams(amount: currentState.dogState.autoClickers));
      incrementEither.fold(
        (failure) {},
        (newState) {
          emit(currentState.copyWith(dogState: newState));
          add(MilestonesChecked());
        },
      );
    }
  }

  Future<void> _onMilestonesChecked(MilestonesChecked event, Emitter<DogClickerState> emit) async {
    final currentState = state;
    if (currentState is DogClickerLoaded) {
      final checkEither = await checkMilestones(CheckMilestonesParams(currentScore: currentState.dogState.score));
      checkEither.fold(
        (failure) {},
        (newMilestones) {
          // Check if there are newly reached milestones compared to previous
          final prevReached = currentState.milestones.where((m) => m.isReached).length;
          final currReached = newMilestones.where((m) => m.isReached).length;
          
          if (currReached > prevReached) {
            final newlyReached = newMilestones.where((m) => m.isReached && !currentState.milestones.any((old) => old.id == m.id && old.isReached)).first;
            emit(currentState.copyWith(milestones: newMilestones, newMilestoneReached: newlyReached));
            // Immediately clear the flag so it doesn't trigger again
            emit(currentState.copyWith(milestones: newMilestones, clearNewMilestone: true));
          } else {
            emit(currentState.copyWith(milestones: newMilestones));
          }
        },
      );
    }
  }

  void _startAutoClickTimer(int autoClickers) {
    if (autoClickers > 0 && _autoClickTimer == null) {
      _autoClickTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        add(AutoClickTick());
      });
    }
  }

  @override
  Future<void> close() {
    _autoClickTimer?.cancel();
    return super.close();
  }
}
