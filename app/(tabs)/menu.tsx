import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabaseClient'; // tu cliente Supabase

export default function MenuScreen() {
  // Lista de productos con sus precios por categoría
  const [products, setProducts] = useState([]);
  // Lista de categorías (p.ej. normal, pinchos, fiestas)
  const [categories, setCategories] = useState([]);

  // Controlar el formulario (crear / editar)
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('cervezas');

  // pricesByCategory: { [categoryId]: string }
  // Donde guardamos los precios introducidos en el form
  const [pricesByCategory, setPricesByCategory] = useState({});

  useEffect(() => {
    // Al montar, cargamos categorías y productos
    fetchCategories();
    fetchAllProductsWithPrices();
  }, []);

  // 1. Cargar todas las categorías
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

  // 2. Cargar todos los productos con sus precios (join product_prices, categories)
  async function fetchAllProductsWithPrices() {
    // Opción: un join manual, o un "select" anidado
    // Ejemplo manual: traemos la tabla intermedia
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

    // Agrupar por producto
    // productsMap[product_id] = {
    //   id, name, type, prices: [ { categoryId, categoryName, price }, ... ]
    // }
    const productsMap: Record<string, any> = {};

    data.forEach(row => {
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
          price: price,
        });
      }
    });

    // Convertir en array
    // Podríamos volver a Supabase para agarrar productos sin precio, si existen
    const productsArray = Object.values(productsMap);
    setProducts(productsArray);
  }

  // 3. Crear un nuevo producto (o editar) en la BD
  async function createOrUpdateProduct() {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del producto');
      return;
    }
    // Asegurar que ingresemos un precio para cada categoría
    const missingPrice = categories.some(cat => !pricesByCategory[cat.id]);
    if (missingPrice) {
      Alert.alert('Error', 'Por favor ingresa el precio para todas las categorías');
      return;
    }

    try {
      let productId = editingProductId;
      if (!productId) {
        // Crear un nuevo producto
        const { data: newProd, error } = await supabase
        .from('products')
        .insert([{ name: name.trim(), type }])
        .single();
      
        console.log(error); // ver qué error hay
        if (error) return;
        console.log(newProd); 
        productId = newProd.id;
      } else {
        // Actualizar el producto
        const { error } = await supabase
          .from('products')
          .update({ name: name.trim(), type })
          .eq('id', productId);

        if (error) {
          console.error('Error updating product:', error);
          return;
        }
        // Primero podríamos borrar los precios viejos y luego re-insertar,
        // o hacer un upsert uno por uno. Aquí, para simplificar, borramos e insertamos.
        // O usas un loop a .upsert() con unique keys.
        await supabase
          .from('product_prices')
          .delete()
          .eq('product_id', productId);
      }

      // Insertar (o re-insertar) los precios
      const rowsToInsert = categories.map(cat => ({
        product_id: productId,
        category_id: cat.id,
        price: parseFloat(pricesByCategory[cat.id]) || 0,
      }));
      const { error: insertPricesError } = await supabase
        .from('product_prices')
        .insert(rowsToInsert);

      if (insertPricesError) {
        console.error('Error inserting product_prices:', insertPricesError);
        return;
      }

      // Recargar la lista
      fetchAllProductsWithPrices();
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  }

  // 4. Eliminar producto
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
                console.error('Error deleting product:', error);
                return;
              }
              // Recargar
              fetchAllProductsWithPrices();
            } catch (err) {
              console.error('Error removing product:', err);
            }
          },
        },
      ]
    );
  }

  // Preparar form en modo "crear"
  function startCreating() {
    setEditingProductId(null);
    setName('');
    setType('cervezas');
    // Precios vacíos
    const initialPrices = {};
    categories.forEach(cat => {
      initialPrices[cat.id] = '';
    });
    setPricesByCategory(initialPrices);

    setShowForm(true);
  }

  // Preparar form en modo "editar"
  function startEditing(prod) {
    setEditingProductId(prod.id);
    setName(prod.name);
    setType(prod.type);

    // Llenar pricesByCategory
    const mapPrices = {};
    categories.forEach(cat => {
      // Buscar si en prod.prices hay esa cat
      const found = prod.prices.find(p => p.categoryId === cat.id);
      mapPrices[cat.id] = found ? found.price.toString() : '';
    });
    setPricesByCategory(mapPrices);

    setShowForm(true);
  }

  function resetForm() {
    setEditingProductId(null);
    setName('');
    setType('cervezas');
    const emptyMap = {};
    categories.forEach(cat => {
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
            // Ocultar form
            resetForm();
          } else {
            // Nuevo producto
            startCreating();
          }
        }}
      >
        <Text style={styles.addProductButtonText}>
          {showForm ? 'Ocultar Formulario' : 'Añadir Producto'}
        </Text>
      </TouchableOpacity>

      {/* FORMULARIO Crear/Editar */}
      {showForm && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del producto"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />

          {/* Seleccionar tipo */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
            {['cervezas','vinos','cubatas','copas','refrescos','litros','chuches','pinchos','cafes']
              .map(tipo => (
                <TouchableOpacity
                  key={tipo}
                  style={[styles.typeButton, type === tipo && styles.selectedType]}
                  onPress={() => setType(tipo)}>
                  <Text
                    style={[styles.typeText, type === tipo && styles.selectedTypeText]}
                  >
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>

          {/* Inputs de precio para cada categoría dinámica */}
          <View>
            {categories.map(cat => (
              <View key={cat.id} style={styles.priceInputRow}>
                <Text style={styles.priceLabel}>{cat.name}</Text>
                <TextInput
                  style={[styles.input, styles.priceInputField]}
                  placeholder={`Precio para ${cat.name}`}
                  placeholderTextColor="#666"
                  value={pricesByCategory[cat.id]}
                  onChangeText={val => {
                    setPricesByCategory(prev => ({
                      ...prev,
                      [cat.id]: val,
                    }));
                  }}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>

          {/* Botones Cancelar / Guardar */}
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
        {products.map(prod => (
          <View key={prod.id} style={styles.itemRow}>
            {/* Al pulsar, editamos */}
            <TouchableOpacity
              style={styles.itemInfo}
              onPress={() => startEditing(prod)}
            >
              <Text style={styles.itemName}>{prod.name}</Text>
              <Text style={styles.itemType}>{prod.type}</Text>
            </TouchableOpacity>

            {/* Mostrar precios por categoría */}
            <View style={styles.priceList}>
              {prod.prices.map(p => (
                <Text key={p.categoryId} style={styles.price}>
                  {p.categoryName}: {p.price.toFixed(2)}€
                </Text>
              ))}
            </View>

            {/* Botón eliminar */}
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
