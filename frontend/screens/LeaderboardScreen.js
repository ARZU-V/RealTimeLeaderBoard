import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLeaderboard, toggleSimulation, getSimulationStatus } from '../services/api';
import LeaderboardItem from '../components/LeaderboardItem';

// CONSTANTS FOR TUNING PERFORMANCE
const PAGE_SIZE = 100; // Fetch 100 items at a time (Reduced network requests)
const PREFETCH_THRESHOLD = 2; // Start loading when 2 screens away from bottom

const LeaderboardScreen = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // New state for footer spinner
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Simulation State
  const [simActive, setSimActive] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Refs
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false); // Ref to prevent double-fetching
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { pageRef.current = page; }, [page]);

  // --- 1. INITIAL LOAD & LOOP ---
  useEffect(() => {
    checkSimStatus();
    loadLeaderboard();

    const intervalId = setInterval(() => {
      loadLeaderboardSilent();
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  // --- 2. ANIMATION ---
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // --- 3. HELPER FUNCTIONS ---
  const processDataWithMovement = (newData, oldData) => {
    const oldRankMap = new Map();
    oldData.forEach((item) => oldRankMap.set(item.username, item.rank));

    return newData.map((item) => {
      const oldRank = oldRankMap.get(item.username);
      let movement = 0;
      if (oldRank !== undefined) movement = oldRank - item.rank;
      return { ...item, movement };
    });
  };

  // --- 4. API CALLS ---
  const checkSimStatus = async () => {
    try {
      const status = await getSimulationStatus();
      setSimActive(status.active);
    } catch (e) {}
  };

  const handleToggleSim = async () => {
    const newState = !simActive;
    setSimActive(newState); 
    await toggleSimulation(newState);
    if(newState) alert("🚀 Simulation Started!");
    else alert("🛑 Simulation Stopped.");
  };

  const loadLeaderboardSilent = async () => {
    // Only update live if user is at the very top (Page 1)
    if (pageRef.current > 1) return; 

    try {
      const response = await getLeaderboard(1, PAGE_SIZE);
      
      setData((prevData) => {
        const updatedTop = processDataWithMovement(response.data, prevData);
        
        // Deduplication Logic
        const topUsernames = new Set(updatedTop.map(u => u.username));
        const keptExisting = prevData.filter(u => !topUsernames.has(u.username));
        
        return [...updatedTop, ...keptExisting];
      });
      setTotal(response.total);
    } catch (error) { console.log('Silent update failed', error); }
  };

  const loadLeaderboard = async () => {
    try {
      if (page === 1) setLoading(true);
      const response = await getLeaderboard(1, PAGE_SIZE);
      const processed = response.data.map(i => ({ ...i, movement: 0 }));
      setData(processed);
      setTotal(response.total);
      setPage(1);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  // --- SMOOTH SCROLL LOADING ---
  const loadMore = async () => {
    if (data.length >= total || loadingMoreRef.current) return;
    
    loadingMoreRef.current = true; // Lock
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await getLeaderboard(nextPage, PAGE_SIZE);
      
      const newData = response.data.map(i => ({ ...i, movement: 0 }));
      
      setData((prevData) => {
        const existingUsernames = new Set(prevData.map(u => u.username));
        const uniqueNewData = newData.filter(u => !existingUsernames.has(u.username));
        return [...prevData, ...uniqueNewData];
      });

      setPage(nextPage);
    } catch (error) { 
        console.error('Failed to load more:', error); 
    } finally {
        loadingMoreRef.current = false; // Unlock
        setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadLeaderboard();
    setRefreshing(false);
  };

  // --- 5. OPTIMIZATION FOR WEB ---
  const getItemLayout = (data, index) => ({
    length: 70,
    offset: 70 * index,
    index,
  });

  const renderItem = useCallback(({ item }) => (
    <LeaderboardItem
      rank={item.rank}
      username={item.username}
      rating={item.rating}
      movement={item.movement}
    />
  ), []);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <View>
          <Text style={styles.headerTitle}>Global Leaderboard</Text>
          <Text style={styles.headerSubtitle}>{total.toLocaleString()} Players • Live</Text>
        </View>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.iconBtn}>
          <Animated.View style={{ opacity: blinkAnim }}>
             <Ionicons name="information-circle" size={32} color="#3B82F6" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={[styles.simButton, simActive ? styles.stopBtn : styles.startBtn]} 
        onPress={handleToggleSim}
      >
        <Ionicons name={simActive ? "stop-circle" : "play-circle"} size={20} color="white" />
        <Text style={styles.simBtnText}>
          {simActive ? "Stop Simulation" : "Start Live Simulation"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 50 }} />;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.username} 
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter} // Show spinner at bottom if network is slow
          onEndReached={loadMore}
          
          // --- SMOOTH SCROLLING MAGIC ---
          onEndReachedThreshold={PREFETCH_THRESHOLD} // Triggers when 2 screens away from bottom
          getItemLayout={getItemLayout}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          removeClippedSubviews={true} // Crucial for Web performance
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
      <InfoModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
};

// ... InfoModal and Styles ...
const InfoModal = ({ visible, onClose }) => (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
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
                source={require('../assets/gopher.png')} 
                style={styles.techIcon} 
              />
              <View style={styles.techInfo}>
                <Text style={styles.techLabel}>Backend Engine</Text>
                <Text style={styles.techValue}>Go (Golang) + Gin Framework</Text>
              </View>
            </View>
  
            {/* 2. DATABASE ROW */}
            <View style={styles.techRow}>
              <Image 
                source={require('../assets/post.png')} 
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
                source={require('../assets/uptash.png')} 
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
                source={require('../assets/expo.png')} 
                style={styles.techIcon} 
              />
              <View style={styles.techInfo}>
                <Text style={styles.techLabel}>Mobile UI</Text>
                <Text style={styles.techValue}>React Native + Expo</Text>
              </View>
            </View>
            
            <View style={styles.techRow}>
               <Image 
                 source={require('../assets/image1.png')} 
                 style={styles.techIcon} 
               />
               <View style={styles.techInfo}>
                 <Text style={styles.techLabel}>Deployment Frontend</Text>
                 <Text style={styles.techValue}>Vercel</Text>
               </View>
             </View>
             
             <View style={styles.techRow}>
               <Image 
                 source={require('../assets/image.png')} 
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
            <Text style={[styles.modalText, {marginTop: 10, fontStyle:'italic', color:'#3B82F6'}]}>
               Why simulate? This pattern demonstrates how to batch and throttle write operations, drastically reducing expensive API calls to Upstash and Supabase while maintaining real-time accuracy.
            </Text>
  
            <View style={styles.legendContainer}>
               <Text style={styles.legendItem}>• <Text style={styles.green}>▲ Green</Text> = Rank Up</Text>
               <Text style={styles.legendItem}>• <Text style={styles.red}>▼ Red</Text> = Rank Down</Text>
            </View>
  
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
  
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 16, color: '#374151' },
    
    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E5E7EB', paddingTop: 60 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
    headerSubtitle: { fontSize: 14, color: '#6B7280' },
    iconBtn: { padding: 5 },
  
    // SIMULATION BUTTON STYLES
    simButton: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 12, 
      borderRadius: 10,
      marginTop: 5
    },
    startBtn: { backgroundColor: '#10B981' }, // Green
    stopBtn: { backgroundColor: '#EF4444' },  // Red
    simBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
    closeButton: { alignSelf: 'flex-end', marginBottom: 10 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
    sectionHeader: { fontSize: 18, fontWeight: '700', marginTop: 15, marginBottom: 10, color: '#374151' },
    modalText: { fontSize: 15, color: '#4B5563', lineHeight: 22 },
    
    // Tech Row Styles
    techRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8 },
    techIcon: { width: 50, height: 50, resizeMode: 'contain' }, // Fixed icon size
    techInfo: { marginLeft: 15, flex: 1 },
    techLabel: { fontWeight: '700', fontSize: 15 },
    techValue: { color: '#6B7280', fontSize: 14 },
  
    // Legend
    legendContainer: { marginTop: 15, backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 },
    legendItem: { fontSize: 14, color: '#374151', marginBottom: 4 },
    bold: { fontWeight: 'bold', color: '#1F2937' },
    green: { color: '#10B981', fontWeight: 'bold' },
    red: { color: '#EF4444', fontWeight: 'bold' },
    footer: { padding: 20, alignItems: 'center' } // Footer style added
  });

export default LeaderboardScreen;