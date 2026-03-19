import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'injection.dart' as di;
import 'presentation/bloc/dog_clicker_bloc.dart';
import 'presentation/bloc/dog_clicker_event.dart';
import 'presentation/pages/main_game_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await di.init();
  runApp(const DogClickerApp());
}

class DogClickerApp extends StatelessWidget {
  const DogClickerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (_) => di.sl<DogClickerBloc>()..add(LoadGame()),
        ),
      ],
      child: MaterialApp(
        title: 'Dog Clicker',
        theme: ThemeData(
          brightness: Brightness.dark,
          primaryColor: const Color(0xFF6B4EE6),
          colorScheme: ColorScheme.dark(
            primary: const Color(0xFF6B4EE6),
            secondary: const Color(0xFFF7931A),
            background: const Color(0xFF1E1E2C),
            surface: const Color(0xFF2A2A3D),
          ),
          textTheme: const TextTheme(
            displayLarge: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            bodyLarge: TextStyle(color: Colors.white70),
          ),
          useMaterial3: true,
        ),
        home: const MainGamePage(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
