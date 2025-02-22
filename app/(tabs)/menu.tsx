import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabaseClient';

export default function MenuScreen() {
  // Lista de productos con sus precios por categoría
  const [products, setProducts] = useState([]);
  // Lista de categorías (necesario si usas "categoryPrices")
  const [categories, setCategories] = useState([]);

  // Control del formulario
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('cervezas');
  const [pricesByCategory, setPricesByCategory] = useState({});

  useEffect(() => {
    // Cargar datos iniciales
    fetchCategories();
    fetchAllProductsWithPrices();

    // Suscripción a cambios en products, product_prices
    const channel = supabase
      .channel('menu_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Realtime products change:', payload);
          // Vuelve a cargar la lista de productos
          fetchAllProductsWithPrices();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_prices' },
        (payload) => {
          console.log('Realtime product_prices change:', payload);
          fetchAllProductsWithPrices();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        (payload) => {
          console.log('Realtime categories change:', payload);
          fetchCategories();
        }
      )
      .subscribe();

    // Cleanup: desuscribir al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Cargar categorías
  async function fetchCategories() {
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
  }

  // Cargar productos y precios (tabla intermedia)
  async function fetchAllProductsWithPrices() {
    const { data, error } = await supabase
      .from('product_prices')
      .select(`
        id,
        price,
        product_id,
        category_id,
        product:products (*),
        category:categories (*)
      `);

    if (error) {
      console.error('Error fetching products with prices:', error);
      return;
    }
    if (!data) return;

    const productsMap: Record<string, any> = {};

    data.forEach((row) => {
      const { product, category, price, product_id } = row;
      if (!product) return;
      if (!productsMap[product_id]) {
        productsMap[product_id] = {
          id: product_id,
          name: product.name,
          type: product.type,
          prices: [],
        };
      }
      if (category) {
        productsMap[product_id].prices.push({
          categoryId: category.id,
          categoryName: category.name,
          price,
        });
      }
    });

    const productsArray = Object.values(productsMap);
    setProducts(productsArray);
  }

  // Crear/Actualizar producto
  async function createOrUpdateProduct() {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del producto');
      return;
    }

    // Aseguramos precio en cada categoría
    const missingPrice = categories.some((cat) => !pricesByCategory[cat.id]);
    if (missingPrice) {
      Alert.alert('Error', 'Por favor ingresa el precio para todas las categorías');
      return;
    }

    try {
      let productId = editingProductId;

      if (!productId) {
        // CREAR
        const { data: newProd, error: insertError } = await supabase
          .from('products')
          .insert([{ name, type }])
          .select('*')
          .single();

        if (!newProd) {
          Alert.alert('Error', insertError?.message || 'No se pudo crear el producto');
          return;
        }
        productId = newProd.id;
      } else {
        // EDITAR
        const { data: updatedProd, error: updateError } = await supabase
          .from('products')
          .update({ name: name.trim(), type })
          .eq('id', productId)
          .select('*')
          .single();

        if (!updatedProd) {
          Alert.alert('Error', updateError?.message || 'No se pudo actualizar el producto');
          return;
        }

        // Borramos los precios antiguos
        const { error: delPricesError } = await supabase
          .from('product_prices')
          .delete()
          .eq('product_id', productId);

        if (delPricesError) {
          Alert.alert('Error', delPricesError.message || 'No se pudo actualizar los precios');
          return;
        }
      }

      // Insertar (o re-insertar) los precios
      const rowsToInsert = categories.map((cat) => ({
        product_id: productId,
        category_id: cat.id,
        price: parseFloat(pricesByCategory[cat.id]) || 0,
      }));
      const { error: insertPricesError } = await supabase
        .from('product_prices')
        .insert(rowsToInsert);

      if (insertPricesError) {
        Alert.alert('Error', insertPricesError.message || 'No se pudieron guardar los precios');
        return;
      }

      // Recargar
      fetchAllProductsWithPrices();
      resetForm();
    } catch (err) {
      console.error('Error saving product:', err);
      Alert.alert('Error', 'Excepción al guardar el producto');
    }
  }

  // Eliminar producto
  async function removeProduct(productId: string) {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

              if (error) {
                Alert.alert('Error', error.message || 'No se pudo eliminar el producto');
                return;
              }
              fetchAllProductsWithPrices();
            } catch (e) {
              Alert.alert('Error', 'Excepción al eliminar el producto');
            }
          },
        },
      ]
    );
  }

  // MODO CREAR
  function startCreating() {
    setEditingProductId(null);
    setName('');
    setType('cervezas');

    const initialPrices: Record<string, string> = {};
    categories.forEach((cat) => {
      initialPrices[cat.id] = '';
    });
    setPricesByCategory(initialPrices);

    setShowForm(true);
  }

  // MODO EDITAR
  function startEditing(prod) {
    setEditingProductId(prod.id);
    setName(prod.name);
    setType(prod.type);

    const mapPrices: Record<string, string> = {};
    categories.forEach((cat) => {
      const found = prod.prices.find((p) => p.categoryId === cat.id);
      mapPrices[cat.id] = found ? found.price.toString() : '';
    });
    setPricesByCategory(mapPrices);

    setShowForm(true);
  }

  function resetForm() {
    setEditingProductId(null);
    setName('');
    setType('cervezas');
    const emptyMap: Record<string, string> = {};
    categories.forEach((cat) => {
      emptyMap[cat.id] = '';
    });
    setPricesByCategory(emptyMap);
    setShowForm(false);
  }

  return (
    <View style={styles.container}>
      {/* Botón para mostrar/ocultar formulario */}
      <TouchableOpacity
        style={styles.addProductButton}
        onPress={() => {
          if (showForm) {
            resetForm();
          } else {
            startCreating();
          }
        }}
      >
        <Text style={styles.addProductButtonText}>
          {showForm ? 'Ocultar Formulario' : 'Añadir Producto'}
        </Text>
      </TouchableOpacity>

      {/* Formulario Crear/Editar */}
      {showForm && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del producto"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />

          {/* Selector de tipo */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
            {['cervezas','vinos','cubatas','copas','refrescos','litros','chuches','pinchos','cafes']
              .map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[styles.typeButton, type === tipo && styles.selectedType]}
                  onPress={() => setType(tipo)}
                >
                  <Text style={[styles.typeText, type === tipo && styles.selectedTypeText]}>
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>

          {/* Inputs de precio para cada categoría */}
          <View>
            {categories.map((cat) => (
              <View key={cat.id} style={styles.priceInputRow}>
                <Text style={styles.priceLabel}>{cat.name}</Text>
                <TextInput
                  style={[styles.input, styles.priceInputField]}
                  placeholder={`Precio para ${cat.name}`}
                  placeholderTextColor="#666"
                  value={pricesByCategory[cat.id]}
                  onChangeText={(val) => {
                    setPricesByCategory((prev) => ({
                      ...prev,
                      [cat.id]: val,
                    }));
                  }}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>

          {/* Botones Guardar/Cancelar */}
          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={createOrUpdateProduct}>
              <Text style={styles.addButtonText}>
                {editingProductId ? 'Actualizar Producto' : 'Agregar Producto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Lista de productos */}
      <ScrollView style={styles.itemList}>
        {products.map((prod) => (
          <View key={prod.id} style={styles.itemRow}>
            <TouchableOpacity
              style={styles.itemInfo}
              onPress={() => startEditing(prod)}
            >
              <Text style={styles.itemName}>{prod.name}</Text>
              <Text style={styles.itemType}>{prod.type}</Text>
            </TouchableOpacity>

            <View style={styles.priceList}>
              {prod.prices.map((p) => (
                <Text key={p.categoryId} style={styles.price}>
                  {p.categoryName}: {p.price.toFixed(2)}€
                </Text>
              ))}
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => removeProduct(prod.id)}
            >
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// --- ESTILOS MenuScreen ---
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
  priceInputRow: {
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
