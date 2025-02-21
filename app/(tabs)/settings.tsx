import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [categories, setCategories] = useState({});
  const [newCategoryId, setNewCategoryId] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const storedPrices = await AsyncStorage.getItem('prices');
      if (storedPrices) {
        setCategories(JSON.parse(storedPrices));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const addCategory = async () => {
    if (!newCategoryId) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (categories[newCategoryId]) {
      Alert.alert('Error', 'Ya existe una categoría con este ID');
      return;
    }

    try {
      const newCategories = { ...categories };
      newCategories[newCategoryId] = {};

      // Copiar todos los productos existentes a la nueva categoría
      Object.keys(categories.normal || {}).forEach(productName => {
        const product = categories.normal[productName];
        newCategories[newCategoryId][productName] = {
          ...product,
          price: 0
        };
      });

      await AsyncStorage.setItem('prices', JSON.stringify(newCategories));
      setCategories(newCategories);
      setNewCategoryId('');
      Alert.alert('Éxito', 'Categoría añadida correctamente');
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', 'No se pudo guardar la categoría');
    }
  };

  const removeCategory = async (categoryId) => {
    if (categoryId === 'normal' || categoryId === 'pinchos' || categoryId === 'fiestas') {
      Alert.alert('Error', 'No se pueden eliminar las categorías predeterminadas');
      return;
    }

    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar esta categoría?',
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
              const newCategories = { ...categories };
              delete newCategories[categoryId];
              await AsyncStorage.setItem('prices', JSON.stringify(newCategories));
              setCategories(newCategories);
            } catch (error) {
              console.error('Error removing category:', error);
              Alert.alert('Error', 'No se pudo eliminar la categoría');
            }
          },
        },
      ]
    );
  };

  const resetAllData = () => {
    Alert.alert(
      'Confirmar reinicio',
      '¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede dehacer.',
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
              await AsyncStorage.setItem('prices', JSON.stringify({
                normal: {},
                pinchos: {},
                fiestas: {}
              }));
              await AsyncStorage.setItem('sales', JSON.stringify([]));
              loadCategories();
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
          {Object.keys(categories).map((categoryId) => (
            <View key={categoryId} style={styles.categoryItem}>
              <Text style={styles.categoryName}>{categoryId}</Text>
              {!['normal', 'pinchos', 'fiestas'].includes(categoryId) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeCategory(categoryId)}>
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