import { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, KeyboardAvoidingView, Platform, Dimensions 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function CalculatorScreen() {
  const [selectedCategory, setSelectedCategory] = useState('normal');
  const [orderItems, setOrderItems] = useState({}); 
  const [prices, setPrices] = useState({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [change, setChange] = useState(0);
  const [total, setTotal] = useState(0);

  // Cargamos precios al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      loadPrices();
    }, [])
  );

  const loadPrices = async () => {
    try {
      const storedPrices = await AsyncStorage.getItem('prices');
      if (storedPrices) {
        setPrices(JSON.parse(storedPrices));
      } else {
        // Inicializar con categorías por defecto si no hay datos
        const defaultPrices = {
          normal: {},
          pinchos: {},
          fiestas: {}
        };
        await AsyncStorage.setItem('prices', JSON.stringify(defaultPrices));
        setPrices(defaultPrices);
      }
    } catch (error) {
      console.error('Error loading prices:', error);
    }
  };

  // Añadir un producto al pedido
  const addItem = (itemName) => {
    const itemPrice = prices[selectedCategory][itemName].price;

    setOrderItems(prev => {
      // Si no existe en el pedido, lo creamos con quantity=1
      if (!prev[itemName]) {
        return {
          ...prev,
          [itemName]: { quantity: 1, price: itemPrice }
        };
      } else {
        // Si ya existe, incrementamos su cantidad
        return {
          ...prev,
          [itemName]: {
            ...prev[itemName],
            quantity: prev[itemName].quantity + 1
          }
        };
      }
    });
  };

  // Sumar 1 a la cantidad de un producto en el pedido
  const incrementItem = (itemName) => {
    setOrderItems(prev => {
      if (!prev[itemName]) return prev;
      return {
        ...prev,
        [itemName]: {
          ...prev[itemName],
          quantity: prev[itemName].quantity + 1
        }
      };
    });
  };

  // Restar 1 a la cantidad de un producto en el pedido
  const decrementItem = (itemName) => {
    setOrderItems(prev => {
      const current = prev[itemName];
      if (!current) return prev;
      
      // Si al restar 1 queda en 0, lo quitamos del pedido
      if (current.quantity === 1) {
        const newOrder = { ...prev };
        delete newOrder[itemName];
        return newOrder;
      } else {
        return {
          ...prev,
          [itemName]: {
            ...current,
            quantity: current.quantity - 1
          }
        };
      }
    });
  };

  // Limpiar pedido
  const clearOrder = () => {
    setOrderItems({});
    setPaymentAmount('');
    setChange(0);
    setTotal(0);
  };

  // Cada vez que cambie orderItems o paymentAmount, recalcular total y cambio
  useEffect(() => {
    let newTotal = 0;
    Object.values(orderItems).forEach(({ quantity, price }) => {
      newTotal += quantity * price;
    });
    setTotal(newTotal);

    const pay = parseFloat(paymentAmount) || 0;
    setChange(Math.max(0, pay - newTotal));
  }, [orderItems, paymentAmount]);

  // Handler de cambio en el input de Pago
  const handlePaymentChange = (text) => {
    setPaymentAmount(text);
    // El total/cambio se recalcula en useEffect
  };

  // Guardar pedido
  const saveOrder = async () => {
    try {
      const timestamp = new Date().toISOString();

      // Pasamos orderItems a un array de { name, price, quantity }
      const itemsArray = Object.entries(orderItems).map(([name, data]) => ({
        name,
        price: data.price,
        quantity: data.quantity
      }));

      const order = {
        items: itemsArray,
        total,
        category: selectedCategory,
        timestamp,
        paymentAmount: parseFloat(paymentAmount) || 0,
        change,
      };

      const existingSales = await AsyncStorage.getItem('sales');
      const sales = existingSales ? JSON.parse(existingSales) : [];
      sales.push(order);
      await AsyncStorage.setItem('sales', JSON.stringify(sales));

      clearOrder();
    } catch (error) {
      console.error('Error saving order:', error);
    }
  };

  // Filtrar productos en base al texto y al tipo
  const filteredItems = Object.entries(prices[selectedCategory] || {}).filter(([name, data]) => {
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = (selectedType === 'all') || (data.type === selectedType);
    return matchesSearch && matchesType;
  });

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Barra de categorías en la parte superior */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categorySelector}
          contentContainerStyle={styles.categorySelectorContent}
        >
          {Object.keys(prices).map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.selectedCategory
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.selectedCategoryText
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Fila que contiene: buscador + barra de tipos (horizontal) */}
      <View style={styles.searchAndTypesRow}>
        {/* Buscador (igual que al principio) */}
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

        {/* Barra de tipos, también horizontal */}
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
          
          {/* Los tipos que quieras */}
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'cervezas' && styles.selectedType]}
            onPress={() => setSelectedType('cervezas')}
          >
            <Text style={[styles.typeText, selectedType === 'cervezas' && styles.selectedTypeText]}>
              Cervezas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'vinos' && styles.selectedType]}
            onPress={() => setSelectedType('vinos')}
          >
            <Text style={[styles.typeText, selectedType === 'vinos' && styles.selectedTypeText]}>
              Vinos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'cubatas' && styles.selectedType]}
            onPress={() => setSelectedType('cubatas')}
          >
            <Text style={[styles.typeText, selectedType === 'cubatas' && styles.selectedTypeText]}>
              Cubatas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'copas' && styles.selectedType]}
            onPress={() => setSelectedType('copas')}
          >
            <Text style={[styles.typeText, selectedType === 'copas' && styles.selectedTypeText]}>
              Copas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'refrescos' && styles.selectedType]}
            onPress={() => setSelectedType('refrescos')}
          >
            <Text style={[styles.typeText, selectedType === 'refrescos' && styles.selectedTypeText]}>
              Refrescos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'litros' && styles.selectedType]}
            onPress={() => setSelectedType('litros')}
          >
            <Text style={[styles.typeText, selectedType === 'litros' && styles.selectedTypeText]}>
              Litros
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'chuches' && styles.selectedType]}
            onPress={() => setSelectedType('chuches')}
          >
            <Text style={[styles.typeText, selectedType === 'chuches' && styles.selectedTypeText]}>
              Chuches
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'pinchos' && styles.selectedType]}
            onPress={() => setSelectedType('pinchos')}
          >
            <Text style={[styles.typeText, selectedType === 'pinchos' && styles.selectedTypeText]}>
              Pinchos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'cafes' && styles.selectedType]}
            onPress={() => setSelectedType('cafes')}
          >
            <Text style={[styles.typeText, selectedType === 'cafes' && styles.selectedTypeText]}>
              Cafes
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista de productos */}
      <ScrollView style={styles.itemList}>
        {filteredItems.map(([name, data]) => (
          <TouchableOpacity
            key={name}
            style={styles.itemButton}
            onPress={() => addItem(name)}
          >
            <View>
              <Text style={styles.itemName}>{name}</Text>
              <Text style={styles.itemType}>{data.type}</Text>
            </View>
            <Text style={styles.itemPrice}>
              {data.price.toFixed(2)}€
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resumen del pedido */}
      <View style={styles.orderSummary}>
        <ScrollView style={styles.orderItems}>
          {Object.entries(orderItems).map(([itemName, data]) => (
            <View key={itemName} style={styles.orderItemRow}>
              <Text style={styles.orderItemText}>
                {itemName} ({data.price.toFixed(2)}€) x {data.quantity} = {(data.price * data.quantity).toFixed(2)}
              </Text>
              <View style={styles.orderButtons}>
                {/* Botón “–” */}
                <TouchableOpacity onPress={() => decrementItem(itemName)}>
                  <Ionicons name="remove-circle-outline" size={24} color="#ff4444" />
                </TouchableOpacity>
                {/* Botón “+” */}
                <TouchableOpacity onPress={() => incrementItem(itemName)} style={{ marginLeft: 12 }}>
                  <Ionicons name="add-circle-outline" size={24} color="#00ff87" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
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

/** --- Estilos --- **/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  /** Barra de categorías arriba */
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

  /** Search + tipos en la misma fila */
  searchAndTypesRow: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginLeft: 5,
    paddingHorizontal: 10,
    height: Platform.OS === 'android' ? 40 : 36,
    // Le damos un ancho para que la barra de tipos aparezca a la derecha
    // Si quieres que ocupe todo el espacio posible, usa flex: 1
    width: '95%',
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
    marginLeft: 5,
    maxHeight: 40,
    // Si quieres que la barra de tipos ocupe el resto, pon flex: 1
    // flex: 1,
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

  /** Lista de productos */
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

  /** Resumen del pedido */
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

  /** Total y botones */
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
