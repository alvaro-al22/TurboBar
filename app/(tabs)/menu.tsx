import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function MenuScreen() {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [itemName, setItemName] = useState('');
  // Por defecto, ponemos itemType en "cervezas" (puedes cambiarlo a cualquiera de los 9)
  const [itemType, setItemType] = useState('cervezas');
  const [prices, setPrices] = useState({});
  const [categoryPrices, setCategoryPrices] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const storedPrices = await AsyncStorage.getItem('prices');
      if (storedPrices) {
        const parsedPrices = JSON.parse(storedPrices);
        setPrices(parsedPrices);

        // Inicializamos inputs de precio vacíos para cada categoría
        const initialCategoryPrices = {};
        Object.keys(parsedPrices).forEach(category => {
          initialCategoryPrices[category] = '';
        });
        setCategoryPrices(initialCategoryPrices);
      } else {
        // Si no existe, creamos un ejemplo con tus 3 categorías
        const defaultPrices = {
          normal: {},
          pinchos: {},
          fiestas: {}
        };
        await AsyncStorage.setItem('prices', JSON.stringify(defaultPrices));
        setPrices(defaultPrices);

        const initialCategoryPrices = {
          normal: '',
          pinchos: '',
          fiestas: ''
        };
        setCategoryPrices(initialCategoryPrices);
      }
    } catch (error) {
      console.error('Error loading prices:', error);
    }
  };

  const savePrices = async (newPrices) => {
    try {
      await AsyncStorage.setItem('prices', JSON.stringify(newPrices));
      setPrices(newPrices);
    } catch (error) {
      console.error('Error saving prices:', error);
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    }
  };

  const startEditing = (item) => {
    setEditingProduct(item);
    setItemName(item);

    // Tomamos como referencia la categoría "normal" para saber el type,
    // aunque podrías tomar la primera categoría que lo contenga
    const foundType = prices.normal && prices.normal[item]?.type
      ? prices.normal[item].type
      : 'cervezas';
    setItemType(foundType);

    // Cargamos los precios actuales en el formulario
    const editPrices = {};
    Object.keys(prices).forEach(category => {
      // Si el producto existe en esta categoría, tomar su precio
      if (prices[category][item]) {
        editPrices[category] = prices[category][item].price.toString();
      } else {
        editPrices[category] = '';
      }
    });
    setCategoryPrices(editPrices);
    setShowAddProduct(true);
  };

  const addOrUpdateItem = () => {
    if (!itemName) {
      Alert.alert('Error', 'Por favor ingresa el nombre del producto');
      return;
    }

    // Asegurarnos de que todos los precios tengan algo
    const hasEmptyPrice = Object.values(categoryPrices).some(price => price === '');
    if (hasEmptyPrice) {
      Alert.alert('Error', 'Por favor ingresa todos los precios');
      return;
    }

    const newPrices = { ...prices };

    // Si estamos editando y cambiamos el nombre de un producto,
    // primero eliminamos el "producto anterior" en todas las categorías
    if (editingProduct && editingProduct !== itemName) {
      Object.keys(newPrices).forEach(category => {
        delete newPrices[category][editingProduct];
      });
    }

    // Añadimos / actualizamos el producto en todas las categorías
    Object.keys(newPrices).forEach(category => {
      newPrices[category][itemName] = {
        type: itemType,
        price: parseFloat(categoryPrices[category])
      };
    });

    savePrices(newPrices);
    resetForm();
  };

  const resetForm = () => {
    setItemName('');
    setItemType('cervezas');
    setEditingProduct(null);

    // Dejamos todos los inputs de categoría vacíos
    const resetCategoryPrices = {};
    Object.keys(prices).forEach(category => {
      resetCategoryPrices[category] = '';
    });
    setCategoryPrices(resetCategoryPrices);

    setShowAddProduct(false);
  };

  const removeItem = (item) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que quieres eliminar ${item}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newPrices = { ...prices };
            Object.keys(newPrices).forEach(category => {
              delete newPrices[category][item];
            });
            savePrices(newPrices);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Botón para mostrar / ocultar el formulario de añadir producto */}
      <TouchableOpacity
        style={styles.addProductButton}
        onPress={() => setShowAddProduct(!showAddProduct)}>
        <Text style={styles.addProductButtonText}>
          {showAddProduct ? 'Ocultar Formulario' : 'Añadir Producto'}
        </Text>
      </TouchableOpacity>

      {showAddProduct && (
        <View style={styles.inputContainer}>
          {/* NOMBRE del producto */}
          <TextInput
            style={styles.input}
            placeholder="Nombre del producto"
            placeholderTextColor="#666"
            value={itemName}
            onChangeText={setItemName}
          />

          {/* LISTA de tipos (los 9 que quieres) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'cervezas' && styles.selectedType]}
              onPress={() => setItemType('cervezas')}>
              <Text style={[styles.typeText, itemType === 'cervezas' && styles.selectedTypeText]}>Cervezas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'vinos' && styles.selectedType]}
              onPress={() => setItemType('vinos')}>
              <Text style={[styles.typeText, itemType === 'vinos' && styles.selectedTypeText]}>Vinos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'cubatas' && styles.selectedType]}
              onPress={() => setItemType('cubatas')}>
              <Text style={[styles.typeText, itemType === 'cubatas' && styles.selectedTypeText]}>Cubatas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'copas' && styles.selectedType]}
              onPress={() => setItemType('copas')}>
              <Text style={[styles.typeText, itemType === 'copas' && styles.selectedTypeText]}>Copas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'refrescos' && styles.selectedType]}
              onPress={() => setItemType('refrescos')}>
              <Text style={[styles.typeText, itemType === 'refrescos' && styles.selectedTypeText]}>Refrescos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'litros' && styles.selectedType]}
              onPress={() => setItemType('litros')}>
              <Text style={[styles.typeText, itemType === 'litros' && styles.selectedTypeText]}>Litros</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'chuches' && styles.selectedType]}
              onPress={() => setItemType('chuches')}>
              <Text style={[styles.typeText, itemType === 'chuches' && styles.selectedTypeText]}>Chuches</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'pinchos' && styles.selectedType]}
              onPress={() => setItemType('pinchos')}>
              <Text style={[styles.typeText, itemType === 'pinchos' && styles.selectedTypeText]}>Pinchos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, itemType === 'cafes' && styles.selectedType]}
              onPress={() => setItemType('cafes')}>
              <Text style={[styles.typeText, itemType === 'cafes' && styles.selectedTypeText]}>Cafes</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Precios para cada categoría (normal, pinchos, fiestas, etc.) */}
          <View style={styles.priceContainer}>
            {Object.keys(prices).map(category => (
              <View key={category} style={styles.priceInput}>
                <Text style={styles.priceLabel}>{category}</Text>
                <TextInput
                  style={[styles.input, styles.priceInputField]}
                  placeholder={`Precio para ${category}`}
                  placeholderTextColor="#666"
                  value={categoryPrices[category]}
                  onChangeText={(text) => setCategoryPrices(prev => ({
                    ...prev,
                    [category]: text
                  }))}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addButton} onPress={addOrUpdateItem}>
              <Text style={styles.addButtonText}>
                {editingProduct ? 'Actualizar Producto' : 'Agregar Producto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* LISTA de productos (iteramos sobre 'normal' como ejemplo) */}
      <ScrollView style={styles.itemList}>
        {Object.entries(prices.normal || {}).map(([item, data]) => (
          <TouchableOpacity
            key={item}
            style={styles.itemRow}
            onPress={() => startEditing(item)}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item}</Text>
              <Text style={styles.itemType}>{data.type}</Text>
            </View>

            {/* Mostramos los precios de cada categoría para este producto */}
            <View style={styles.priceList}>
              {Object.keys(prices).map(category => {
                const p = prices[category][item];
                if (!p) return null;
                return (
                  <Text key={category} style={styles.price}>
                    {p.price.toFixed(2)}€
                  </Text>
                );
              })}
            </View>

            {/* Botón para borrar sin entrar en el formulario */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                // Prevenimos que se abra la edición si hacemos click en la papelera
                // (por eso se hace un e.stopPropagation() en web, pero en RN no hay
                // tanto problema; podemos evitar el onPress del parent con un uso
                // de onPress en el child)
                removeItem(item);
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/** --- ESTILOS --- **/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  addProductButton: {
    backgroundColor: '#00ff87',
    padding: 12,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addProductButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputContainer: {
    padding: 10,
    backgroundColor: '#1a1a1a',
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: Platform.OS === 'android' ? 8 : 10,
    borderRadius: 8,
    marginBottom: 10,
    height: Platform.OS === 'android' ? 40 : 'auto',
  },
  typeSelector: {
    marginVertical: 5,
    height: 40,
  },
  typeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    height: 30,
  },
  selectedType: {
    backgroundColor: '#00ff87',
  },
  typeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  selectedTypeText: {
    color: '#000',
  },
  priceContainer: {
    marginBottom: 10,
  },
  priceInput: {
    marginBottom: 8,
  },
  priceLabel: {
    color: '#fff',
    marginBottom: 4,
    textTransform: 'capitalize',
    fontSize: 12,
  },
  priceInputField: {
    height: Platform.OS === 'android' ? 40 : 'auto',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#00ff87',
    padding: 12,
    borderRadius: 8,
    flex: 2,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  itemList: {
    flex: 1,
    padding: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontSize: 14,
  },
  itemType: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  priceList: {
    marginRight: 10,
  },
  price: {
    color: '#00ff87',
    textAlign: 'right',
    marginBottom: 2,
    fontSize: 12,
  },
  deleteButton: {
    padding: 5,
  },
});
