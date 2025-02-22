import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OrderItemData {
  price: number;
  quantity: number;
}

interface ProductWithPrice {
  product_id: string;
  product_name: string;
  product_type: string;
  category_id: string;
  category_name: string;
  price: number;
}

export default function CalculatorScreen() {
  // Lista de categorías en DB
  const [categoryList, setCategoryList] = useState<{ id: string; name: string }[]>([]);
  // Categoría seleccionada (por 'name')
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');

  // De la antigua "type" (cervezas, vinos...) mantenemos un estado:
  const [selectedType, setSelectedType] = useState<string>('all');

  // Buscador
  const [searchQuery, setSearchQuery] = useState('');

  // Lista de "ProductWithPrice"
  const [productList, setProductList] = useState<ProductWithPrice[]>([]);

  // El "pedido": { [product_id]: { price, quantity } }
  const [orderItems, setOrderItems] = useState<Record<string, OrderItemData>>({});

  // Manejo de pago
  const [paymentAmount, setPaymentAmount] = useState('');
  const [change, setChange] = useState(0);
  const [total, setTotal] = useState(0);

  // Cargamos categorías y productos+precios al montar
  useEffect(() => {
    fetchCategories();
    fetchProductsAndPrices();
  }, []);

  // Recalcular total y cambio
  useEffect(() => {
    let newTotal = 0;
    Object.values(orderItems).forEach(({ price, quantity }) => {
      newTotal += price * quantity;
    });
    setTotal(newTotal);

    const pay = parseFloat(paymentAmount) || 0;
    setChange(Math.max(0, pay - newTotal));
  }, [orderItems, paymentAmount]);

  // 1. Cargar categorías de la tabla 'categories'
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
        setCategoryList(data);
        // Si no tenemos nada seleccionado, seleccionamos la primera
        if (data.length > 0 && !selectedCategoryName) {
          setSelectedCategoryName(data[0].name);
        }
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }

  // 2. Cargar product_prices (con join a 'products' y 'categories')
  async function fetchProductsAndPrices() {
    try {
      const { data, error } = await supabase
        .from('product_prices')
        .select(`
          product_id,
          price,
          category_id,
          product:products ( id, name, type ),
          category:categories ( id, name )
        `);

      if (error) {
        console.error('Error fetching product_prices:', error);
        return;
      }
      if (!data) return;

      const list: ProductWithPrice[] = data.map((row: any) => ({
        product_id: row.product?.id,
        product_name: row.product?.name,
        product_type: row.product?.type,
        category_id: row.category?.id,
        category_name: row.category?.name,
        price: row.price,
      }));

      setProductList(list);
    } catch (err) {
      console.error('Error loading products/prices:', err);
    }
  }

  // Filtrar según categoría, tipo y search
  function getFilteredProducts() {
    return productList.filter((item) => {
      const matchCategory = item.category_name === selectedCategoryName;
      const matchType = selectedType === 'all' || item.product_type === selectedType;
      const matchSearch = item.product_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchType && matchSearch;
    });
  }

  // Añadir un producto al pedido
  function addItem(product: ProductWithPrice) {
    const key = product.product_id;
    const price = product.price;

    setOrderItems((prev) => {
      if (!prev[key]) {
        return {
          ...prev,
          [key]: { price, quantity: 1 },
        };
      } else {
        const oldItem = prev[key];
        return {
          ...prev,
          [key]: { ...oldItem, quantity: oldItem.quantity + 1 },
        };
      }
    });
  }

  // Botones +/- en el resumen
  function incrementItem(productId: string) {
    setOrderItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;
      return {
        ...prev,
        [productId]: { ...item, quantity: item.quantity + 1 },
      };
    });
  }
  function decrementItem(productId: string) {
    setOrderItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;
      if (item.quantity === 1) {
        const newObj = { ...prev };
        delete newObj[productId];
        return newObj;
      } else {
        return {
          ...prev,
          [productId]: { ...item, quantity: item.quantity - 1 },
        };
      }
    });
  }

  // Limpiar pedido
  function clearOrder() {
    setOrderItems({});
    setPaymentAmount('');
    setChange(0);
    setTotal(0);
  }

  // Manejar cambio en "Pago"
  function handlePaymentChange(text: string) {
    setPaymentAmount(text);
  }

  // Guardar pedido localmente (para SalesScreen)
  async function saveOrder() {
    try {
      const timestamp = new Date().toISOString();

      // Convertir orderItems a array de strings para SalesScreen
      const itemsForDisplay = Object.entries(orderItems).map(([productId, data]) => {
        const foundProd = productList.find((p) => p.product_id === productId);
        const prodName = foundProd ? foundProd.product_name : productId;
        const linePrice = (data.price * data.quantity).toFixed(2);
        return `${prodName} x ${data.quantity} = ${linePrice}€`;
      });

      const order = {
        items: itemsForDisplay, // array de strings
        total,
        category: selectedCategoryName,
        timestamp,
        paymentAmount: parseFloat(paymentAmount) || 0,
        change,
      }

      // Leer ventas guardadas en AsyncStorage
      const existingSalesJson = await AsyncStorage.getItem('sales');
      const sales = existingSalesJson ? JSON.parse(existingSalesJson) : [];

      // Añadimos este nuevo pedido
      sales.push(order);

      // Guardamos de nuevo
      await AsyncStorage.setItem('sales', JSON.stringify(sales));

      clearOrder();
    } catch (err) {
      console.error('Error saving order:', err);
    }
  }

  // Productos filtrados
  const filteredProducts = getFilteredProducts();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Barra de categorías arriba (basada en categoryList) */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categorySelectorContent}
          style={styles.categorySelector}
        >
          {categoryList.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryButton,
                selectedCategoryName === cat.name && styles.selectedCategory,
              ]}
              onPress={() => setSelectedCategoryName(cat.name)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategoryName === cat.name && styles.selectedCategoryText,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Fila con buscador y barra de tipos */}
      <View style={styles.searchAndTypesRow}>
        {/* Buscador */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Barra de tipos */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeSelector}
          contentContainerStyle={styles.typeSelectorContent}
        >
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'all' && styles.selectedType]}
            onPress={() => setSelectedType('all')}
          >
            <Text style={[styles.typeText, selectedType === 'all' && styles.selectedTypeText]}>
              Todos
            </Text>
          </TouchableOpacity>

          {['cervezas','vinos','cubatas','copas','refrescos','litros','chuches','pinchos','cafes'].map((typeItem) => (
            <TouchableOpacity
              key={typeItem}
              style={[styles.typeButton, selectedType === typeItem && styles.selectedType]}
              onPress={() => setSelectedType(typeItem)}
            >
              <Text style={[styles.typeText, selectedType === typeItem && styles.selectedTypeText]}>
                {typeItem.charAt(0).toUpperCase() + typeItem.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista de productos filtrados */}
      <ScrollView style={styles.itemList}>
        {filteredProducts.map((prod) => (
          <TouchableOpacity
            key={`${prod.product_id}-${prod.category_id}`} 
            style={styles.itemButton}
            onPress={() => addItem(prod)}
          >
            <View>
              <Text style={styles.itemName}>{prod.product_name}</Text>
              <Text style={styles.itemType}>{prod.product_type}</Text>
            </View>
            <Text style={styles.itemPrice}>
              {prod.price.toFixed(2)}€
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resumen del pedido */}
      <View style={styles.orderSummary}>
        <ScrollView style={styles.orderItems}>
          {Object.entries(orderItems).map(([productId, data]) => {
            const foundProd = productList.find(p => p.product_id === productId);
            const displayName = foundProd ? foundProd.product_name : productId;
            const lineTotal = (data.price * data.quantity).toFixed(2);

            return (
              <View key={productId} style={styles.orderItemRow}>
                <Text style={styles.orderItemText}>
                  {displayName} ({data.price.toFixed(2)}€) x {data.quantity} = {lineTotal}€
                </Text>
                <View style={styles.orderButtons}>
                  <TouchableOpacity onPress={() => decrementItem(productId)}>
                    <Ionicons name="remove-circle-outline" size={24} color="#ff4444" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => incrementItem(productId)}
                    style={{ marginLeft: 12 }}
                  >
                    <Ionicons name="add-circle-outline" size={24} color="#00ff87" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Pago / cambio */}
        <View style={styles.paymentContainer}>
          <View style={styles.paymentInputContainer}>
            <Text style={styles.paymentLabel}>Pago:</Text>
            <TextInput
              style={styles.paymentInput}
              placeholder="0.00"
              placeholderTextColor="#666"
              value={paymentAmount}
              onChangeText={handlePaymentChange}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.changeContainer}>
            <Text style={styles.changeLabel}>Cambio:</Text>
            <Text style={styles.changeAmount}>{change.toFixed(2)}€</Text>
          </View>
        </View>

        {/* Total y botones */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>Total: {total.toFixed(2)}€</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.clearButton} onPress={clearOrder}>
              <Text style={styles.buttonText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chargeButton, Object.keys(orderItems).length === 0 && styles.disabledButton]}
              onPress={saveOrder}
              disabled={Object.keys(orderItems).length === 0}
            >
              <Text style={styles.buttonText}>Cobrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  topBar: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 5,
  },
  categorySelector: {
    height: 40,
  },
  categorySelectorContent: {
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  categoryButton: {
    height: 30,
    paddingHorizontal: 15,
    marginHorizontal: 3,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCategory: {
    backgroundColor: '#00ff87',
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  selectedCategoryText: {
    color: '#000',
  },
  searchAndTypesRow: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginHorizontal: 5,
    paddingHorizontal: 10,
    height: Platform.OS === 'android' ? 40 : 36,
    marginBottom: 5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    height: Platform.OS === 'android' ? 40 : 36,
    padding: Platform.OS === 'android' ? 8 : 0,
  },
  typeSelector: {
    maxHeight: 40,
    marginHorizontal: 5,
  },
  typeSelectorContent: {
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  typeButton: {
    height: 30,
    paddingHorizontal: 15,
    marginHorizontal: 3,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
  },
  selectedType: {
    backgroundColor: '#00ff87',
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedTypeText: {
    color: '#000',
  },
  itemList: {
    flex: 1,
    padding: 10,
  },
  itemButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
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
  itemPrice: {
    color: '#00ff87',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderSummary: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  orderItems: {
    maxHeight: 100,
    marginBottom: 8,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  orderItemText: {
    color: '#fff',
    fontSize: 14,
  },
  orderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentContainer: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  paymentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentLabel: {
    color: '#fff',
    fontSize: 14,
    marginRight: 8,
  },
  paymentInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 6,
    backgroundColor: '#333',
    borderRadius: 4,
    height: Platform.OS === 'android' ? 40 : 32,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeLabel: {
    color: '#fff',
    fontSize: 14,
    marginRight: 8,
  },
  changeAmount: {
    color: '#00ff87',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalText: {
    color: '#00ff87',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  clearButton: {
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  chargeButton: {
    backgroundColor: '#00ff87',
    padding: 8,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
