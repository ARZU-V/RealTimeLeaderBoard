import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLeaderboard } from '../services/api';
import LeaderboardItem from '../components/LeaderboardItem';

const LeaderboardScreen = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  // Refs
  const pageRef = useRef(1);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // --- 1. BLINKING ANIMATION ---
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // --- 2. DATA LOADING LOGIC ---
  useEffect(() => {
    loadLeaderboard();
    const intervalId = setInterval(() => {
      loadLeaderboardSilent();
    }, 3000);
    return () => clearInterval(intervalId);
  }, []);

  const processDataWithMovement = (newData, oldData) => {
    const oldRankMap = new Map();
    oldData.forEach((item) => {
      oldRankMap.set(item.username, item.rank);
    });

    return newData.map((item) => {
      const oldRank = oldRankMap.get(item.username);
      let movement = 0;
      if (oldRank !== undefined) {
        movement = oldRank - item.rank;
      }
      return { ...item, movement };
    });
  };

  const loadLeaderboardSilent = async () => {
    if (pageRef.current > 1) return;
    try {
      const response = await getLeaderboard(1, 50);
      setData((currentData) => {
        return processDataWithMovement(response.data, currentData);
      });
      setTotal(response.total);
    } catch (error) {
      console.log('Silent update failed:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      if (page === 1) setLoading(true);
      const response = await getLeaderboard(1, 50);
      const processed = response.data.map(i => ({ ...i, movement: 0 }));
      setData(processed);
      setTotal(response.total);
      setPage(1);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (data.length >= total) return;
    try {
      const nextPage = page + 1;
      const response = await getLeaderboard(nextPage, 50);
      const newDataWithZeroMove = response.data.map(i => ({ ...i, movement: 0 }));
      setData([...data, ...newDataWithZeroMove]);
      setPage(nextPage);
    } catch (error) {
      console.error('Failed to load more:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  // --- RENDERERS ---
  const renderItem = ({ item }) => (
    <LeaderboardItem
      rank={item.rank}
      username={item.username}
      rating={item.rating}
      movement={item.movement}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Text style={styles.headerTitle}>Global Leaderboard</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Animated.View style={{ opacity: blinkAnim }}>
            <Ionicons name="information-circle" size={28} color="#3B82F6" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      <Text style={styles.headerSubtitle}>
        {total.toLocaleString()} Players • Live Updates
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (data.length >= total) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading Live Data...</Text>
        <TouchableOpacity
          style={styles.loadingInfoBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.loadingInfoText}>ℹ️ Read about the Architecture</Text>
        </TouchableOpacity>
        <InfoModal visible={modalVisible} onClose={() => setModalVisible(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.username}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      <InfoModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
};

// --- UPDATED INFO MODAL ---
const InfoModal = ({ visible, onClose }) => (
  <Modal
    animationType="slide"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.modalScroll}>
          <Text style={styles.modalTitle}>System Overview</Text>

          <Text style={styles.modalText}>
            This is a <Text style={styles.bold}>Real-Time Leaderboard</Text> built to handle high-concurrency updates efficiently.
          </Text>

          <Text style={styles.sectionHeader}>🛠️ Tech Stack</Text>

          {/* 1. BACKEND ROW */}
          <View style={styles.techRow}>
            <Image 
              source={require('../assets/gopher.png')} // Replace with Go/Backend icon
              style={styles.techIcon} 
            />
            <View style={styles.techInfo}>
              <Text style={styles.techLabel}>Backend Engine</Text>
              <Text style={styles.techValue}>Go (Golang) + Gin Framework and Used in Memory sync.Map aswell</Text>
            </View>
          </View>

          {/* 2. DATABASE ROW */}
          <View style={styles.techRow}>
            <Image 
              source={require('../assets/post.png')} // Replace with Postgres icon
              style={styles.techIcon} 
            />
            <View style={styles.techInfo}>
              <Text style={styles.techLabel}>Persistent Storage</Text>
              <Text style={styles.techValue}>PostgreSQL (Supabase)</Text>
            </View>
          </View>

          {/* 3. CACHING ROW */}
          <View style={styles.techRow}>
            <Image 
              source={require('../assets/uptash.png')} // Replace with Redis icon
              style={styles.techIcon} 
            />
            <View style={styles.techInfo}>
              <Text style={styles.techLabel}>High-Speed Cache</Text>
              <Text style={styles.techValue}>Redis (Sorted Sets)</Text>
            </View>
          </View>

          {/* 4. FRONTEND ROW */}
          <View style={styles.techRow}>
            <Image 
              source={require('../assets/expo.png')} // Replace with React/Expo icon
              style={styles.techIcon} 
            />
            <View style={styles.techInfo}>
              <Text style={styles.techLabel}>Mobile UI</Text>
              <Text style={styles.techValue}>React Native + Expo</Text>
            </View>
          </View>
          <View style={styles.techRow}>
            <Image 
              source={require('../assets/image1.png')} // Replace with React/Expo icon
              style={styles.techIcon} 
            />
            <View style={styles.techInfo}>
              <Text style={styles.techLabel}>Deployment FRONTEND</Text>
              <Text style={styles.techValue}>Vercel </Text>
            </View>
          </View>
          <View style={styles.techRow}>
            <Image 
              source={require('../assets/image.png')} // Replace with React/Expo icon
              style={styles.techIcon} 
            />
            <View style={styles.techInfo}>
              <Text style={styles.techLabel}>Deployment Backend</Text>
              <Text style={styles.techValue}>Render</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>⚡ Live Simulation</Text>
          <Text style={styles.modalText}>
            A background worker simulates gameplay by updating random users every <Text style={styles.bold}>200ms</Text>.
          </Text>
          <View style={styles.legendContainer}>
             <Text style={styles.legendItem}>• <Text style={styles.green}>▲ Green</Text> = Rank Up</Text>
             <Text style={styles.legendItem}>• <Text style={styles.red}>▼ Red</Text> = Rank Down</Text>
          </View>

        </ScrollView>

        <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
          <Text style={styles.gotItText}>Got it!</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  loadingInfoBtn: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
  },
  loadingInfoText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '80%',
  },
  modalScroll: {
    paddingBottom: 10,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
  },
  modalText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 6,
  },
  // --- NEW TECH STACK STYLES ---
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
  },
  techIcon: {
    width: 100,
    height: 100,
    marginRight: 12,
    resizeMode: 'contain',
  },
  techInfo: {
    flex: 1,
  },
  techLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  techValue: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  // --- LEGEND & TEXT STYLES ---
  legendContainer: {
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
  },
  legendItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  bold: { fontWeight: 'bold', color: '#1F2937' },
  green: { color: '#10B981', fontWeight: 'bold' },
  red: { color: '#EF4444', fontWeight: 'bold' },
  gotItButton: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  gotItText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default LeaderboardScreen;