import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  TextInput, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabaseClient';
import { useFocusEffect } from 'expo-router';

export default function SettingsScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryId, setNewCategoryId] = useState('');

  // Cargar y suscribir
  useFocusEffect(
    useCallback(() => {
      fetchCategories();

      // Suscribirse a realtime de categories
      const channel = supabase
        .channel('settings_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'categories' },
          (payload) => {
            console.log('Realtime categories change (Settings):', payload);
            // Volver a cargar categorías
            fetchCategories();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [])
  );

  // Cargar categorías
  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  // Añadir categoría
  const addCategory = async () => {
    if (!newCategoryId.trim()) {
      Alert.alert('Error', 'Por favor introduce un nombre de categoría');
      return;
    }

    // Comprobar si ya existe localmente
    const alreadyExists = categories.some(cat => cat.name === newCategoryId);
    if (alreadyExists) {
      Alert.alert('Error', 'Ya existe una categoría con este nombre');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name: newCategoryId.trim() }])
        .select('*') // para recuperar la fila creada
        .single();

      if (error) {
        console.error('Error inserting category:', error);
        Alert.alert('Error', 'No se pudo guardar la categoría');
        return;
      }

      // data ya tendrá la categoría recién insertada
      if (data) {
        // Actualizamos local (aunque la suscripción a realtime también lo haría)
        setCategories(prev => [...prev, data]);
      }
      setNewCategoryId('');
      Alert.alert('Éxito', 'Categoría añadida correctamente');
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', 'No se pudo guardar la categoría');
    }
  };

  // Eliminar categoría
  const removeCategory = async (categoryId: string, categoryName: string) => {
    // Evitar borrar 'normal', 'pinchos', 'fiestas'
    if (['normal', 'pinchos', 'fiestas'].includes(categoryName)) {
      Alert.alert('Error', 'No se pueden eliminar las categorías predeterminadas');
      return;
    }

    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que quieres eliminar la categoría "${categoryName}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', categoryId);

              if (error) {
                console.error('Error removing category:', error);
                Alert.alert('Error', 'No se pudo eliminar la categoría');
                return;
              }

              // Actualizamos local (aunque la suscripción a realtime también lo haría)
              setCategories(prev => prev.filter(cat => cat.id !== categoryId));
            } catch (error) {
              console.error('Error removing category:', error);
              Alert.alert('Error', 'No se pudo eliminar la categoría');
            }
          },
        },
      ]
    );
  };

  // Resetear todos los datos (ejemplo)
  const resetAllData = () => {
    Alert.alert(
      'Confirmar reinicio',
      '¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Borrar todas las categorías
              await supabase
                .from('categories')
                .delete()
                .neq('id', '');

              // Volvemos a crear las 3 categorías base
              const { error } = await supabase
                .from('categories')
                .insert([
                  { name: 'normal' },
                  { name: 'pinchos' },
                  { name: 'fiestas' },
                ]);

              if (error) {
                console.error('Error inserting default categories:', error);
              }

              // O borra y recrea otras tablas si deseas...
              // fetchCategories nuevamente
              fetchCategories();

              Alert.alert('Éxito', 'Todos los datos han sido reiniciados');
            } catch (error) {
              console.error('Error resetting data:', error);
              Alert.alert('Error', 'No se pudieron reiniciar los datos');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gestión de Categorías</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nombre de categoría"
            placeholderTextColor="#666"
            value={newCategoryId}
            onChangeText={setNewCategoryId}
          />
          <TouchableOpacity style={styles.addButton} onPress={addCategory}>
            <Text style={styles.buttonText}>Añadir Categoría</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.categoriesList}>
          {categories.map((cat) => (
            <View key={cat.id} style={styles.categoryItem}>
              <Text style={styles.categoryName}>{cat.name}</Text>
              {!['normal', 'pinchos', 'fiestas'].includes(cat.name) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeCategory(cat.id, cat.name)}
                >
                  <Ionicons name="trash-outline" size={24} color="#ff4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gestión de Datos</Text>
        <TouchableOpacity style={styles.resetButton} onPress={resetAllData}>
          <Text style={styles.resetButtonText}>Reiniciar Todos los Datos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acerca de</Text>
        <Text style={styles.aboutText}>
          Bar Manager v1.0.0{'\n'}
          Una aplicación para gestionar precios y pedidos de tu bar
        </Text>
      </View>
    </View>
  );
}

// --- ESTILOS SettingsScreen ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#00ff87',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  categoriesList: {
    maxHeight: 200,
    marginTop: 10,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryName: {
    color: '#fff',
    fontSize: 16,
  },
  deleteButton: {
    padding: 5,
  },
  resetButton: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  aboutText: {
    color: '#888',
    lineHeight: 20,
  },
});
