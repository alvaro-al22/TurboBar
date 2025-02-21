import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SalesScreen() {
  const [sales, setSales] = useState([]);
  const [totalToday, setTotalToday] = useState(0);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const storedSales = await AsyncStorage.getItem('sales');
      if (storedSales) {
        const salesData = JSON.parse(storedSales);
        setSales(salesData);

        // Calcular el total de hoy
        const today = new Date().toISOString().split('T')[0];
        const todaySales = salesData.filter(sale => 
          sale.timestamp.split('T')[0] === today
        );
        const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0);
        setTotalToday(todayTotal);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ventas de Hoy</Text>
        <Text style={styles.totalToday}>{totalToday.toFixed(2)}€</Text>
      </View>

      <ScrollView style={styles.salesList}>
        {sales.slice().reverse().map((sale, index) => (
          <View key={index} style={styles.saleCard}>
            <View style={styles.saleHeader}>
              <Text style={styles.saleTimestamp}>{formatDate(sale.timestamp)}</Text>
              <Text style={styles.saleCategory}>{sale.category}</Text>
            </View>
            
            <View style={styles.itemsList}>
              {sale.items.map((item, itemIndex) => (
                <Text key={itemIndex} style={styles.saleItem}>{item}</Text>
              ))}
            </View>
            
            <Text style={styles.saleTotal}>Total: {sale.total.toFixed(2)}€</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 20,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  totalToday: {
    color: '#00ff87',
    fontSize: 24,
    fontWeight: 'bold',
  },
  salesList: {
    flex: 1,
    padding: 15,
  },
  saleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  saleTimestamp: {
    color: '#666',
  },
  saleCategory: {
    color: '#00ff87',
    fontWeight: 'bold',
  },
  itemsList: {
    marginBottom: 10,
  },
  saleItem: {
    color: '#fff',
    marginVertical: 2,
  },
  saleTotal: {
    color: '#00ff87',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});