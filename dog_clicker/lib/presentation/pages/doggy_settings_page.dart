import 'package:flutter/material.dart';

class DoggySettingsPage extends StatefulWidget {
  const DoggySettingsPage({super.key});

  @override
  State<DoggySettingsPage> createState() => _DoggySettingsPageState();
}

class _DoggySettingsPageState extends State<DoggySettingsPage> {
  bool _soundEnabled = true;
  bool _musicEnabled = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: const Text('Doggy Settings',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _buildSettingsTile(
            title: 'Sound Effects',
            icon: Icons.volume_up,
            value: _soundEnabled,
            onChanged: (val) => setState(() => _soundEnabled = val),
          ),
          const SizedBox(height: 16),
          _buildSettingsTile(
            title: 'Music',
            icon: Icons.music_note,
            value: _musicEnabled,
            onChanged: (val) => setState(() => _musicEnabled = val),
          ),
          const SizedBox(height: 40),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
            onPressed: () {
              // TODO: Implement Reset Data logic in BLoC if requested
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('Data Reset not implemented yet')));
            },
            child: const Text('Reset Save Data',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTile({
    required String title,
    required IconData icon,
    required bool value,
    required Function(bool) onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: SwitchListTile(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        secondary: Icon(icon, color: Theme.of(context).colorScheme.primary),
        value: value,
        onChanged: onChanged,
        activeThumbColor: Theme.of(context).colorScheme.secondary,
      ),
    );
  }
}
